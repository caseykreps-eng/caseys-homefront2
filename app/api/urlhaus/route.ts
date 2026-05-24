import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Abuse.ch URLhaus — free, no API key
const BASE = 'https://urlhaus-api.abuse.ch/v1';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const type   = req.nextUrl.searchParams.get('type') ?? 'url'; // url | host | md5 | sha256

  if (!target) return NextResponse.json({ error: 'q required' }, { status: 400 });

  const key = `${type}:${target}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const endpoint = type === 'url'    ? `${BASE}/url/`
                   : type === 'host'   ? `${BASE}/host/`
                   : type === 'md5'    ? `${BASE}/payload/`
                   : type === 'sha256' ? `${BASE}/payload/`
                   : `${BASE}/url/`;

    const body = new URLSearchParams({ [type === 'host' ? 'host' : type === 'url' ? 'url' : type]: target });

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`URLhaus ${res.status}`);
    const json = await res.json();

    const payload = {
      queryStatus: json.query_status,
      found:       json.query_status === 'is_host' || json.query_status === 'is_url',
      threat:      json.threat ?? null,
      urlStatus:   json.url_status ?? null,
      dateAdded:   json.date_added ?? null,
      reporter:    json.reporter ?? null,
      larted:      json.larted ?? null,
      urls:        (json.urls ?? []).slice(0, 10).map((u: any) => ({
        url:       u.url,
        status:    u.url_status,
        threat:    u.threat,
        dateAdded: u.date_added,
        tags:      u.tags ?? [],
      })),
      tags:        json.tags ?? [],
      blacklists:  json.blacklists ?? {},
      payloads:    (json.payloads ?? []).slice(0, 5),
    };

    cache.set(key, { data: payload, expires: Date.now() + 15 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
