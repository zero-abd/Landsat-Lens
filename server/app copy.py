from flask import Flask, request, jsonify, g, send_from_directory, abort
from flask_cors import CORS
from skyfield.api import EarthSatellite, load
import requests
import time
from datetime import datetime, timedelta, timezone
import os
import shutil
import subprocess

app = Flask(__name__, static_folder='./dist')
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
