import json
import requests
import sys
import time
import datetime
import threading
import re
import os
import zipfile
import matplotlib.pyplot as plt
import rasterio
from rasterio.plot import show

from config import Config


class LandsatDownloader:
    def __init__(self, username, token, path, max_threads=5):
        self.username = username
        self.token = token
        self.path = path
        self.max_threads = max_threads
        self.sema = threading.Semaphore(value=max_threads)
        self.threads = []
        self.service_url = "https://m2m.cr.usgs.gov/api/api/json/stable/"
        self.api_key = None
        self.dataset_name = "Landsat 8-9"
        self.label = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

    def send_request(self, endpoint, data, api_key=None):
        url = self.service_url + endpoint
        headers = {'X-Auth-Token': api_key} if api_key else {}
        response = requests.post(url, json.dumps(data), headers=headers)
        response.raise_for_status()
        output = response.json()

        if 'errorCode' in output and output['errorCode'] is not None:
            print("Error:", output['errorMessage'])
            sys.exit()

        return output['data']

    def login(self):
        payload = {'username': self.username, 'token': self.token}
        self.api_key = self.send_request("login-token", payload)
        print("API Key obtained.")

    def convert_wrs_to_latlon(self, wrs_path, wrs_row):
        """
        Convert WRS2 Path and Row to Latitude and Longitude using the grid2ll endpoint
        """
        payload = {
            'gridType': 'WRS2', 
            'path': str(wrs_path),  # Ensure path and row are strings
            'row': str(wrs_row), 
            'responseShape': 'point'  # Return the center point
        }
        response = self.send_request("grid2ll", payload, self.api_key)

        if 'coordinates' in response and len(response['coordinates']) > 0:
            # Extract latitude and longitude from the coordinates
            lat = response['coordinates'][0]['latitude']
            lon = response['coordinates'][0]['longitude']
            print(f"Converted Path/Row ({wrs_path}/{wrs_row}) to Lat/Lon: {lat}, {lon}")
            return lat, lon
        else:
            raise KeyError("Latitude/Longitude not found in grid2ll response")


    def search_datasets(self):
        temporal_filter = {'start': '2024-09-01', 'end': datetime.datetime.now().strftime('%Y-%m-%d')}
        payload = {'datasetName': self.dataset_name, 'temporalFilter': temporal_filter}
        datasets = self.send_request("dataset-search", payload, self.api_key)
        print(f"Found {len(datasets)} datasets.")
        return datasets

    def search_scenes(self, dataset, latitude, longitude):
        """
        Search scenes using latitude and longitude
        """
        acquisition_filter = {'start': '2024-09-01', 'end': datetime.datetime.now().strftime('%Y-%m-%d')}
        spatial_filter = {
            'filterType': 'mbr',  # Minimum Bounding Rectangle
            'lowerLeft': {'latitude': latitude - 0.01, 'longitude': longitude - 0.01},  # Slight margin
            'upperRight': {'latitude': latitude + 0.01, 'longitude': longitude + 0.01}
        }

        payload = {'datasetName': dataset, 'maxResults': 2, 'startingNumber': 1, 'sceneFilter': {'acquisitionFilter': acquisition_filter, 'spatialFilter': spatial_filter}}
        scenes = self.send_request("scene-search", payload, self.api_key)
        print(f"Found {scenes['recordsReturned']} scenes.")
        return scenes

    def download_options(self, dataset_alias, scene_ids):
        payload = {'datasetName': dataset_alias, 'entityIds': scene_ids}
        return self.send_request("download-options", payload, self.api_key)

    def download_file(self, url):
        self.sema.acquire()
        try:
            response = requests.get(url, stream=True, timeout=60)
            if 'content-disposition' not in response.headers:
                raise ValueError(f"'content-disposition' header missing for URL: {url}")

            disposition = response.headers['content-disposition']
            filename = re.findall("filename=(.+)", disposition)[0].strip("\"")
            filepath = os.path.join(self.path, filename)
            print(f"Downloading {filename}...")

            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            print(f"Downloaded {filename}")
            self.unzip_and_show(filepath)
        except requests.exceptions.Timeout:
            print(f"Timeout occurred while trying to download {url}")
        except Exception as e:
            print(f"Failed to download {url}: {e}")
        finally:
            self.sema.release()

    def run_download(self, url):
        thread = threading.Thread(target=self.download_file, args=(url,))
        self.threads.append(thread)
        thread.start()

    def unzip_and_show(self, filepath):
        if filepath.endswith('.zip'):
            with zipfile.ZipFile(filepath, 'r') as zip_ref:
                zip_ref.extractall(self.path)
                print(f"Extracted {filepath}")
                for file in zip_ref.namelist():
                    if file.endswith('.tif'):
                        self.show_image(os.path.join(self.path, file))

    def show_image(self, image_path):
        with rasterio.open(image_path) as src:
            if src.count >= 3:  # Ensure there are enough bands for RGB
                try:
                    # Read RGB bands (assuming band 4, 3, 2 for Landsat 8)
                    red = self.normalize(src.read(4))
                    green = self.normalize(src.read(3))
                    blue = self.normalize(src.read(2))

                    # Stack bands together to create an RGB image
                    rgb = rasterio.plot.reshape_as_image([red, green, blue])

                    plt.figure(figsize=(10, 10))
                    plt.imshow(rgb)
                    plt.title(f"RGB Composite: {os.path.basename(image_path)}")
                    plt.axis('off')
                    plt.show()
                except Exception as e:
                    print(f"Failed to read RGB bands from {image_path}: {e}")
            else:
                print(f"Not enough bands to create RGB composite for {image_path}")

    def normalize(self, array):
        array_min, array_max = array.min(), array.max()
        return ((array - array_min) / (array_max - array_min) * 255).astype('uint8')

    def logout(self):
        self.send_request("logout", {}, self.api_key)
        print("Logged out.")

    def download_datasets(self):
        datasets = self.search_datasets()

        # Convert path/row to lat/lon for WRS2
        wrs_path = 137
        wrs_row = 44
        latitude, longitude = self.convert_wrs_to_latlon(wrs_path, wrs_row)

        for dataset in datasets:
            print(f"Downloading {dataset['datasetAlias']}...{dataset['collectionName']}")

            scenes = self.search_scenes(dataset['datasetAlias'], latitude, longitude)
            if scenes['recordsReturned'] > 0:
                scene_ids = [result['entityId'] for result in scenes['results']]
                download_options = self.download_options(dataset['datasetAlias'], scene_ids)
                downloads = [{'entityId': product['entityId'], 'productId': product['id']} for product in download_options if product['available']]

                if downloads:
                    payload = {'downloads': downloads, 'label': self.label}
                    request_results = self.send_request("download-request", payload, self.api_key)
                    for download in request_results['availableDownloads']:
                        self.run_download(download['url'])

        for thread in self.threads:
            thread.join()  # Ensure all threads are completed
        print("All downloads completed.")

if __name__ == '__main__':
    username = Config.username
    token = Config.token
    path = Config.path

    downloader = LandsatDownloader(username, token, path)
    downloader.login()
    downloader.download_datasets()
    downloader.logout()
