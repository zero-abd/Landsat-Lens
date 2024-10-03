import requests
from skyfield.api import EarthSatellite, load

def get_tle(catalog_number):
    url = f'https://celestrak.org/NORAD/elements/gp.php?CATNR={catalog_number}&FORMAT=TLE'
    response = requests.get(url)
    return response.text.splitlines()

landsat_8_tle = get_tle(39084)
landsat_9_tle = get_tle(49260)

ts = load.timescale()

landsat_8 = EarthSatellite(landsat_8_tle[1], landsat_8_tle[2], landsat_8_tle[0], ts)
landsat_9 = EarthSatellite(landsat_9_tle[1], landsat_9_tle[2], landsat_9_tle[0], ts)

t = ts.now()
geocentric_8 = landsat_8.at(t)
geocentric_9 = landsat_9.at(t)

subpoint_8 = geocentric_8.subpoint()
subpoint_9 = geocentric_9.subpoint()

print(f"Landsat 8 - Latitude: {subpoint_8.latitude.degrees}, Longitude: {subpoint_8.longitude.degrees}")
print(f"Landsat 9 - Latitude: {subpoint_9.latitude.degrees}, Longitude: {subpoint_9.longitude.degrees}")
