import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// UCDP GED — Georeferenced Event Dataset, free, no key
const BASE = 'https://ucdpapi.pcr.uu.se/api';
let cache: { data: any; expires: number } | null = null;

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') ?? '200';

  if (cache && cache.expires > Date.now()) return NextResponse.json(cache.data);

  try {
    // Get recent events — use latest available dataset version
    const today     = new Date();
    const startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    // Try latest version (24.1), fall back to 23.1
    let res = await fetch(
      `${BASE}/gedevents/24.1?pagesize=${limit}&StartDate=${startDate}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) {
      res = await fetch(
        `${BASE}/gedevents/23.1?pagesize=${limit}&StartDate=${startDate}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }
      );
    }
    if (!res.ok) throw new Error(`UCDP ${res.status}`);
    const json = await res.json();

    const events = (json.Result ?? []).map((e: any) => ({
      id:               `ucdp-${e.id}`,
      lat:              parseFloat(e.latitude ?? 0),
      lon:              parseFloat(e.longitude ?? 0),
      event:            e.conflict_name ?? e.dyad_name ?? 'Conflict event',
      region:           e.country ?? e.region ?? '',
      actor:            [e.side_a, e.side_b].filter(Boolean).join(' vs '),
      date:             e.date_start ?? e.year,
      timestamp:        e.date_start ?? String(e.year),
      deaths:           (e.best ?? 0) as number,
      deathsLow:        e.low ?? 0,
      deathsHigh:       e.high ?? 0,
      deathsCivilian:   e.deaths_civilians ?? 0,
      eventType:        e.type_of_violence === 1 ? 'State conflict'
                      : e.type_of_violence === 2 ? 'Non-state conflict'
                      : e.type_of_violence === 3 ? 'One-sided violence'
                      : 'Conflict',
      source:           'UCDP',
      goldstein:        null,
      url:              null,
    })).filter((e: any) => !isNaN(e.lat) && !isNaN(e.lon) && e.lat !== 0 && e.lon !== 0);

    const payload = { events, count: events.length };
    cache = { data: payload, expires: Date.now() + 30 * 60_000 };
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ events: [], count: 0, error: err.message }, { status: 500 });
  }
}
