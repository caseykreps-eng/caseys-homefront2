import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GreyNoise Community API — free key at greynoise.io, 100 req/day
const BASE = 'https://api.greynoise.io/v3/community';
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const ip = req.nextUrl.searchParams.get('ip')?.trim() ?? '';
  if (!ip) return NextResponse.json({ error: 'ip required' }, { status: 400 });

  const key = process.env.GREYNOISE_KEY;
  if (!key) {
    return NextResponse.json({
      error: 'GREYNOISE_KEY not set — sign up free at greynoise.io',
    }, { status: 402 });
  }

  const hit = cache.get(ip);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(ip)}`, {
      headers: { key, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    // 404 = not seen in GreyNoise (not necessarily malicious)
    if (res.status === 404) {
      const payload = { ip, seen: false, noise: false, riot: false, message: 'Not seen in GreyNoise', classification: null };
      cache.set(ip, { data: payload, expires: Date.now() + 20 * 60_000 });
      return NextResponse.json(payload);
    }
    if (!res.ok) throw new Error(`GreyNoise ${res.status}`);

    const json = await res.json();
    const payload = {
      ip:             json.ip,
      seen:           json.seen,
      noise:          json.noise,       // true = internet background noise scanner
      riot:           json.riot,        // true = benign service (Cloudflare, Google, etc)
      classification: json.classification ?? null,  // malicious | benign | unknown
      name:           json.name ?? null,
      link:           json.link ?? `https://www.greynoise.io/viz/ip/${ip}`,
      lastSeen:       json.last_seen ?? null,
      message:        json.message ?? null,
      greynoiseUrl:   `https://www.greynoise.io/viz/ip/${ip}`,
    };

    cache.set(ip, { data: payload, expires: Date.now() + 20 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
