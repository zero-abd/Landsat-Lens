import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import { BasemapLayer } from 'react-esri-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface SatelliteData {
    name: string;
    altitude: number;
    latitude: number;
    longitude: number;
    speed: number;
}

interface SatelliteDataMap {
    [key: string]: SatelliteData;
}

const satelliteIcon = L.icon({
    iconUrl: 'https://static.vecteezy.com/system/resources/previews/033/529/060/non_2x/starlink-satellite-ai-generative-free-png.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

const SatelliteTracker: React.FC = () => {
    const [selectedSatellite, setSelectedSatellite] = useState<string>('');
    const [autoFocus, setAutoFocus] = useState<boolean>(true);
    const [satelliteData, setSatelliteData] = useState<SatelliteDataMap>({});

    const fetchSatelliteData = useCallback(async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/satellite-data');
            const data = await response.json();
            setSatelliteData(data);
            if (!selectedSatellite) {
                const firstSatelliteKey = Object.keys(data)[0];
                setSelectedSatellite(firstSatelliteKey);
            }
        } catch (error) {
            console.error('Error fetching satellite data:', error);
        }
    }, [selectedSatellite]);

    useEffect(() => {
        fetchSatelliteData();
        const interval = setInterval(fetchSatelliteData, 5000);
        return () => clearInterval(interval);
    }, [fetchSatelliteData]);

    const MapEvents: React.FC = () => {
        const map = useMap();
        useEffect(() => {
            if (autoFocus && selectedSatellite && satelliteData[selectedSatellite]) {
                const { latitude, longitude } = satelliteData[selectedSatellite];
                map.setView([latitude, longitude], map.getZoom());
            }
        }, [map, autoFocus, selectedSatellite, satelliteData]);

        return null;
    };

    return (
        <div>
            <div id="info">
                <select id="satellite-select" value={selectedSatellite} onChange={(e) => setSelectedSatellite(e.target.value)}>
                    {Object.entries(satelliteData).map(([key, satellite]) => (
                        <option key={key} value={key}>
                            {satellite.name}
                        </option>
                    ))}
                </select>
                <label id="auto-focus-wrapper">
                    <input type="checkbox" id="auto-focus" checked={autoFocus} onChange={(e) => setAutoFocus(e.target.checked)} />
                    Auto Focus Satellite
                </label>
                {selectedSatellite && (
                    <div id="satellite-info">
                        <div className="satellite-info-item">
                            <label>Latitude</label>
                            <span>{satelliteData[selectedSatellite]?.latitude.toFixed(2)}</span>
                        </div>
                        <div className="satellite-info-item">
                            <label>Longitude</label>
                            <span>{satelliteData[selectedSatellite]?.longitude.toFixed(2)}</span>
                        </div>
                        <div className="satellite-info-item">
                            <label>Altitude</label>
                            <span>{satelliteData[selectedSatellite]?.altitude.toFixed(2)} km</span>
                        </div>
                        <div className="satellite-info-item">
                            <label>Speed</label>
                            <span>{satelliteData[selectedSatellite]?.speed.toFixed(2)} km/s</span>
                        </div>
                    </div>
                )}
            </div>
            <MapContainer id="map" center={[23.685, 90.3563]} zoom={3} minZoom={2} maxZoom={10}>
                <BasemapLayer name="Topographic" />
                {selectedSatellite && satelliteData[selectedSatellite] && (
                    <Marker position={[satelliteData[selectedSatellite].latitude, satelliteData[selectedSatellite].longitude]} icon={satelliteIcon}>
                        <Popup>
                            <strong>{satelliteData[selectedSatellite].name}</strong>
                            <br />
                            Lat: {satelliteData[selectedSatellite].latitude.toFixed(2)}
                            <br />
                            Lon: {satelliteData[selectedSatellite].longitude.toFixed(2)}
                            <br />
                            Alt: {satelliteData[selectedSatellite].altitude.toFixed(2)} km
                            <br />
                            Speed: {satelliteData[selectedSatellite].speed.toFixed(2)} km/s
                        </Popup>
                    </Marker>
                )}
                <MapEvents />
            </MapContainer>
        </div>
    );
};

export default SatelliteTracker;
