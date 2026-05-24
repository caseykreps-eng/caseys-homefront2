import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// VirusTotal free API — 500 req/day, requires free key at virustotal.com
const BASE = 'https://www.virustotal.com/api/v3';
const cache = new Map<string, { data: any; expires: number }>();

function vtHeaders() {
  const key = process.env.VT_KEY;
  if (!key) throw new Error('VT_KEY not set — sign up free at virustotal.com');
  return { 'x-apikey': key, Accept: 'application/json' };
}

export async function GET(req: NextRequest) {
  const q      = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const type   = req.nextUrl.searchParams.get('type') ?? 'url'; // url | ip | domain | file

  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  const cacheKey = `${type}:${q}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  let headers: Record<string, string>;
  try { headers = vtHeaders(); }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 402 }); }

  try {
    let endpoint = '';
    if (type === 'url') {
      // VT requires URL ID = base64url of the URL
      const id = Buffer.from(q).toString('base64url').replace(/=/g, '');
      endpoint = `${BASE}/urls/${id}`;
    } else if (type === 'ip') {
      endpoint = `${BASE}/ip_addresses/${encodeURIComponent(q)}`;
    } else if (type === 'domain') {
      endpoint = `${BASE}/domains/${encodeURIComponent(q)}`;
    } else if (type === 'file') {
      endpoint = `${BASE}/files/${encodeURIComponent(q)}`;
    } else {
      return NextResponse.json({ error: 'type must be url|ip|domain|file' }, { status: 400 });
    }

    const res = await fetch(endpoint, { headers, signal: AbortSignal.timeout(12000) });
    if (res.status === 404) return NextResponse.json({ error: 'Not found in VirusTotal', notFound: true }, { status: 404 });
    if (!res.ok) throw new Error(`VirusTotal ${res.status}`);

    const json = await res.json();
    const attr = json.data?.attributes ?? {};
    const stats = attr.last_analysis_stats ?? {};
    const votes = attr.total_votes ?? {};

    const payload = {
      type,
      query:         q,
      id:            json.data?.id,
      malicious:     stats.malicious ?? 0,
      suspicious:    stats.suspicious ?? 0,
      undetected:    stats.undetected ?? 0,
      harmless:      stats.harmless ?? 0,
      timeout:       stats.timeout ?? 0,
      reputation:    attr.reputation ?? 0,
      communityVotes: { malicious: votes.malicious ?? 0, harmless: votes.harmless ?? 0 },
      categories:    attr.categories ?? {},
      tags:          attr.tags ?? [],
      country:       attr.country ?? null,
      asOwner:       attr.as_owner ?? null,
      network:       attr.network ?? null,
      // domain/url specific
      registrar:     attr.registrar ?? null,
      creationDate:  attr.creation_date ? new Date(attr.creation_date * 1000).toISOString() : null,
      // file specific
      sha256:        attr.sha256 ?? null,
      md5:           attr.md5 ?? null,
      fileType:      attr.type_description ?? null,
      fileSize:      attr.size ?? null,
      // top results
      engines: Object.entries(attr.last_analysis_results ?? {})
        .filter(([, v]: [string, any]) => v.category === 'malicious' || v.category === 'suspicious')
        .slice(0, 15)
        .map(([engine, v]: [string, any]) => ({ engine, category: v.category, result: v.result })),
      vtUrl: type === 'url'
        ? `https://www.virustotal.com/gui/url/${json.data?.id}`
        : type === 'ip'
        ? `https://www.virustotal.com/gui/ip-address/${q}`
        : type === 'domain'
        ? `https://www.virustotal.com/gui/domain/${q}`
        : `https://www.virustotal.com/gui/file/${q}`,
    };

    cache.set(cacheKey, { data: payload, expires: Date.now() + 15 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
