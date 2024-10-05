from flask import Flask, request, jsonify, send_file, g, send_from_directory, abort
from flask_cors import CORS
import requests
from skyfield.api import EarthSatellite, load
import io
import numpy as np
from PIL import Image
import json
import re
from datetime import datetime, timedelta, timezone
import time
import os
import shutil
import subprocess

from config import Config


app = Flask(__name__)
CORS(app)

ts = load.timescale()

def get_tle(catalog_number):
    url = (
        f"https://celestrak.org/NORAD/elements/gp.php?CATNR={catalog_number}&FORMAT=TLE"
    )
    response = requests.get(url)
    return response.text.splitlines()


landsat_8_tle = get_tle(39084)
landsat_9_tle = get_tle(49260)


def get_satellite_data(tle):
    satellite = EarthSatellite(tle[1], tle[2], tle[0], ts)
    t = ts.now()
    geocentric = satellite.at(t)
    subpoint = geocentric.subpoint()

    velocity = geocentric.velocity.km_per_s
    speed = (velocity[0] ** 2 + velocity[1] ** 2 + velocity[2] ** 2) ** 0.5

    altitude = subpoint.elevation.km

    return {
        "name": tle[0].strip().title(),
        "latitude": subpoint.latitude.degrees,
        "longitude": subpoint.longitude.degrees,
        "altitude": altitude,
        "speed": speed,
    }


def get_next_acquisition_date(path):
    current_time = datetime.now(timezone.utc)
    path_date = f"{current_time.month}/{current_time.day}/{current_time.year}"

    next_acq_l8 = None
    next_acq_l9 = None

    try:
        response = requests.get(
            "https://landsat.usgs.gov/sites/default/files/landsat_acq/assets/json/cycles_full.json"
        )
        response.raise_for_status()
        data = response.json()
    except (requests.exceptions.RequestException, ValueError) as e:
        print(f"Error fetching data: {e}")
        return None

    try:
        today_cycle_l8 = data["landsat_8"][path_date]["cycle"]
        today_cycle_l9 = data["landsat_9"][path_date]["cycle"]
    except KeyError:
        print("Error: Path date not found in data.")
        return None

    def find_next_acquisition(satellite_data, today_cycle, max_iterations):
        for i in range(1, max_iterations + 1):
            path_info = satellite_data.get(f"1/{i}/2024")
            if not path_info:
                continue
            path_str = path_info.get("path", "")
            path_split = path_str.split(",")

            if path in path_split:
                cycle = path_info["cycle"]
                diff = int(cycle) - int(today_cycle)
                if diff < 0:
                    diff += 16
                next_acq_date = current_time + timedelta(days=diff)
                return f"{next_acq_date.month}/{next_acq_date.day}/{next_acq_date.year}"
        return None

    next_acq_l8 = find_next_acquisition(data["landsat_8"], today_cycle_l8, 16)
    next_acq_l9 = find_next_acquisition(data["landsat_9"], today_cycle_l9, 31)

    return next_acq_l8, next_acq_l9


@app.route("/satellite-data")
def satellite_data():
    landsat_8_data = get_satellite_data(landsat_8_tle)
    landsat_9_data = get_satellite_data(landsat_9_tle)
    return jsonify({"landsat_8": landsat_8_data, "landsat_9": landsat_9_data})


@app.route("/next-acq-date")
def next_acquisition_date():
    path = request.args.get("path")
    if path is None:
        return {"error": "Path parameter is required."}, 400
    date = get_next_acquisition_date(path)
    if date is None:
        return {"error": "Error fetching data."}, 500
    l8, l9 = date
    return jsonify({"landsat_8": l8, "landsat_9": l9})

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    try:
        if path != "" and os.path.exists(app.static_folder + '/' + path):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')
    except Exception as e:
        app.logger.error('Error in serve', exc_info=True)
        return jsonify({'error': 'Server error'}), 500

