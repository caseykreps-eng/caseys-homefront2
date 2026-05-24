import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Numverify — phone number validation & carrier lookup
// Free tier: 100 req/month, HTTP only on free plan (we proxy server-side so that's fine)
const cache = new Map<string, { data: any; expires: number }>();

export async function GET(req: NextRequest) {
  const number = req.nextUrl.searchParams.get('number')?.trim().replace(/\s+/g, '') ?? '';
  if (!number) return NextResponse.json({ error: 'number required' }, { status: 400 });

  const hit = cache.get(number);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  const key = process.env.NUMVERIFY_KEY;
  if (!key) return NextResponse.json({ error: 'NUMVERIFY_KEY not configured' }, { status: 500 });

  try {
    // Numverify free plan only allows HTTP (no HTTPS) — we call from server-side so this is safe
    const res = await fetch(
      `http://apilayer.net/api/validate?access_key=${key}&number=${encodeURIComponent(number)}&format=1`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Numverify HTTP ${res.status}`);
    const json = await res.json();

    if (json.error) throw new Error(json.error.info ?? `Numverify error ${json.error.code}`);

    const payload = {
      valid:           json.valid,
      number:          json.number,
      localFormat:     json.local_format,
      intlFormat:      json.international_format,
      countryPrefix:   json.country_prefix,
      countryCode:     json.country_code,
      countryName:     json.country_name,
      location:        json.location,
      carrier:         json.carrier,
      lineType:        json.line_type,
    };

    cache.set(number, { data: payload, expires: Date.now() + 60 * 60_000 }); // 1 hr
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
