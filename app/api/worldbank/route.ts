import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// World Bank Open Data API — free, no key
const BASE = 'https://api.worldbank.org/v2';
const cache = new Map<string, { data: any; expires: number }>();

// Common indicators
const INDICATORS: Record<string, string> = {
  gdp:          'NY.GDP.MKTP.CD',        // GDP (current US$)
  gdpPerCapita: 'NY.GDP.PCAP.CD',        // GDP per capita
  population:   'SP.POP.TOTL',           // Total population
  inflation:    'FP.CPI.TOTL.ZG',        // Inflation (CPI %)
  unemployment: 'SL.UEM.TOTL.ZS',        // Unemployment (% of labor force)
  poverty:      'SI.POV.DDAY',           // Poverty headcount ratio at $2.15/day
  lifeExp:      'SP.DYN.LE00.IN',        // Life expectancy at birth
  literacy:     'SE.ADT.LITR.ZS',        // Adult literacy rate
  military:     'MS.MIL.XPND.GD.ZS',    // Military expenditure (% of GDP)
  corruption:   'CC.EST',                // Control of Corruption estimate (WGI)
};

export async function GET(req: NextRequest) {
  const country   = req.nextUrl.searchParams.get('country')?.trim().toLowerCase() ?? 'all';
  const indicator = req.nextUrl.searchParams.get('indicator') ?? 'gdp';
  const years     = parseInt(req.nextUrl.searchParams.get('years') ?? '5');

  const indicatorCode = INDICATORS[indicator] ?? indicator;
  const cacheKey = `${country}:${indicatorCode}:${years}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const endYear   = new Date().getFullYear() - 1;
    const startYear = endYear - years + 1;
    const params = new URLSearchParams({
      format: 'json',
      per_page: '100',
      date: `${startYear}:${endYear}`,
      mrv: String(years),
    });

    const url = `${BASE}/country/${encodeURIComponent(country)}/indicator/${encodeURIComponent(indicatorCode)}?${params}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`WorldBank ${res.status}`);
    const json = await res.json();

    // WB returns [meta, data] array
    const meta = json[0] ?? {};
    const data = (json[1] ?? []).filter((d: any) => d.value !== null).map((d: any) => ({
      country:     d.country?.value,
      countryCode: d.countryiso3code ?? d.country?.id,
      indicator:   d.indicator?.value,
      year:        parseInt(d.date),
      value:       d.value,
    }));

    const payload = {
      indicator,
      indicatorCode,
      indicatorName: data[0]?.indicator ?? indicatorCode,
      country,
      total:   meta.total ?? data.length,
      data,
      availableIndicators: Object.keys(INDICATORS),
    };

    cache.set(cacheKey, { data: payload, expires: Date.now() + 60 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
