// Landsat 8 and Landsat 9 each revisit every WRS-2 path on a fixed 16-day cycle,
// offset from each other by 8 days. The per-path phase below was derived from the
// USGS acquisition calendar (landsat.usgs.gov .../landsat_acq/assets/json/cycles_full.json,
// 2025 entries, every path repeats exactly every 16 days) as
// (last 2025 acquisition date - 2025-01-01) mod 16. Index 0 is WRS path 1.
// Checked against scenes published in 2026 on the Planetary Computer STAC API.

const EPOCH_UTC = Date.UTC(2025, 0, 1);
const DAY_MS = 86_400_000;

// prettier-ignore
const PHASE: Record<'landsat_8' | 'landsat_9', number[]> = {
    landsat_8: [13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6],
    landsat_9: [5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14,5,12,3,10,1,8,15,6,13,4,11,2,9,0,7,14],
};

/** Next predicted daytime acquisition dates (UTC, today included) of a WRS-2 path by one satellite. */
export function nextAcquisitions(satellite: 'landsat_8' | 'landsat_9', path: number, count = 3, from = new Date()): Date[] {
    const phase = PHASE[satellite][path - 1];
    if (phase === undefined) return [];
    const today = Math.floor((Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()) - EPOCH_UTC) / DAY_MS);
    const first = today + ((((phase - today) % 16) + 16) % 16);
    return Array.from({ length: count }, (_, i) => new Date(EPOCH_UTC + (first + 16 * i) * DAY_MS));
}

export function formatUtcDate(d: Date): string {
    return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
