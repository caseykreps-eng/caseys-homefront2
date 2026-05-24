import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// LittleSis — power network mapping, free public API
const BASE = 'https://littlesis.org/api';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const q      = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const action = req.nextUrl.searchParams.get('action') ?? 'search'; // search | relationships
  const id     = req.nextUrl.searchParams.get('id') ?? '';

  const cacheKey = `${action}|${q}|${id}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    let url: string;

    if (action === 'relationships' && id) {
      url = `${BASE}/entities/${id}/relationships?per_page=25`;
    } else {
      if (!q) return NextResponse.json({ results: [] });
      url = `${BASE}/entities?q=${encodeURIComponent(q)}&per_page=20`;
    }

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`LittleSis ${res.status}`);
    const json = await res.json();

    let payload: any;

    if (action === 'relationships') {
      const rels = (json.data ?? []).map((r: any) => {
        const attrs = r.attributes ?? {};
        const e1 = attrs.entity ?? {};
        const e2 = attrs.related_entity ?? {};
        return {
          id:          r.id,
          category:    attrs.category_name ?? '',
          description: attrs.description1 ?? attrs.description2 ?? '',
          isReverse:   attrs.is_reverse ?? false,
          entity1:     { id: e1.id, name: e1.name, blurb: e1.blurb, url: e1.url ? `https://littlesis.org${e1.url}` : null },
          entity2:     { id: e2.id, name: e2.name, blurb: e2.blurb, url: e2.url ? `https://littlesis.org${e2.url}` : null },
          url:         r.links?.self ? `https://littlesis.org${r.links.self}` : null,
        };
      });
      payload = { relationships: rels };
    } else {
      const results = (json.data ?? []).map((e: any) => {
        const attrs = e.attributes ?? {};
        return {
          id:      e.id,
          name:    attrs.name ?? '',
          blurb:   attrs.blurb ?? '',
          type:    attrs.primary_ext ?? '',
          aliases: attrs.aliases ?? [],
          url:     attrs.url ? `https://littlesis.org${attrs.url}` : `https://littlesis.org/entities/${e.id}`,
          imageUrl: attrs.image_url ?? null,
        };
      });
      payload = { results };
    }

    cache.set(cacheKey, { data: payload, expires: Date.now() + 10 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], error: err.message }, { status: 500 });
  }
}
