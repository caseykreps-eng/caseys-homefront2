import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://www.federalregister.gov/api/v1';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const q        = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const type     = req.nextUrl.searchParams.get('type') ?? '';          // Rule, Notice, Presidential Document, etc.
  const perPage  = req.nextUrl.searchParams.get('per_page') ?? '20';

  if (!q) return NextResponse.json({ results: [], count: 0 });

  const cacheKey = `${q}|${type}|${perPage}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const params: Record<string, string> = {
      'conditions[term]':    q,
      'per_page':            perPage,
      'order':               'relevance',
      'fields[]':            'abstract,action,agencies,citation,document_number,effective_on,html_url,pdf_url,publication_date,title,type',
    };
    if (type) params['conditions[type][]'] = type;

    const qs = new URLSearchParams(params).toString()
      // federalregister.gov needs array params with [] suffix
      .replace('fields%5B%5D=', 'fields[]=')
      .replace('conditions%5Bterm%5D=', 'conditions[term]=')
      .replace('conditions%5Btype%5D%5B%5D=', 'conditions[type][]=');

    const res = await fetch(`${BASE}/documents.json?${qs}`, {
      headers: {
        Accept: 'application/json',
        'X-Api-Key': process.env.DATA_GOV_KEY ?? '',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) throw new Error(`FederalRegister ${res.status}`);
    const json = await res.json();

    const results = (json.results ?? []).map((r: any) => ({
      id:             r.document_number,
      title:          r.title ?? '',
      type:           r.type ?? '',
      agencies:       (r.agencies ?? []).map((a: any) => a.name ?? a.raw_name).filter(Boolean),
      publicationDate: r.publication_date ?? '',
      effectiveDate:  r.effective_on ?? '',
      citation:       r.citation ?? '',
      abstract:       r.abstract ?? '',
      action:         r.action ?? '',
      htmlUrl:        r.html_url ?? null,
      pdfUrl:         r.pdf_url ?? null,
    }));

    const payload = { results, count: json.count ?? results.length };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 10 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ results: [], count: 0, error: err.message }, { status: 500 });
  }
}
