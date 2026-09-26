import { twoline2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong, type SatRec } from 'satellite.js';

export interface Tle {
    id: string;
    catnr: number;
    name: string;
    line1: string;
    line2: string;
}

export interface SatState {
    lat: number;
    lng: number;
    altitudeKm: number;
    speedKmS: number;
}

const CELESTRAK = (catnr: number) => `https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=TLE`;
const FALLBACK = [
    { id: 'landsat_8', catnr: 39084 },
    { id: 'landsat_9', catnr: 49260 },
];

function parseTle(text: string) {
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter(Boolean);
    if (lines.length < 3 || !lines[1].startsWith('1 ') || !lines[2].startsWith('2 ')) throw new Error('Bad TLE');
    return { name: lines[0].trim(), line1: lines[1], line2: lines[2] };
}

/** Loads Landsat 8/9 TLEs from our cached /api/tle route, or straight from Celestrak (CORS-enabled) if the route is unavailable. */
export async function loadTles(): Promise<Tle[]> {
    try {
        const res = await fetch('/api/tle');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.satellites) && data.satellites.length) return data.satellites;
        }
    } catch {
        /* fall through to Celestrak */
    }
    return Promise.all(
        FALLBACK.map(async (s) => {
            const res = await fetch(CELESTRAK(s.catnr));
            if (!res.ok) throw new Error(`Celestrak returned ${res.status}`);
            return { ...s, ...parseTle(await res.text()) };
        })
    );
}

export function toSatrec(tle: Tle): SatRec {
    return twoline2satrec(tle.line1, tle.line2);
}

export function stateAt(satrec: SatRec, date: Date): SatState | null {
    const pv = propagate(satrec, date);
    if (!pv || !pv.position || !pv.velocity) return null;
    const geo = eciToGeodetic(pv.position, gstime(date));
    const v = pv.velocity;
    return {
        lat: degreesLat(geo.latitude),
        lng: degreesLong(geo.longitude),
        altitudeKm: geo.height,
        speedKmS: Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
    };
}

/** Orbital period in minutes, from the mean motion in the TLE (rad/min). */
export function periodMinutes(satrec: SatRec): number {
    return (2 * Math.PI) / satrec.no;
}

/**
 * Sub-satellite ground track between `fromMin` and `toMin` minutes around `center`.
 * Longitudes are unwrapped into one continuous line (they may run past +/-180),
 * and the map draws copies shifted by 360 degrees so the track reads across the antimeridian.
 */
export function groundTrack(satrec: SatRec, center: Date, fromMin: number, toMin: number, stepSec = 30): [number, number][] {
    const line: [number, number][] = [];
    let offset = 0;
    let prevLng: number | null = null;
    for (let t = fromMin * 60; t <= toMin * 60; t += stepSec) {
        const s = stateAt(satrec, new Date(center.getTime() + t * 1000));
        if (!s) continue;
        if (prevLng !== null) {
            if (s.lng - prevLng > 180) offset -= 360;
            else if (s.lng - prevLng < -180) offset += 360;
        }
        prevLng = s.lng;
        line.push([s.lat, s.lng + offset]);
    }
    return line;
}
