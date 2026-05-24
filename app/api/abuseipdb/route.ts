import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// AbuseIPDB — free 1000 req/day at abuseipdb.com
const BASE = 'https://api.abuseipdb.com/api/v2';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const ip     = req.nextUrl.searchParams.get('ip')?.trim() ?? '';
  const action = req.nextUrl.searchParams.get('action') ?? 'check'; // check | reports

  if (!ip) return NextResponse.json({ error: 'ip required' }, { status: 400 });

  const key = process.env.ABUSEIPDB_KEY;
  if (!key) {
    return NextResponse.json({
      error: 'ABUSEIPDB_KEY not set — sign up free at abuseipdb.com',
    }, { status: 402 });
  }

  const cacheKey = `${action}:${ip}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  const headers = { Key: key, Accept: 'application/json' };

  try {
    if (action === 'check') {
      const params = new URLSearchParams({ ipAddress: ip, maxAgeInDays: '90', verbose: '' });
      const res = await fetch(`${BASE}/check?${params}`, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`AbuseIPDB ${res.status}`);
      const json = await res.json();
      const d = json.data ?? {};

      const payload = {
        ip:                d.ipAddress,
        isPublic:          d.isPublic,
        ipVersion:         d.ipVersion,
        isWhitelisted:     d.isWhitelisted,
        abuseScore:        d.abuseConfidenceScore,    // 0–100
        countryCode:       d.countryCode,
        countryName:       d.countryName,
        usageType:         d.usageType,
        isp:               d.isp,
        domain:            d.domain,
        hostnames:         d.hostnames ?? [],
        isTor:             d.isTor,
        totalReports:      d.totalReports,
        numDistinctUsers:  d.numDistinctUsers,
        lastReportedAt:    d.lastReportedAt,
        reports: (d.reports ?? []).slice(0, 10).map((r: any) => ({
          reportedAt:  r.reportedAt,
          comment:     r.comment?.slice(0, 200),
          categories:  r.categories ?? [],
          reporterId:  r.reporterId,
        })),
        abuseipdbUrl: `https://www.abuseipdb.com/check/${ip}`,
      };

      cache.set(cacheKey, { data: payload, expires: Date.now() + 20 * 60_000 });
      return NextResponse.json(payload);
    }

    // action === 'reports'
    const params = new URLSearchParams({ ipAddress: ip, maxAgeInDays: '30', perPage: '25' });
    const res = await fetch(`${BASE}/reports?${params}`, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`AbuseIPDB ${res.status}`);
    const json = await res.json();
    const payload = {
      ip,
      total: json.meta?.totalCount ?? 0,
      reports: (json.data ?? []).map((r: any) => ({
        reportedAt: r.reportedAt,
        comment:    r.comment?.slice(0, 300),
        categories: r.categories ?? [],
      })),
    };

    cache.set(cacheKey, { data: payload, expires: Date.now() + 20 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
