import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// OTX AlienVault — free key at otx.alienvault.com
const BASE = 'https://otx.alienvault.com/api/v1';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const q    = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const type = req.nextUrl.searchParams.get('type') ?? 'domain'; // domain | ip | url | file | cve

  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  const key = process.env.OTX_KEY;
  if (!key) {
    return NextResponse.json({
      error: 'OTX_KEY not set — sign up free at otx.alienvault.com',
    }, { status: 402 });
  }

  const cacheKey = `${type}:${q}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  const headers = { 'X-OTX-API-KEY': key, Accept: 'application/json' };

  try {
    // OTX uses different sections per indicator type
    // Sections: general, geo, malware, url_list, passive_dns, reputation, http_scans
    const indicatorPath = type === 'ip'     ? `IPv4/${encodeURIComponent(q)}`
                        : type === 'domain' ? `domain/${encodeURIComponent(q)}`
                        : type === 'url'    ? `url/${encodeURIComponent(Buffer.from(q).toString('base64'))}`
                        : type === 'file'   ? `file/${encodeURIComponent(q)}`
                        : type === 'cve'    ? `cve/${encodeURIComponent(q)}`
                        : `domain/${encodeURIComponent(q)}`;

    const sections = type === 'file'
      ? ['general', 'analysis']
      : type === 'cve'
      ? ['general']
      : ['general', 'reputation', 'geo', 'malware', 'url_list', 'passive_dns'];

    const fetches = sections.map(section =>
      fetch(`${BASE}/indicators/${indicatorPath}/${section}`, {
        headers,
        signal: AbortSignal.timeout(10000),
      }).then(r => r.ok ? r.json() : null).catch(() => null)
    );

    const results = await Promise.all(fetches);
    const [general, reputationOrAnalysis, geo, malware, urlList, passiveDns] = results;

    // Pulse count = number of threat intel reports mentioning this indicator
    const pulseCount = general?.pulse_info?.count ?? 0;
    const pulses = (general?.pulse_info?.pulses ?? []).slice(0, 5).map((p: any) => ({
      id:          p.id,
      name:        p.name,
      description: p.description?.slice(0, 200),
      author:      p.author_name,
      tlp:         p.tlp,
      tags:        p.tags ?? [],
      modified:    p.modified,
      references:  (p.references ?? []).slice(0, 3),
    }));

    const payload = {
      type,
      query:      q,
      pulseCount,
      pulses,
      reputation:  type === 'ip' || type === 'domain' ? (reputationOrAnalysis?.reputation ?? 0) : undefined,
      country:     geo?.country_name ?? general?.country_name ?? null,
      city:        geo?.city ?? null,
      asn:         geo?.asn ?? general?.asn ?? null,
      malwareCount: (malware?.data ?? []).length,
      malwareSamples: (malware?.data ?? []).slice(0, 5).map((m: any) => ({
        hash: m.hash, detections: m.detections, date: m.date,
      })),
      urlCount:    (urlList?.url_list ?? []).length,
      urls:        (urlList?.url_list ?? []).slice(0, 10).map((u: any) => ({
        url: u.url, result: u.result?.safebrowsing?.threat ?? u.result?.urlworker?.verdict,
        date: u.date,
      })),
      passiveDns:  (passiveDns?.passive_dns ?? []).slice(0, 10).map((d: any) => ({
        address: d.address, hostname: d.hostname, first: d.first, last: d.last,
      })),
      validationMessages: general?.validation ?? [],
      otxUrl: `https://otx.alienvault.com/indicator/${type === 'ip' ? 'ip' : type}/${q}`,
    };

    cache.set(cacheKey, { data: payload, expires: Date.now() + 15 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
