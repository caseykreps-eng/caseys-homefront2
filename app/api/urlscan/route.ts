import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// URLScan.io — search existing scans free (no key), submit new scans requires free key
const BASE = 'https://urlscan.io/api/v1';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const q      = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const action = req.nextUrl.searchParams.get('action') ?? 'search'; // search | result
  const uuid   = req.nextUrl.searchParams.get('uuid') ?? '';

  if (action === 'result' && uuid) {
    try {
      const res  = await fetch(`${BASE}/result/${uuid}/`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`URLScan result ${res.status}`);
      const json = await res.json();
      return NextResponse.json({
        url:         json.page?.url,
        domain:      json.page?.domain,
        ip:          json.page?.ip,
        country:     json.page?.country,
        server:      json.page?.server,
        title:       json.page?.title,
        screenshot:  json.screenshot ?? `https://urlscan.io/screenshots/${uuid}.png`,
        malicious:   json.verdicts?.overall?.malicious ?? false,
        score:       json.verdicts?.overall?.score ?? 0,
        tags:        json.verdicts?.overall?.tags ?? [],
        technologies: (json.meta?.processors?.wappa?.data ?? []).map((t: any) => t.app),
        links:       (json.data?.links ?? []).slice(0, 20).map((l: any) => ({ href: l.href, text: l.text })),
        uuid,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Search existing scans
  if (!q) return NextResponse.json({ results: [] });

  const cacheKey = `search:${q}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const params = new URLSearchParams({ q, size: '20', sort: 'date:desc' });
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.URLSCAN_KEY) headers['API-Key'] = process.env.URLSCAN_KEY;

    const res = await fetch(`${BASE}/search/?${params}`, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`URLScan ${res.status}`);
    const json = await res.json();

    const results = (json.results ?? []).map((r: any) => ({
      uuid:       r._id,
      url:        r.page?.url,
      domain:     r.page?.domain,
      ip:         r.page?.ip,
      country:    r.page?.country,
      server:     r.page?.server,
      title:      r.page?.title,
      date:       r.task?.time,
      screenshot: `https://urlscan.io/screenshots/${r._id}.png`,
      malicious:  r.verdicts?.overall?.malicious ?? false,
      score:      r.verdicts?.overall?.score ?? 0,
      tags:       r.verdicts?.overall?.tags ?? [],
      reportUrl:  `https://urlscan.io/result/${r._id}/`,
    }));

    const payload = { results, total: json.total };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 10 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.URLSCAN_KEY;
  if (!key) {
    return NextResponse.json({
      error: 'URLSCAN_KEY not set. Sign up free at urlscan.io to submit new scans.',
    }, { status: 402 });
  }
  try {
    const { url, visibility = 'public' } = await req.json();
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

    const res = await fetch(`${BASE}/scan/`, {
      method: 'POST',
      headers: { 'API-Key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, visibility }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `URLScan submit ${res.status}`);
    }
    const json = await res.json();
    return NextResponse.json({ uuid: json.uuid, api: json.api, visibility: json.visibility });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
