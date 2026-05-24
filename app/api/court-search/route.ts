import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://www.courtlistener.com/api/rest/v4';

// 5-min cache per query string
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q     = searchParams.get('q')?.trim() ?? '';
  const type  = searchParams.get('type') ?? 'o';      // o=opinions, d=dockets
  const court = searchParams.get('court') ?? '';

  if (!q) return NextResponse.json({ results: [], count: 0 });

  const cacheKey = `${q}|${type}|${court}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const params = new URLSearchParams({
      q,
      type,
      format: 'json',
      order_by: 'score desc',
      stat_Precedential: 'on',
    });
    if (court) params.set('court', court);

    const res = await fetch(`${BASE}/search/?${params}`, {
      headers: {
        Accept: 'application/json',
        ...(process.env.COURTLISTENER_API_KEY
          ? { Authorization: `Token ${process.env.COURTLISTENER_API_KEY}` }
          : {}),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`CourtListener ${res.status}`);
    const json = await res.json();

    const results = (json.results ?? []).slice(0, 25).map((r: any) => ({
      id:           r.cluster_id ?? r.id,
      caseName:     r.caseName ?? r.case_name ?? 'Untitled',
      court:        r.court ?? r.court_citation_string ?? '',
      courtId:      r.court_id ?? '',
      dateFiled:    r.dateFiled ?? r.date_filed ?? '',
      docketNumber: r.docketNumber ?? r.docket_number ?? '',
      judge:        r.judge ?? '',
      citeCount:    r.citeCount ?? 0,
      status:       r.status ?? '',
      url:          r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : null,
      citation:     Array.isArray(r.citation) ? r.citation[0] : (r.citation ?? ''),
    }));

    const payload = { results, count: json.count ?? results.length };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 5 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], count: 0, error: err.message }, { status: 500 });
  }
}
