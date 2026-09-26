// GET /api/tle
// Returns the current Celestrak TLEs for Landsat 8 and Landsat 9 only.
// The catalog numbers are fixed here, so this route cannot be used as a proxy.
// Celestrak refreshes elements a few times a day and asks clients not to
// re-download them more often, so the response is cached at the edge.

const SATELLITES = [
    { id: 'landsat_8', catnr: 39084 },
    { id: 'landsat_9', catnr: 49260 },
];

async function fetchTle(catnr: number) {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${catnr}&FORMAT=TLE`, {
        headers: { 'User-Agent': 'landsat-lens (github.com/zero-abd/Landsat-Lens)' },
    });
    if (!res.ok) throw new Error(`Celestrak returned ${res.status}`);
    const lines = (await res.text())
        .split(/\r?\n/)
        .map((l) => l.trimEnd())
        .filter(Boolean);
    if (lines.length < 3 || !lines[1].startsWith('1 ') || !lines[2].startsWith('2 ')) {
        throw new Error('Unexpected TLE format from Celestrak');
    }
    return { name: lines[0].trim(), line1: lines[1], line2: lines[2] };
}

export async function GET() {
    try {
        const tles = await Promise.all(SATELLITES.map(async (s) => ({ id: s.id, catnr: s.catnr, ...(await fetchTle(s.catnr)) })));
        return Response.json(
            { source: 'celestrak.org', fetchedAt: new Date().toISOString(), satellites: tles },
            { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=7200, stale-while-revalidate=86400' } }
        );
    } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : 'TLE fetch failed' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }
}