class LandsatDownloader:
    def __init__(self, username, token, path, start_date='2024-09-01', end_date=None, num_scenes=1, cloud_cover=30):
        self.username = username
        self.token = token
        self.path = path
        self.service_url = "https://m2m.cr.usgs.gov/api/api/json/stable/"
        self.api_key = None
        self.dataset_name = "Landsat 8-9"
        self.start_date = start_date
        self.end_date = end_date or datetime.now().strftime('%Y-%m-%d')
        self.num_scenes = num_scenes
        self.label = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.cloud_cover = cloud_cover

    def send_request(self, endpoint, data, api_key=None):
        url = self.service_url + endpoint
        headers = {'X-Auth-Token': api_key} if api_key else {}
        response = requests.post(url, json.dumps(data), headers=headers)
        response.raise_for_status()
        output = response.json()
        if 'errorCode' in output and output['errorCode'] is not None:
            print("Error:", output['errorMessage'])
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

    def search_datasets(self, latitude, longitude):
        payload = {
            'datasetName': self.dataset_name,
            'temporalFilter': {'start': self.start_date, 'end': self.end_date},
            'spatialFilter': {
                'filterType': 'mbr',  # Minimum bounding rectangle
                'lowerLeft': {'latitude': latitude - 0.01, 'longitude': longitude - 0.01},
                'upperRight': {'latitude': latitude + 0.01, 'longitude': longitude + 0.01}
            }
        }
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

    def get_processed_image(self, latitude, longitude):
        datasets = self.search_datasets(latitude, longitude)
        for dataset in datasets:
            if dataset['datasetAlias'] != 'landsat_ot_c2_l1':
                continue
            scenes = self.search_scenes(dataset['datasetAlias'], latitude, longitude)
            if scenes['recordsReturned'] > 0:
                scene_ids = [result['entityId'] for result in scenes['results']]

                payload = {
                    'datasetName': dataset['datasetAlias'],
                    'entityIds': scene_ids,
                    "includeSecondaryFileGroups": False
                }
                download_options = self.send_request("download-options", payload, self.api_key)
                
                downloads = [{'entityId': product['entityId'], 'productId': product['id']}
                             for product in download_options
                             if (product['available'] and product['downloadName'] and 'Full Resolution Browse (Reflective Color) JPEG'
                                 in product['downloadName'])]
                if downloads:
                    payload = {'downloads': downloads, 'label': self.label}
                    request_results = self.send_request("download-request", payload, self.api_key)
                    for download in request_results['availableDownloads']:
                        img = self.get_image_data(download['url'])
                        if img:
                            processed_img = self.process_image(img)
                            if processed_img:
                                return processed_img
        return None

    def get_image_data(self, url):
        try:
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()
            return Image.open(io.BytesIO(response.content))
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Failed to retrieve image: {e}")

    def process_image(self, img):
        try:
            img = img.convert("RGBA")
            data = np.array(img)
            red, green, blue, alpha = data[..., 0], data[..., 1], data[..., 2], data[..., 3]
            black_mask = (red == 0) & (green == 0) & (blue == 0)
            data[black_mask] = [0, 0, 0, 0]
            return Image.fromarray(data)
        except Exception as e:
            print(f"Failed to process image: {e}")
            return None

    def logout(self):
        self.send_request("logout", {}, self.api_key)
        print("Logged out.")


@app.route('/get_landsat_data', methods=['GET'])
def get_landsat_image():
    username = Config.USERNAME
    token = Config.TOKEN
    start_date = request.args.get('start_date', '2024-09-01')
    end_date = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
    num_scenes = int(request.args.get('num_scenes', 1))
    cloud_cover = int(request.args.get('cloud_cover', 30))
    latitude = float(request.args.get('latitude', 23.8041))
    longitude = float(request.args.get('longitude', 90.4152))
    
    if not username or not token:
        return jsonify({"error": "Username and token are required."}), 400

    downloader = LandsatDownloader(username=username, 
                                   token=token, path=None, 
                                   start_date=start_date, 
                                   end_date=end_date, 
                                   num_scenes=num_scenes, 
                                   cloud_cover=cloud_cover)
    try:
        downloader.login()
        processed_img = downloader.get_processed_image(latitude, longitude)
        if processed_img:
            img_io = io.BytesIO()
            processed_img.save(img_io, 'PNG')
            img_io.seek(0)
            return send_file(img_io, mimetype='image/png')
        else:
            return jsonify({"error": "Failed to retrieve image."}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        downloader.logout()

@app.route('/latitude', methods=['GET'])
def get_latitude():
    return jsonify({"latitude": landsat_8_tle[0]})

@app.route('/longitude', methods=['GET'])
def get_longitude():
    return jsonify({"longitude": landsat_9_tle[0]})

if __name__ == '__main__':
    try:
        # # Step 1: Change directory to the client folder
        # os.chdir('../client')
        # print('Navigated to client directory.')

        # # Step 2: Run npm build
        # subprocess.run(['npm', 'run', 'build'], check=True, shell=True)
        # print('Client build successful.')

        # # Step 3: Move the dist folder to the server directory using shutil
        # shutil.move('dist', '../server/dist')
        # print('Moved dist folder to server directory.')

        # # Step 4: Change directory back to the server folder
        # os.chdir('../server')
        # print('Navigated back to server directory.')

        app.run(debug=True, port=5000)
    except subprocess.CalledProcessError as e:
        print(f'An error occurred while executing a command: {e}')
    except FileNotFoundError as e:
        print(f'File not found error: {e}')
    except Exception as e:
        print(f'An unexpected error occurred: {e}')