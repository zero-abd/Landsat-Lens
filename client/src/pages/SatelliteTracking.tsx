import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SatRec } from 'satellite.js';
import { loadTles, toSatrec, stateAt, groundTrack, periodMinutes, type Tle, type SatState } from '../lib/orbit';

const COLORS: Record<string, string> = { landsat_8: '#f59e0b', landsat_9: '#22d3ee' };
// Draw every layer on three world copies so tracks and markers stay visible after panning across the antimeridian.
const WORLD_OFFSETS = [-360, 0, 360];
const shift = (line: [number, number][], dx: number): [number, number][] => line.map(([lat, lng]) => [lat, lng + dx]);

const satIcon = (color: string) =>
    L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 0 2px ${color}88,0 0 12px ${color}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
    });

interface Tracked {
    tle: Tle;
    satrec: SatRec;
}

const FollowSatellite: React.FC<{ position: SatState | null; enabled: boolean }> = ({ position, enabled }) => {
    const map = useMap();
    useEffect(() => {
        if (!enabled || !position) return;
        const c = map.getCenter().lng;
        const lng = position.lng + 360 * Math.round((c - position.lng) / 360);
        map.panTo([position.lat, lng], { animate: true });
    }, [map, enabled, position]);
    return null;
};

const SatelliteTracker: React.FC = () => {
    const [tracked, setTracked] = useState<Tracked[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<string>('landsat_9');
    const [autoFocus, setAutoFocus] = useState<boolean>(true);
    const [now, setNow] = useState<Date>(new Date());

    useEffect(() => {
        loadTles()
            .then((tles) => setTracked(tles.map((tle) => ({ tle, satrec: toSatrec(tle) }))))
            .catch((e) => setError(`Could not load orbital elements from Celestrak: ${e.message}`));
    }, []);

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const states = useMemo(() => {
        const out: Record<string, SatState | null> = {};
        tracked.forEach((t) => (out[t.tle.id] = stateAt(t.satrec, now)));
        return out;
    }, [tracked, now]);

    // Recompute the ground tracks once a minute: one orbit behind and one ahead.
    const minuteKey = Math.floor(now.getTime() / 60000);
    const tracks = useMemo(() => {
        const out: Record<string, { past: [number, number][]; future: [number, number][] }> = {};
        const center = new Date(minuteKey * 60000);
        tracked.forEach((t) => {
            const p = periodMinutes(t.satrec);
            out[t.tle.id] = { past: groundTrack(t.satrec, center, -p, 0), future: groundTrack(t.satrec, center, 0, p) };
        });
        return out;
    }, [tracked, minuteKey]);

    const current = tracked.find((t) => t.tle.id === selected);
    const state = states[selected] ?? null;
    const epoch = current ? tleEpoch(current.tle.line1) : null;

    return (
        <div className="relative">
            <div id="info">
                <h2 className="text-lg font-bold mb-2">Live Landsat tracking</h2>
                {error && <p className="text-danger mb-2">{error}</p>}
                {!error && tracked.length === 0 && <p>Loading orbital elements…</p>}
                {tracked.length > 0 && (
                    <>
                        <select id="satellite-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                            {tracked.map((t) => (
                                <option key={t.tle.id} value={t.tle.id}>
                                    {titleCase(t.tle.name)}
                                </option>
                            ))}
                        </select>
                        <label id="auto-focus-wrapper">
                            <input type="checkbox" id="auto-focus" checked={autoFocus} onChange={(e) => setAutoFocus(e.target.checked)} />
                            Follow the selected satellite
                        </label>
                        {state && (
                            <div id="satellite-info">
                                <Row label="Latitude" value={`${state.lat.toFixed(3)}°`} />
                                <Row label="Longitude" value={`${state.lng.toFixed(3)}°`} />
                                <Row label="Altitude" value={`${state.altitudeKm.toFixed(1)} km`} />
                                <Row label="Speed" value={`${state.speedKmS.toFixed(2)} km/s`} />
                                {current && <Row label="Period" value={`${periodMinutes(current.satrec).toFixed(1)} min`} />}
                            </div>
                        )}
                        <div className="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            <div className="flex gap-3">
                                {tracked.map((t) => (
                                    <span key={t.tle.id} className="flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: COLORS[t.tle.id] }} />
                                        {titleCase(t.tle.name)}
                                    </span>
                                ))}
                            </div>
                            <p>Solid line: next orbit. Dashed: last orbit.</p>
                            <p>
                                Positions are computed in your browser with SGP4 (satellite.js) from Celestrak TLEs
                                {epoch ? `, epoch ${epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC` : ''}.
                            </p>
                        </div>
                    </>
                )}
            </div>
            <MapContainer id="map" center={[20, 0]} zoom={2} minZoom={2} maxZoom={10}>
                <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
                />
                <TileLayer url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                {tracked.map((t) => {
                    const tr = tracks[t.tle.id];
                    const s = states[t.tle.id];
                    const color = COLORS[t.tle.id] || '#fff';
                    return (
                        <React.Fragment key={t.tle.id}>
                            {tr &&
                                WORLD_OFFSETS.map((dx) => (
                                    <React.Fragment key={dx}>
                                        <Polyline positions={shift(tr.past, dx)} pathOptions={{ color, weight: 2, opacity: 0.6, dashArray: '4 6' }} />
                                        <Polyline positions={shift(tr.future, dx)} pathOptions={{ color, weight: 2.5, opacity: 0.95 }} />
                                    </React.Fragment>
                                ))}
                            {s &&
                                WORLD_OFFSETS.map((dx) => (
                                <Marker key={dx} position={[s.lat, s.lng + dx]} icon={satIcon(color)} eventHandlers={{ click: () => setSelected(t.tle.id) }}>
                                    <Popup>
                                        <strong>{titleCase(t.tle.name)}</strong>
                                        <br />
                                        {s.lat.toFixed(2)}°, {s.lng.toFixed(2)}°
                                        <br />
                                        {s.altitudeKm.toFixed(1)} km · {s.speedKmS.toFixed(2)} km/s
                                    </Popup>
                                </Marker>
                                ))}
                        </React.Fragment>
                    );
                })}
                <FollowSatellite position={state} enabled={autoFocus} />
            </MapContainer>
        </div>
    );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="satellite-info-item">
        <label>{label}</label>
        <span>{value}</span>
    </div>
);

function titleCase(s: string) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** TLE line 1 columns 19-32: epoch year (2 digits) and fractional day of year. */
function tleEpoch(line1: string): Date | null {
    const yy = parseInt(line1.slice(18, 20), 10);
    const doy = parseFloat(line1.slice(20, 32));
    if (Number.isNaN(yy) || Number.isNaN(doy)) return null;
    const year = yy < 57 ? 2000 + yy : 1900 + yy;
    return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86_400_000);
}

export default SatelliteTracker;
