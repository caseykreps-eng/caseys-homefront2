import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 10-min cache per query
const cache = new Map<string, { data: any; expires: number }>();

// OpenSanctions free matching/search API — no key needed for non-commercial
const BASE = 'https://api.opensanctions.org';

export async function GET(req: NextRequest) {
  const q      = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const schema = req.nextUrl.searchParams.get('schema') ?? '';   // Person, Company, etc.
  const dataset = req.nextUrl.searchParams.get('dataset') ?? 'default';

  if (!q) return NextResponse.json({ results: [], total: 0 });

  const cacheKey = `${q}|${schema}|${dataset}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const params = new URLSearchParams({ q, limit: '25', dataset });
    if (schema) params.set('schema', schema);

    const res = await fetch(`${BASE}/search/entities?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`OpenSanctions ${res.status}`);
    const json = await res.json();

    const results = (json.results ?? []).map((e: any) => {
      const props = e.properties ?? {};
      const get = (k: string) => (Array.isArray(props[k]) ? props[k][0] : props[k]) ?? null;
      return {
        id:          e.id,
        caption:     e.caption ?? get('name') ?? '',
        schema:      e.schema ?? '',
        datasets:    e.datasets ?? [],
        score:       e.score ?? null,
        // Common props
        name:        get('name'),
        alias:       props.alias ?? [],
        birthDate:   get('birthDate'),
        nationality: get('nationality') || get('country'),
        position:    get('position'),
        address:     get('address'),
        notes:       get('notes'),
        // Sanctions
        program:     props.program ?? [],
        reason:      get('reason'),
        listingDate: get('listingDate'),
        // Links
        sourceUrl:   get('sourceUrl'),
        wikidataId:  get('wikidataId'),
        wikidataUrl: get('wikidataId') ? `https://www.wikidata.org/wiki/${get('wikidataId')}` : null,
        osUrl:       `https://www.opensanctions.org/entities/${e.id}/`,
      };
    });

    const payload = { results, total: json.total?.value ?? results.length };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 10 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], total: 0, error: err.message }, { status: 500 });
  }
}
