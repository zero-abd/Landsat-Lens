import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, useMapEvents } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { searchScenes, sceneTileUrl, pixelValues, isoDate, type Scene, type PixelValues } from '../lib/stac';
import { nextAcquisitions, formatUtcDate } from '../lib/acquisition';

const clickMarkerIcon = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    shadowSize: [41, 41],
});

const daysAgo = (n: number) => isoDate(new Date(Date.now() - n * 86_400_000));

const ClickHandler: React.FC<{ onClick: (lat: number, lng: number) => void }> = ({ onClick }) => {
    useMapEvents({ click: (e) => onClick(e.latlng.lat, L.Util.wrapNum(e.latlng.lng, [-180, 180], true)) });
    return null;
};

const FitScene: React.FC<{ scene: Scene | null }> = ({ scene }) => {
    const map = useMap();
    useEffect(() => {
        if (scene) map.fitBounds(L.geoJSON(scene.geometry as any).getBounds(), { padding: [30, 30], maxZoom: 9 });
    }, [map, scene]);
    return null;
};

const Location: React.FC = () => {
    const [point, setPoint] = useState<[number, number] | null>(null);
    const [maxCloud, setMaxCloud] = useState<number>(30);
    const [start, setStart] = useState<string>(daysAgo(365));
    const [end, setEnd] = useState<string>(daysAgo(0));
    const [scenes, setScenes] = useState<Scene[]>([]);
    const [sceneIdx, setSceneIdx] = useState<number>(0);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pixel, setPixel] = useState<PixelValues | null>(null);
    const [pixelError, setPixelError] = useState<string | null>(null);
    const [pixelLoading, setPixelLoading] = useState(false);
    const [showOnMap, setShowOnMap] = useState(true);
    const [tileUrl, setTileUrl] = useState<string | null>(null);
    const searchAbort = useRef<AbortController | null>(null);

    const scene = scenes[sceneIdx] ?? null;

    const runSearch = useCallback(
        async (lat: number, lng: number) => {
            searchAbort.current?.abort();
            const ctrl = new AbortController();
            searchAbort.current = ctrl;
            setSearching(true);
            setError(null);
            setScenes([]);
            setSceneIdx(0);
            setPixel(null);
            setPixelError(null);
            try {
                const found = await searchScenes({ lat, lng, maxCloud, start, end }, ctrl.signal);
                setScenes(found);
                if (!found.length) setError('No Landsat 8/9 scenes match these filters here. Try a higher cloud limit or a wider date range.');
            } catch (e: any) {
                if (e.name !== 'AbortError') setError(e.message || 'Scene search failed');
            } finally {
                if (!ctrl.signal.aborted) setSearching(false);
            }
        },
        [maxCloud, start, end]
    );

    const onMapClick = useCallback(
        (lat: number, lng: number) => {
            setPoint([lat, lng]);
            runSearch(lat, lng);
        },
        [runSearch]
    );

    // Pixel values and map tiles for the selected scene.
    useEffect(() => {
        if (!scene || !point) return;
        const ctrl = new AbortController();
        setPixel(null);
        setPixelError(null);
        setPixelLoading(true);
        setTileUrl(null);
        pixelValues(scene, point[0], point[1], ctrl.signal)
            .then(setPixel)
            .catch((e) => e.name !== 'AbortError' && setPixelError(e.message))
            .finally(() => !ctrl.signal.aborted && setPixelLoading(false));
        sceneTileUrl(scene, ctrl.signal)
            .then(setTileUrl)
            .catch(() => undefined);
        return () => ctrl.abort();
    }, [scene, point]);

    return (
        <div className="relative">
            <div id="info" className="scene-panel">
                <h2 className="text-lg font-bold mb-1">Landsat scene explorer</h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Click anywhere on the map to find the latest Landsat 8/9 surface reflectance scene over that spot.</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex flex-col gap-1">
                        From
                        <input type="date" className="form-input py-1 px-2 text-xs" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1">
                        To
                        <input type="date" className="form-input py-1 px-2 text-xs" value={end} min={start} max={daysAgo(0)} onChange={(e) => setEnd(e.target.value)} />
                    </label>
                </div>
                <label className="block text-xs mt-2">
                    Max cloud cover: {maxCloud}%
                    <input type="range" min={0} max={100} value={maxCloud} onChange={(e) => setMaxCloud(Number(e.target.value))} className="w-full" />
                </label>
                {point && (
                    <button className="scene-btn mt-1" onClick={() => runSearch(point[0], point[1])} disabled={searching}>
                        {searching ? 'Searching…' : 'Search again with these filters'}
                    </button>
                )}

                {!point && <p className="mt-3 font-semibold">Select a location on the map.</p>}
                {searching && <p className="mt-3">Searching the Planetary Computer catalog…</p>}
                {error && <p className="mt-3 text-danger">{error}</p>}

                {scene && (
                    <div className="mt-3 space-y-3">
                        <div>
                            <label className="text-xs font-semibold">Scene ({scenes.length} found, newest first)</label>
                            <select id="satellite-select" className="!mb-0" style={{ fontSize: '0.8em', padding: '6px 8px' }} value={sceneIdx} onChange={(e) => setSceneIdx(Number(e.target.value))}>
                                {scenes.map((s, i) => (
                                    <option key={s.id} value={i}>
                                        {s.datetime.slice(0, 10)} · {s.platform.replace('landsat-', 'Landsat ')} · {s.cloudCover.toFixed(0)}% cloud
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="text-xs space-y-0.5">
                            <div className="satellite-info-item">
                                <label>Acquired</label>
                                <span>{new Date(scene.datetime).toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
                            </div>
                            <div className="satellite-info-item">
                                <label>WRS-2</label>
                                <span>
                                    Path {scene.wrsPath} / Row {scene.wrsRow}
                                </span>
                            </div>
                            <div className="satellite-info-item">
                                <label>Scene ID</label>
                                <span className="truncate" title={scene.id}>
                                    {scene.id}
                                </span>
                            </div>
                        </div>

                        {scene.previewUrl && (
                            <a href={scene.previewUrl} target="_blank" rel="noreferrer" title="Open the full-size true-color preview">
                                <img src={`${scene.previewUrl}&max_size=360`} alt={`True-color preview of ${scene.id}`} className="w-full max-h-48 object-contain rounded-lg" loading="lazy" />
                            </a>
                        )}
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={showOnMap} onChange={(e) => setShowOnMap(e.target.checked)} />
                            Overlay the scene on the map
                        </label>

                        <div>
                            <h3 className="font-semibold text-sm mb-1">Surface reflectance at your point</h3>
                            {pixelLoading && <p className="text-xs">Reading pixel values…</p>}
                            {pixelError && <p className="text-xs text-danger">{pixelError}</p>}
                            {pixel && <Spectrum pixel={pixel} />}
                        </div>

                        <div>
                            <h3 className="font-semibold text-sm mb-1">Next predicted passes over path {scene.wrsPath}</h3>
                            <table className="w-full text-xs">
                                <tbody>
                                    {(['landsat_8', 'landsat_9'] as const).map((sat) => (
                                        <tr key={sat}>
                                            <td className="font-semibold pr-2 align-top">{sat === 'landsat_8' ? 'Landsat 8' : 'Landsat 9'}</td>
                                            <td>
                                                {nextAcquisitions(sat, scene.wrsPath, 2)
                                                    .map(formatUtcDate)
                                                    .join(' · ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <p className="text-[10px] text-gray-500 mt-1">From the USGS 16-day acquisition cycle (UTC dates, daytime passes).</p>
                        </div>
                    </div>
                )}
                <p className="text-[10px] text-gray-500 mt-3">
                    Data: USGS Landsat Collection 2 Level-2 via the{' '}
                    <a className="underline" href="https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2" target="_blank" rel="noreferrer">
                        Microsoft Planetary Computer
                    </a>
                    .
                </p>
            </div>

            <MapContainer id="map" center={[23.685, 90.3563]} zoom={4} minZoom={2} maxZoom={13} worldCopyJump>
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Basemap &copy; Esri, Maxar, Earthstar Geographics · Landsat: USGS/NASA via Microsoft Planetary Computer"
                />
                {scene && showOnMap && tileUrl && (
                    <TileLayer key={scene.id} url={tileUrl} bounds={L.latLngBounds([scene.bbox[1], scene.bbox[0]], [scene.bbox[3], scene.bbox[2]])} opacity={0.95} zIndex={5} />
                )}
                <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" zIndex={10} />
                {scene && <GeoJSON key={scene.id} data={scene.geometry as any} style={{ color: '#22d3ee', weight: 2, fillOpacity: 0 }} interactive={false} />}
                {point && (
                    <Marker position={point} icon={clickMarkerIcon}>
                        <Popup>
                            {point[0].toFixed(4)}, {point[1].toFixed(4)}
                        </Popup>
                    </Marker>
                )}
                <ClickHandler onClick={onMapClick} />
                <FitScene scene={scene} />
            </MapContainer>
        </div>
    );
};

const Spectrum: React.FC<{ pixel: PixelValues }> = ({ pixel }) => {
    const max = Math.max(0.5, ...pixel.reflectance.map((r) => r.value));
    return (
        <div className="text-xs">
            <div className="flex items-end gap-1 h-24 border-b border-gray-300 pb-px">
                {pixel.reflectance.map((r) => (
                    <div key={r.band} className="flex-1 flex flex-col items-center justify-end h-full" title={`${r.label} (${r.band}, ${r.nm} nm): ${r.value.toFixed(4)}`}>
                        <span className="text-[9px] mb-0.5">{r.value.toFixed(2)}</span>
                        <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(0, (r.value / max) * 100)}%` }} />
                    </div>
                ))}
            </div>
            <div className="flex gap-1 mt-0.5">
                {pixel.reflectance.map((r) => (
                    <span key={r.band} className="flex-1 text-center text-[9px] leading-tight">
                        {r.band}
                        <br />
                        {r.label}
                    </span>
                ))}
            </div>
            <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                <Stat label="NDVI" value={pixel.ndvi?.toFixed(3) ?? 'n/a'} />
                <Stat label="NDWI" value={pixel.ndwi?.toFixed(3) ?? 'n/a'} />
                <Stat label="Surface temp" value={pixel.surfaceTempC !== null ? `${pixel.surfaceTempC.toFixed(1)} °C` : 'n/a'} />
            </div>
            {pixel.qa.length > 0 && <p className="mt-1 text-[10px] text-gray-500">QA flags: {pixel.qa.join(', ')}</p>}
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="rounded-md bg-white-light/60 dark:bg-dark/60 p-1">
        <div className="text-[9px] text-gray-500">{label}</div>
        <div className="font-semibold">{value}</div>
    </div>
);

export default Location;
