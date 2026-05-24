import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 10-min cache per query
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json({ results: [] });

  const hit = cache.get(q);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    // Wikidata entity search — politicians, world leaders, officials
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: q,
      language: 'en',
      limit: '20',
      type: 'item',
      format: 'json',
      origin: '*',
    });

    const searchRes = await fetch(
      `https://www.wikidata.org/w/api.php?${params}`,
      { headers: { 'User-Agent': 'GlobalIntelDashboard/1.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!searchRes.ok) throw new Error(`Wikidata search ${searchRes.status}`);
    const searchJson = await searchRes.json();

    const ids: string[] = (searchJson.search ?? []).map((r: any) => r.id);
    if (!ids.length) {
      const empty = { results: [] };
      cache.set(q, { data: empty, expires: Date.now() + 10 * 60_000 });
      return NextResponse.json(empty);
    }

    // Fetch entity details for all IDs at once
    const detailParams = new URLSearchParams({
      action: 'wbgetentities',
      ids: ids.join('|'),
      languages: 'en',
      props: 'labels|descriptions|claims|sitelinks',
      format: 'json',
      origin: '*',
    });
    const detailRes = await fetch(
      `https://www.wikidata.org/w/api.php?${detailParams}`,
      { headers: { 'User-Agent': 'GlobalIntelDashboard/1.0' }, signal: AbortSignal.timeout(10000) }
    );
    if (!detailRes.ok) throw new Error(`Wikidata entities ${detailRes.status}`);
    const detailJson = await detailRes.json();
    const entities = detailJson.entities ?? {};

    const getClaimValue = (claims: any, prop: string): string => {
      const arr = claims?.[prop];
      if (!arr?.length) return '';
      const v = arr[0]?.mainsnak?.datavalue?.value;
      if (typeof v === 'string') return v;
      if (v?.id) return v.id; // another QID
      return '';
    };

    const results = ids.map((id: string) => {
      const e = entities[id];
      if (!e) return null;
      const claims = e.claims ?? {};
      const label = e.labels?.en?.value ?? id;
      const description = e.descriptions?.en?.value ?? '';
      const wikidataUrl = `https://www.wikidata.org/wiki/${id}`;
      const wikipediaSlug = e.sitelinks?.enwiki?.title;
      const wikipediaUrl = wikipediaSlug
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaSlug)}`
        : null;

      // Key properties
      const positionHeld = getClaimValue(claims, 'P39'); // position held (QID)
      const countryQid   = getClaimValue(claims, 'P27'); // country of citizenship
      const partyQid     = getClaimValue(claims, 'P102'); // member of political party
      const dob          = getClaimValue(claims, 'P569'); // date of birth
      const image        = getClaimValue(claims, 'P18');  // image filename

      const imageUrl = image
        ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image)}?width=120`
        : null;

      return {
        id,
        label,
        description,
        wikidataUrl,
        wikipediaUrl,
        positionQid: positionHeld || null,
        countryQid: countryQid || null,
        partyQid: partyQid || null,
        dob: dob || null,
        imageUrl,
      };
    }).filter(Boolean);

    const payload = { results };
    cache.set(q, { data: payload, expires: Date.now() + 10 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], error: err.message }, { status: 500 });
  }
}
