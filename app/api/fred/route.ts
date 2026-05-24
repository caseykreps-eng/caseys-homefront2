import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// FRED (Federal Reserve Bank of St. Louis) — free, no key required for public data
// NOTE: Key recommended for higher rate limits — set FRED_KEY optionally
const BASE = 'https://api.stlouisfed.org/fred';
const cache = new Map<string, { data: any; expires: number }>();

// Curated series relevant to global intel
const SERIES: Record<string, { id: string; name: string; unit: string }> = {
  sp500:       { id: 'SP500',          name: 'S&P 500',              unit: 'Index' },
  vix:         { id: 'VIXCLS',         name: 'CBOE Volatility (VIX)', unit: 'Index' },
  oil_wti:     { id: 'DCOILWTICO',     name: 'WTI Crude Oil',        unit: 'USD/bbl' },
  oil_brent:   { id: 'DCOILBRENTEU',   name: 'Brent Crude Oil',      unit: 'USD/bbl' },
  gold:        { id: 'GOLDAMGBD228NLBM', name: 'Gold Price',          unit: 'USD/troy oz' },
  usd_eur:     { id: 'DEXUSEU',        name: 'USD/EUR Exchange',     unit: 'USD per EUR' },
  usd_rub:     { id: 'DEXUSUK',        name: 'USD/GBP Exchange',     unit: 'USD per GBP' },
  fed_rate:    { id: 'FEDFUNDS',       name: 'Fed Funds Rate',       unit: '%' },
  cpi:         { id: 'CPIAUCSL',       name: 'CPI (US)',             unit: 'Index 1982=100' },
  unemployment:{ id: 'UNRATE',         name: 'US Unemployment',      unit: '%' },
  m2:          { id: 'M2SL',           name: 'M2 Money Supply',      unit: 'Billions USD' },
  '10yr':      { id: 'DGS10',          name: '10-Year Treasury Yield', unit: '%' },
  '2yr':       { id: 'DGS2',           name: '2-Year Treasury Yield',  unit: '%' },
  debt:        { id: 'GFDEBTN',        name: 'Federal Debt',         unit: 'Millions USD' },
  natgas:      { id: 'DHHNGSP',        name: 'Natural Gas Price',    unit: 'USD/1000 BTU' },
};

export async function GET(req: NextRequest) {
  const seriesKey = req.nextUrl.searchParams.get('series') ?? 'vix';
  const limit     = parseInt(req.nextUrl.searchParams.get('limit') ?? '30');
  const multi     = req.nextUrl.searchParams.get('multi'); // comma-separated series keys

  // Multi-series fetch (for dashboard overview)
  if (multi) {
    const keys = multi.split(',').map(k => k.trim()).filter(k => SERIES[k]).slice(0, 10);
    const results = await Promise.all(keys.map(async k => {
      const cacheKey = `${k}:5`;
      const hit = cache.get(cacheKey);
      if (hit && hit.expires > Date.now()) return { key: k, ...hit.data };
      return fetchSeries(k, 5);
    }));
    return NextResponse.json({ series: results, available: Object.keys(SERIES) });
  }

  const cacheKey = `${seriesKey}:${limit}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  const result = await fetchSeries(seriesKey, limit);
  return NextResponse.json(result);
}

async function fetchSeries(seriesKey: string, limit: number) {
  const meta = SERIES[seriesKey];
  if (!meta) {
    const payload = { error: `Unknown series. Available: ${Object.keys(SERIES).join(', ')}` };
    return payload;
  }

  const cacheKey = `${seriesKey}:${limit}`;
  const params = new URLSearchParams({
    series_id:         meta.id,
    file_type:         'json',
    sort_order:        'desc',
    limit:             String(limit),
    observation_start: '2020-01-01',
  });
  if (process.env.FRED_KEY) params.set('api_key', process.env.FRED_KEY);

  try {
    const res = await fetch(`${BASE}/series/observations?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`FRED ${res.status}`);
    const json = await res.json();

    const observations = (json.observations ?? [])
      .filter((o: any) => o.value !== '.' )
      .map((o: any) => ({ date: o.date, value: parseFloat(o.value) }));

    const latest = observations[0];
    const prev   = observations[1];
    const change = latest && prev ? latest.value - prev.value : null;
    const changePct = latest && prev && prev.value !== 0
      ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : null;

    const payload = {
      key:         seriesKey,
      seriesId:    meta.id,
      name:        meta.name,
      unit:        meta.unit,
      latest:      latest?.value ?? null,
      latestDate:  latest?.date ?? null,
      change,
      changePct,
      observations: observations.slice(0, limit),
      fredUrl:     `https://fred.stlouisfed.org/series/${meta.id}`,
      available:   Object.keys(SERIES),
    };

    cache.set(cacheKey, { data: payload, expires: Date.now() + 30 * 60_000 });
    return payload;
  } catch (err: any) {
    return { key: seriesKey, error: err.message };
  }
}
