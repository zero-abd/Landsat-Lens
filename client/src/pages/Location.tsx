import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, ImageOverlay } from 'react-leaflet';
import * as L from 'leaflet';
import Swal from 'sweetalert2';
import 'leaflet/dist/leaflet.css';
import '../custom.css';
import IconChecks from '../components/Icon/IconChecks';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../misc/firebase-config';
import { useAuth } from '../misc/auth-context';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const landsatDataURL = 'http://localhost:5000/get_landsat_data';

const mapServiceURL = 'https://nimbus.cr.usgs.gov/arcgis/rest/services/LLook_Outlines/MapServer/1/';

const clickMarkerIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    shadowSize: [41, 41],
});

const CustomDateInput = React.forwardRef(({ value, onClick }: any, ref) => (
    <input className="border border-gray-400 px-2 py-1 w-full outline-none rounded-md" onClick={onClick} value={value} readOnly ref={ref as any} />
));
const Location: React.FC = () => {
    const [wrsFeatures, setWrsFeatures] = useState<GeoJSON.FeatureCollection | null>(null);
    const [clickedCoordinate, setClickedCoordinate] = useState<[number, number] | null>(null);
    const [showLastAqData, setShowLastAqData] = useState<boolean>(false);
    const [snackbar, setSnackbar] = useState<string | null>(null);
    const [selectedSceneMode, setSelectedSceneMode] = useState<number>(0);
    const [currentBlockBounds, setCurrentBlockBounds] = useState<L.LatLngBounds | null>(null);
    const [cachedNextAquisitionDates, setCachedNextAquisitionDates] = useState<any[]>([]);
    const [nextAquisitionDates, setNextAquisitionDates] = useState<any[]>([]);
    const [isAquisitionDateLoading, setIsAquisitionDateLoading] = useState<boolean>(false);
    const [remindersList, setRemindersList] = useState<any[]>([]);
    const [startDate, setStartDate] = useState<Date | null>(new Date('2024-09-01')); // Start date
    const [endDate, setEndDate] = useState<Date | null>(new Date('2024-10-01')); // End date
    const [cloudCover, setCloudCover] = useState<number>(30); // Cloud cover
    const [imageUrl, setImageUrl] = useState<string | null>(null); // Image URL after fetching data

    const [isLoading, setIsLoading] = useState(false);

    const { currentUser } = useAuth();

    const showSnackbar = (message: string) => {
        setSnackbar(message);
        setTimeout(() => {
            setSnackbar(null);
        }, 3000);
    };

    useEffect(() => {
        (async function () {
            if (currentUser?.email) {
                try {
                    const docRef = doc(db, 'reminders', currentUser?.email as string);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setRemindersList(docSnap.data()?.all);
                    }
                } catch (error) {
                    console.error('Error fetching reminders:', error);
                }
            }
        })();
    }, [currentUser]);

    const generateKeyUsingPaths = () => {
        return wrsFeatures?.features.map((feature) => feature.properties?.PATH).join('-');
    };

    const isReminderEnabled = () => {
        const key = generateKeyUsingPaths();
        return remindersList.find((element) => element.key === key);
    };

    const fetchLandsatImageData = async () => {
        if (!startDate || !endDate || !clickedCoordinate) {
            showSnackbar('Please select start and end dates and a location on the map.');
            return;
        }

        setIsLoading(true);

        try {
            const [lat, lng] = clickedCoordinate;
            const url = `${landsatDataURL}?start_date=${startDate.toISOString().split('T')[0]}&end_date=${
                endDate.toISOString().split('T')[0]
            }&num_scenes=1&cloud_cover=${cloudCover}&latitude=${lat}&longitude=${lng}`;
            const response = await fetch(url);
            const imageBlob = await response.blob();

            const imageUrl = URL.createObjectURL(imageBlob);
            setImageUrl(imageUrl);
        } catch (error) {
            console.error('Error fetching Landsat image data:', error);
            showSnackbar('Error fetching Landsat image data.');
        } finally {
            setIsLoading(false);
            handleShowLastAqStatusChange();
        }
    };

    const handleShowLastAqStatusChange = () => {
        setShowLastAqData((prev) => !prev);
    };

    const handleNotificationStatusChange = useCallback(async () => {
        const key = generateKeyUsingPaths();
        let newList = null;
        if (isReminderEnabled()) {
            newList = remindersList.filter((element) => element.key !== key);
        } else {
            if (!clickedCoordinate) {
                showSnackbar('Please select a location first.');
                return;
            }

            const [latitude, longitude] = clickedCoordinate;

            newList = [
                ...remindersList,
                {
                    key: key,
                    dates: nextAquisitionDates,
                    latitude: latitude,
                    longitude: longitude,
                },
            ];
        }
        try {
            const email = currentUser?.email;
            const docRef = doc(db, 'reminders', email as string);
            console.log('Updating reminders:', newList);
            await setDoc(docRef, { all: newList });
            setRemindersList(newList);
            if (!isReminderEnabled()) {
                Swal.fire({
                    text: 'You will be reminded 1 day before the next acquisition date.',
                    icon: 'success',
                    timer: 10000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                });
            }
        } catch (error) {
            console.error('Error fetching WRS data:', error);
            showSnackbar('Error updating reminder');
        }
    }, [cachedNextAquisitionDates, currentUser, nextAquisitionDates, remindersList, clickedCoordinate]);

    const handleSceneModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedSceneMode(parseInt(event.target.value));
    };

    const styleWRS = (feature: any) => {
        return {
            color: feature.properties.MODE === 'D' ? 'blue' : 'green',
            weight: 2,
            opacity: 0.65,
        };
    };

    useEffect(() => {
        if (wrsFeatures) {
            const bounds = L.geoJSON(wrsFeatures).getBounds();
            setCurrentBlockBounds(bounds);
        }
    }, [wrsFeatures]);

    const showFootPrint = useCallback(async (features: any[]) => {
        try {
            const geoJsonData: GeoJSON.FeatureCollection = {
                type: 'FeatureCollection',
                features: features.map((feature: any) => ({
                    type: 'Feature',
                    geometry: feature.geometry,
                    properties: feature.properties,
                })),
            };
            setWrsFeatures(geoJsonData);
            setShowLastAqData(false);
        } catch (error) {
            console.error('Error processing WRS features:', error);
            setWrsFeatures(null);
        }
    }, []);

    const handleFetchAquisitionDate = useCallback(async (path: number) => {
        try {
            console.log('11111');
            console.log(path);
            setIsAquisitionDateLoading(true);
            const response = await fetch(`http://127.0.0.1:5000/next-acq-date?path=${path}`);
            const data = await response.json();
            if (data && data.error) {
                throw new Error(data.error);
            }
            setIsAquisitionDateLoading(false);
            return data;
        } catch (error) {
            console.error('Error fetching WRS data:', error);
            setIsAquisitionDateLoading(false);
            return null;
        }
    }, []);

    const handleMapClick = useCallback(
        async (e: L.LeafletMouseEvent) => {
            setWrsFeatures(null);
            const { lat, lng } = e.latlng;
            setClickedCoordinate([lat, lng]);
            setImageUrl(null);

            const url = `${mapServiceURL}query?where=MODE='D'&geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=true&returnTrueCurves=false&returnIdsOnly=false&returnCountOnly=false&returnZ=false&returnM=false&returnDistinctValues=false&f=geojson`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                console.log('Fetch response:', data);

                if (data.features && data.features.length > 0) {
                    await showFootPrint(data.features);
                } else {
                    console.log('No features found at this location');
                }
            } catch (error) {
                console.error('Error fetching WRS data:', error);
            }
        },
        [showFootPrint]
    );

    const MapEvents: React.FC = () => {
        const map = useMap();
        useEffect(() => {
            map.on('click', handleMapClick);
            return () => {
                map.off('click', handleMapClick);
            };
        }, [map]);

        useEffect(() => {
            if (currentBlockBounds) {
                map.fitBounds(currentBlockBounds);
            }
        }, [map, currentBlockBounds, showLastAqData, selectedSceneMode]);

        useEffect(() => {
            const mapElement = document.getElementById('map');
            if (mapElement) {
                mapElement.style.cursor = 'url(https://maps.gstatic.com/mapfiles/ms2/micons/red-pushpin.png), auto';
            }
        }, []);

        useEffect(() => {
            const mapElement = document.querySelector('.leaflet-control-attribution') as HTMLElement;
            if (mapElement) {
                mapElement.style.display = 'none';
            }
        }, []);

        return null;
    };

    useEffect(() => {
        (async function () {
            setNextAquisitionDates([]);
            const features = wrsFeatures?.features;
            if (!features) return;
            const dates = [];
            console.log(features);
            for (let i = 0; i < features.length; i++) {
                const path = features[i].properties?.PATH;
                if (path) {
                    var date = cachedNextAquisitionDates.find((element: any) => String(element.path) === String(path));
                    if (date) {
                        console.log('Found');
                        dates.push(date);
                    } else {
                        const d = await handleFetchAquisitionDate(path);
                        if (d) {
                            dates.push(d);
                            setCachedNextAquisitionDates((prev) => [...prev, { path: path, ...d }]);
                        }
                    }
                }
            }
            if (dates.length == features.length) {
                setNextAquisitionDates(dates);
            }
        })();
    }, [wrsFeatures]);

    return (
        <div>
            <div id="info">
                {wrsFeatures && (
                    <div>
                        <div>
                            <p>Start Date:</p>
                            <DatePicker
                                selected={startDate}
                                onChange={(date: Date | null) => setStartDate(date)}
                                dateFormat="yyyy-MM-dd"
                                placeholderText="Select start date"
                                customInput={<CustomDateInput />}
                            />
                        </div>

                        <div className="mt-2">
                            <p className="mb-1">End Date:</p>
                            <DatePicker
                                selected={endDate}
                                onChange={(date: Date | null) => setEndDate(date)}
                                dateFormat="yyyy-MM-dd"
                                placeholderText="Select end date"
                                customInput={<CustomDateInput />}
                            />
                        </div>

                        <div className="mt-2">
                            <p className="mb-1">Cloud Coverage: {cloudCover}%</p>
                            <input type="range" min="0" max="100" value={cloudCover} onChange={(e) => setCloudCover(Number(e.target.value))} className="w-full" />
                        </div>

                        <button
                            className="bg-slate-100 hover:bg-slate-200 transition-all border-slate-400 shadow-sm border font-bold px-2 py-1 mt-3 rounded-md w-full"
                            onClick={
                                showLastAqData
                                    ? () => {
                                          handleShowLastAqStatusChange();
                                      }
                                    : () => {
                                          fetchLandsatImageData();
                                      }
                            }
                            disabled={isLoading}
                        >
                            {isLoading ? 'Loading...' : showLastAqData ? 'Hide Last Acquisition Data' : 'See Last Acquisition Data'}
                        </button>

                        <hr className="h-px w-full my-3 bg-slate-600" />
                        <div className="flex gap-1 flex-col relative">
                            <span className="font-bold">Next Acquisition Date: </span>
                            {isAquisitionDateLoading ? (
                                <span className="size-4 border-2 border-r-slate-100 rounded-full border-slate-600 animate-spin absolute right-1 bottom-1"></span>
                            ) : (
                                nextAquisitionDates.length > 0 && (
                                    <ul className="flex flex-col">
                                        {...nextAquisitionDates.map((date, i) => {
                                            return (
                                                <li key={i} className="flex flex-col">
                                                    <div>
                                                        <span className="font-bold">Landsat 8: </span>
                                                        {date.landsat_8}
                                                    </div>
                                                    <div>
                                                        <span className="font-bold">Landsat 9: </span>
                                                        {date.landsat_9}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )
                            )}
                        </div>
                        {nextAquisitionDates.length > 0 && (
                            <button
                                className="bg-slate-100 hover:bg-slate-200 transition-all border-slate-400 shadow-sm border font-bold px-2 py-1 mt-3 rounded-md w-full"
                                onClick={() => handleNotificationStatusChange()}
                            >
                                {isReminderEnabled() ? 'Turn off reminder' : 'Remind Me'}
                            </button>
                        )}
                    </div>
                )}

                {!wrsFeatures && <p>Select a location on the map</p>}
            </div>
            <MapContainer id="map" center={[23.685, 90.3563]} zoom={3} minZoom={2} maxZoom={10} className="h-screen">
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                {!showLastAqData && wrsFeatures && <GeoJSON data={wrsFeatures} style={styleWRS} />}
                {clickedCoordinate && (
                    <Marker position={clickedCoordinate} icon={clickMarkerIcon}>
                        <Popup>
                            Clicked Location
                            <br />
                            Lat: {clickedCoordinate[0].toFixed(4)}
                            <br />
                            Lon: {clickedCoordinate[1].toFixed(4)}
                        </Popup>
                    </Marker>
                )}
                {showLastAqData && currentBlockBounds && <ImageOverlay url={imageUrl || ''} bounds={currentBlockBounds} className="img_overlay" />}
                <MapEvents />
            </MapContainer>
            {snackbar && (
                <div className="absolute bottom-6 right-6 rounded-md px-4 py-2 z-[99999] bg-black text-white">
                    <IconChecks className="w-6 h-6 inline-block mr-2" />
                    {snackbar}
                </div>
            )}
        </div>
    );
};

export default Location;
