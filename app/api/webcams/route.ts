import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = process.env.WINDY_WEBCAMS_KEY;
const BASE = 'https://api.windy.com/webcams/api/v3/webcams';

// Cache for just under the free-tier token expiry (10 min)
let cache: { data: any[]; expires: number } = { data: [], expires: 0 };

function normaliseWebcam(w: any) {
  return {
    id: `webcam:${w.webcamId}`,
    webcamId: String(w.webcamId),
    title: w.title ?? 'Webcam',
    lat: w.location?.latitude,
    lon: w.location?.longitude,
    city: w.location?.city ?? '',
    country: w.location?.country ?? '',
    preview: w.images?.current?.preview ?? w.images?.daylight?.preview ?? null,
    detailUrl: w.urls?.detail ?? null,
  };
}

async function fetchRegion(params: string): Promise<any[]> {
  const url = `${BASE}?${params}&limit=50&include=location,images,urls`;
  const res = await fetch(url, {
    headers: { 'x-windy-api-key': KEY! },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Windy ${res.status}`);
  const json = await res.json();
  return (json.webcams ?? []).map(normaliseWebcam).filter((w: any) => w.lat && w.lon);
}

export async function GET() {
  if (!KEY) return NextResponse.json({ webcams: [], error: 'WINDY_WEBCAMS_KEY not set' });
  if (cache.expires > Date.now()) return NextResponse.json({ webcams: cache.data });

  try {
    // Fetch two regions in parallel: Middle East + Eastern Europe
    const [midEast, eastEurope] = await Promise.allSettled([
      fetchRegion('north=55&south=10&west=25&east=65'),
      fetchRegion('north=58&south=44&west=20&east=50'),
    ]);

    const seen = new Set<string>();
    const webcams: any[] = [];

    const add = (list: any[]) => {
      for (const w of list) {
        if (!seen.has(w.id)) { seen.add(w.id); webcams.push(w); }
      }
    };

    if (midEast.status === 'fulfilled') add(midEast.value);
    if (eastEurope.status === 'fulfilled') add(eastEurope.value);

    // If both region queries failed, fall back to global popular webcams
    if (webcams.length === 0) {
      const fallback = await fetchRegion('limit=50');
      add(fallback);
    }

    cache = { data: webcams, expires: Date.now() + 9 * 60_000 };
    return NextResponse.json({ webcams });
  } catch (err: any) {
    console.error('Windy webcam fetch failed:', err.message);
    return NextResponse.json({ webcams: cache.data, error: err.message });
  }
}
