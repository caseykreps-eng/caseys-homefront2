import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Openverse — Wordpress Foundation, free, no key needed for moderate usage
const BASE = 'https://api.openverse.org/v1';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const type     = req.nextUrl.searchParams.get('type') ?? 'images'; // images | audio
  const license  = req.nextUrl.searchParams.get('license') ?? '';

  if (!q) return NextResponse.json({ results: [], count: 0 });

  const cacheKey = `${q}|${type}|${license}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const params = new URLSearchParams({ q, page_size: '24', mature: 'false' });
    if (license) params.set('license', license);

    const res = await fetch(`${BASE}/${type}/?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`Openverse ${res.status}`);
    const json = await res.json();

    const results = (json.results ?? []).map((r: any) => ({
      id:          r.id,
      title:       r.title ?? 'Untitled',
      creator:     r.creator ?? '',
      creatorUrl:  r.creator_url ?? null,
      license:     r.license ?? '',
      licenseUrl:  r.license_url ?? null,
      source:      r.source ?? '',
      url:         r.url ?? null,
      foreignUrl:  r.foreign_landing_url ?? null,
      thumbnail:   r.thumbnail ?? r.url ?? null,
      width:       r.width ?? null,
      height:      r.height ?? null,
      tags:        (r.tags ?? []).map((t: any) => t.name ?? t).slice(0, 8),
    }));

    const payload = { results, count: json.result_count ?? results.length };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 10 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], count: 0, error: err.message }, { status: 500 });
  }
}
