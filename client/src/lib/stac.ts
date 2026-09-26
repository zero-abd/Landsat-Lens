// Landsat Collection 2 Level-2 scenes from the Microsoft Planetary Computer STAC API.
// Public and keyless: search, rendered previews, map tiles and pixel values all work
// without an account. https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2

const STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1';
const DATA = 'https://planetarycomputer.microsoft.com/api/data/v1';
const COLLECTION = 'landsat-c2-l2';

export interface Scene {
    id: string;
    datetime: string;
    platform: string;
    cloudCover: number;
    wrsPath: number;
    wrsRow: number;
    geometry: GeoJSON.Geometry;
    bbox: [number, number, number, number];
    previewUrl?: string;
    tilejsonUrl?: string;
}

export interface SearchOptions {
    lat: number;
    lng: number;
    maxCloud: number;
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
    limit?: number;
}

export async function searchScenes(o: SearchOptions, signal?: AbortSignal): Promise<Scene[]> {
    const res = await fetch(`${STAC}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            collections: [COLLECTION],
            intersects: { type: 'Point', coordinates: [o.lng, o.lat] },
            datetime: `${o.start}T00:00:00Z/${o.end}T23:59:59Z`,
            query: { platform: { in: ['landsat-8', 'landsat-9'] }, 'eo:cloud_cover': { lte: o.maxCloud } },
            sortby: [{ field: 'properties.datetime', direction: 'desc' }],
            limit: o.limit ?? 8,
        }),
    });
    if (!res.ok) throw new Error(`STAC search failed (${res.status})`);
    const data = await res.json();
    return (data.features || []).map((f: any) => ({
        id: f.id,
        datetime: f.properties.datetime,
        platform: f.properties.platform,
        cloudCover: f.properties['eo:cloud_cover'],
        wrsPath: Number(f.properties['landsat:wrs_path']),
        wrsRow: Number(f.properties['landsat:wrs_row']),
        geometry: f.geometry,
        bbox: f.bbox,
        previewUrl: f.assets?.rendered_preview?.href,
        tilejsonUrl: f.assets?.tilejson?.href,
    }));
}

export async function sceneTileUrl(scene: Scene, signal?: AbortSignal): Promise<string | null> {
    if (!scene.tilejsonUrl) return null;
    const res = await fetch(scene.tilejsonUrl, { signal });
    if (!res.ok) return null;
    const tj = await res.json();
    return tj.tiles?.[0] ?? null;
}

// Collection 2 Level-2 scale factors (USGS Landsat 8-9 C2 L2 Science Product Guide).
const SR = (dn: number) => dn * 0.0000275 - 0.2;
const ST_KELVIN = (dn: number) => dn * 0.00341802 + 149.0;

export const BANDS = [
    { asset: 'coastal', label: 'Coastal', band: 'B1', nm: 443 },
    { asset: 'blue', label: 'Blue', band: 'B2', nm: 482 },
    { asset: 'green', label: 'Green', band: 'B3', nm: 562 },
    { asset: 'red', label: 'Red', band: 'B4', nm: 655 },
    { asset: 'nir08', label: 'NIR', band: 'B5', nm: 865 },
    { asset: 'swir16', label: 'SWIR 1', band: 'B6', nm: 1609 },
    { asset: 'swir22', label: 'SWIR 2', band: 'B7', nm: 2201 },
] as const;

export interface PixelValues {
    reflectance: { band: string; label: string; nm: number; value: number }[];
    surfaceTempC: number | null;
    ndvi: number | null;
    ndwi: number | null;
    qa: string[];
}

function describeQa(qa: number): string[] {
    const flags: string[] = [];
    if (qa & 1) flags.push('fill');
    if (qa & (1 << 1)) flags.push('dilated cloud');
    if (qa & (1 << 2)) flags.push('cirrus');
    if (qa & (1 << 3)) flags.push('cloud');
    if (qa & (1 << 4)) flags.push('cloud shadow');
    if (qa & (1 << 5)) flags.push('snow');
    if (qa & (1 << 7)) flags.push('water');
    if (qa & (1 << 6) && flags.length === 0) flags.push('clear');
    return flags;
}

/** Surface reflectance (7 bands), surface temperature and QA flags at one point of one scene. */
export async function pixelValues(scene: Scene, lat: number, lng: number, signal?: AbortSignal): Promise<PixelValues> {
    const assets = [...BANDS.map((b) => b.asset), 'lwir11', 'qa_pixel'];
    const qs = new URLSearchParams({ collection: COLLECTION, item: scene.id });
    assets.forEach((a) => qs.append('assets', a));
    const res = await fetch(`${DATA}/item/point/${lng},${lat}?${qs}`, { signal });
    if (!res.ok) throw new Error(`Pixel query failed (${res.status})`);
    const data = await res.json();
    const values: number[] = data.values;
    if (!Array.isArray(values) || values.length < assets.length) throw new Error('No pixel values at this point');
    if (values.slice(0, BANDS.length).every((v) => !v)) throw new Error('This point is outside the imaged area of the scene');
    const reflectance = BANDS.map((b, i) => ({ band: b.band, label: b.label, nm: b.nm, value: SR(values[i]) }));
    const r = reflectance[3].value;
    const g = reflectance[2].value;
    const n = reflectance[4].value;
    const st = values[BANDS.length];
    return {
        reflectance,
        surfaceTempC: st ? ST_KELVIN(st) - 273.15 : null,
        ndvi: n + r !== 0 ? (n - r) / (n + r) : null,
        ndwi: g + n !== 0 ? (g - n) / (g + n) : null,
        qa: describeQa(values[BANDS.length + 1]),
    };
}

export function isoDate(d: Date) {
    return d.toISOString().slice(0, 10);
}
