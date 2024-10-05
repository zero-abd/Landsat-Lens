import json
import requests
import sys
import datetime
import re
import os
import numpy as np
from PIL import Image

class LandsatDownloader:
    def __init__(self, username, token, path, start_date='2024-09-01', end_date=None, num_scenes=1, cloud_cover=30):
        self.username = username
        self.token = token
        self.path = path
        self.service_url = "https://m2m.cr.usgs.gov/api/api/json/stable/"
        self.api_key = None
        self.dataset_name = "Landsat 8-9"
        self.start_date = start_date
        self.end_date = end_date or datetime.datetime.now().strftime('%Y-%m-%d')
        self.num_scenes = num_scenes
        self.label = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.cloud_cover = cloud_cover

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
        self.api_key = self.send_request("login-token", {'username': self.username, 'token': self.token})
        print("API Key obtained.")

    def convert_wrs_to_latlon(self, wrs_path, wrs_row):
        payload = {'gridType': 'WRS2', 'path': str(wrs_path), 'row': str(wrs_row), 'responseShape': 'point'}
        response = self.send_request("grid2ll", payload, self.api_key)
        coords = response.get('coordinates', [])
        if coords:
            lat, lon = coords[0]['latitude'], coords[0]['longitude']
            print(f"Converted Path/Row ({wrs_path}/{wrs_row}) to Lat/Lon: {lat}, {lon}")
            return lat, lon
        raise KeyError("Latitude/Longitude not found in grid2ll response")

    def search_datasets(self):
        payload = {'datasetName': self.dataset_name, 'temporalFilter': {'start': self.start_date, 'end': self.end_date}}
        datasets = self.send_request("dataset-search", payload, self.api_key)
        print(f"Found {len(datasets)} datasets.")
        return datasets

    def search_scenes(self, dataset, latitude, longitude):
        payload = {
            'datasetName': dataset,
            'maxResults': self.num_scenes,
            'startingNumber': 1,
            'sceneFilter': {
                'acquisitionFilter': {'start': self.start_date, 'end': self.end_date},
                'spatialFilter': {
                    'filterType': 'mbr',
                    'lowerLeft': {'latitude': latitude - 0.01, 'longitude': longitude - 0.01},
                    'upperRight': {'latitude': latitude + 0.01, 'longitude': longitude + 0.01}
                },
                'cloudCoverFilter': {'max': self.cloud_cover},
                'browseOnly': True
            }
        }
        scenes = self.send_request("scene-search", payload, self.api_key)
        print(f"Found {scenes['recordsReturned']} scenes.")
        return scenes

    def download_options(self, dataset_alias, scene_ids):
        payload = {
            'datasetName': dataset_alias,
            'entityIds': scene_ids
        }
        return self.send_request("download-options", payload, self.api_key)

    def download_file(self, url):
        try:
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()
            if 'content-disposition' not in response.headers:
                raise ValueError("'content-disposition' header missing for URL")
            filename = re.findall("filename=(.+)", response.headers['content-disposition'])[0].strip("\"")
            filepath = os.path.join(self.path, filename)
            if not filename.endswith(".jpg"):
                raise ValueError("URL does not point to a JPG file")
            if '_TIR' in filename or '_QB' in filename:
                raise ValueError("URL points to a TIR or QB file")

            print(f"Downloading {filename}...")
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            print(f"Downloaded {filename}")
            self.process_image(filepath)
        except Exception as e:
            print(f"Failed to download: {e}")

    def process_image(self, image_path):
        try:
            img = Image.open(image_path).convert("RGBA")
            data = np.array(img)
            red, green, blue, alpha = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
            black_mask = (red == 0) & (green == 0) & (blue == 0)
            data[black_mask] = [0, 0, 0, 0]  # Set black pixels to transparent
            new_img = Image.fromarray(data)
            png_path = image_path.replace(".jpg", ".png")
            new_img.save(png_path, "PNG")
            print(f"Processed and saved {png_path}")
        except Exception as e:
            print(f"Failed to process image {image_path}: {e}")

    def logout(self):
        self.send_request("logout", {}, self.api_key)
        print("Logged out.")

    def download_datasets(self):
        datasets = self.search_datasets()
        wrs_path, wrs_row = 137, 44
        latitude, longitude = self.convert_wrs_to_latlon(wrs_path, wrs_row)
        for dataset in datasets:
            if dataset['datasetAlias'] != 'landsat_ot_c2_l1': continue
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
                        self.download_file(download['url'])
        print("All downloads completed.")


if __name__ == '__main__':
    username = 'zer0ABD'
    token = '***REMOVED***'
    path = os.path.join(os.path.dirname(__file__), 'landsat_data')
    print(path)
    start_date = '2024-09-01'
    end_date = None
    num_scenes = 1
    cloud_cover = 30

    downloader = LandsatDownloader(username, token, path, start_date=start_date, end_date=end_date, num_scenes=num_scenes, cloud_cover=cloud_cover)
    downloader.login()
    downloader.download_datasets()
    downloader.logout()