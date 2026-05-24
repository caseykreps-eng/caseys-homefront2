import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// OCCRP Aleph — free public API, investigative data platform
const BASE = 'https://aleph.occrp.org/api/2';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const q         = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const filter    = req.nextUrl.searchParams.get('filter') ?? ''; // dataset filter
  const schemaFilter = req.nextUrl.searchParams.get('schema') ?? '';

  if (!q) return NextResponse.json({ results: [], total: 0 });

  const cacheKey = `${q}|${filter}|${schemaFilter}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const params = new URLSearchParams({ q, limit: '25' });
    if (filter) params.set('filter:collection_id', filter);
    if (schemaFilter) params.set('filter:schema', schemaFilter);

    const res = await fetch(`${BASE}/entities?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) throw new Error(`Aleph ${res.status}`);
    const json = await res.json();

    const results = (json.results ?? []).map((e: any) => {
      const props = e.properties ?? {};
      const get = (k: string) => (Array.isArray(props[k]) ? props[k][0] : props[k]) ?? null;
      return {
        id:          e.id,
        caption:     e.caption ?? get('name') ?? '',
        schema:      e.schema ?? '',
        collection:  e.collection?.label ?? e.collection?.foreign_id ?? '',
        collectionId: e.collection?.id ?? null,
        score:       e.score ?? null,
        name:        get('name'),
        country:     get('country'),
        date:        get('date') || get('registrationDate'),
        address:     get('address'),
        url:         `https://aleph.occrp.org/entities/${e.id}`,
        collectionUrl: e.collection?.id ? `https://aleph.occrp.org/datasets/${e.collection.id}` : null,
        sourceUrl:   get('sourceUrl'),
      };
    });

    const payload = { results, total: json.total?.value ?? results.length };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 10 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], total: 0, error: err.message }, { status: 500 });
  }
}
