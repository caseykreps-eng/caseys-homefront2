import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * MarineTraffic AIS API (exportvessels v:8)
 * Docs: https://servicedocs.marinetraffic.com/tag/AIS-API#operation/exportvessels______
 * Set MARINETRAFFIC_KEY in .env
 *
 * Supports:
 *   ?action=positions   — live vessel positions (default)
 *   ?action=portcalls   — recent port calls
 *   ?action=vesselinfo  — vessel detail by MMSI or IMO
 *
 * Position params:
 *   &type=tanker|cargo|military|passenger|fishing|all
 *   &region=medBlackSea|persianGulf|redSea|global|...
 *   &timespan=10        — minutes lookback (default 10, max 60 on free tier)
 *   &limit=100
 */

const BASE = 'https://services.marinetraffic.com/api';
const CACHE_MS = 3 * 60_000; // 3 minutes

const cache = new Map<string, { data: any; expires: number }>();

// Bounding boxes [minlat, minlon, maxlat, maxlon]
const BBOXES: Record<string, [number, number, number, number]> = {
  global:        [-90, -180, 90, 180],
  medBlackSea:   [28,  -6,  48,  42],
  persianGulf:   [20,  48,  32,  62],
  redSea:        [10,  30,  30,  50],
  hormuz:        [22,  54,  27,  60],
  bosporus:      [40,  28,  42,  30],
  northAtlantic: [0,  -70,  65,  20],
  indianOcean:   [-30,  30, 30,  90],
  indiaOcean:    [-30,  30, 30,  90], // alias used by page
  southChinaSea: [0,  100,  25, 125],
};

// MarineTraffic vessel type codes
const SHIP_TYPE_CODES: Record<string, string> = {
  tanker:    '80,81,82,83,84,85,86,87,88,89',
  cargo:     '70,71,72,73,74,75,76,77,78,79',
  military:  '35',
  passenger: '60,61,62,63,64,65,66,67,68,69',
  fishing:   '30',
  all:       '',
};

// Navigational status
function navStatus(code: number | string): string {
  const c = Number(code);
  const s: Record<number, string> = {
    0: 'Underway', 1: 'At anchor', 2: 'Not under command',
    3: 'Restricted maneuverability', 5: 'Moored', 6: 'Aground',
    7: 'Engaged in fishing', 8: 'Underway sailing', 15: 'Not defined',
  };
  return s[c] ?? 'Unknown';
}

// Rough MMSI → flag
function mmsiToFlag(mmsi: string): string {
  const mid = String(mmsi).slice(0, 3);
  const map: Record<string, string> = {
    '211': 'DE', '219': 'DK', '232': 'GB', '235': 'GB', '244': 'NL',
    '257': 'NO', '265': 'SE', '266': 'SE', '269': 'CH', '271': 'TR',
    '273': 'RU', '275': 'EE', '276': 'LV', '277': 'LT', '278': 'UA',
    '303': 'US', '338': 'US', '366': 'US', '367': 'US', '368': 'US',
    '369': 'US', '412': 'CN', '413': 'CN', '416': 'TW', '431': 'JP',
    '440': 'KR', '441': 'KR', '477': 'HK', '503': 'AU', '512': 'NZ',
    '525': 'ID', '533': 'MY', '548': 'PH', '557': 'SG', '566': 'SG',
    '574': 'VN', '636': 'LR', '657': 'KE', '667': 'GN', '710': 'BR',
    '725': 'CL', '735': 'AR', '807': 'GR', '888': 'IR', '572': 'FJ',
  };
  return map[mid] ?? '';
}

function normaliseVessel(v: any) {
  const mmsi = String(v.MMSI ?? v.mmsi ?? '');
  const lat  = parseFloat(v.LAT ?? v.lat ?? v.LATITUDE ?? '0');
  const lon  = parseFloat(v.LON ?? v.lon ?? v.LONGITUDE ?? '0');
  const speed   = parseFloat(v.SPEED ?? v.speed ?? '0');
  const heading = parseFloat(v.HEADING ?? v.heading ?? v.COURSE ?? '0');
  const status  = v.STATUS ?? v.NAVSTAT ?? v.status ?? 0;
  return {
    id:          `mt-${mmsi}`,
    mmsi,
    name:        (v.SHIPNAME ?? v.NAME ?? v.name ?? `MMSI ${mmsi}`).trim(),
    lat:         isNaN(lat) ? null : lat,
    lon:         isNaN(lon) ? null : lon,
    speed:       isNaN(speed) ? 0 : speed,
    heading:     isNaN(heading) ? 0 : heading,
    status:      Number(status),
    statusLabel: navStatus(status),
    destination: (v.DESTINATION ?? v.destination ?? '').trim(),
    shipType:    Number(v.SHIPTYPE ?? v.TYPE_SUMMARY ?? v.shipType ?? 0),
    flag:        v.FLAG ?? v.flag ?? mmsiToFlag(mmsi),
    timestamp:   v.TIMESTAMP ?? v.timestamp ?? new Date().toISOString(),
    imo:         v.IMO ?? v.imo ?? null,
    callsign:    (v.CALLSIGN ?? v.callsign ?? '').trim(),
    length:      v.LENGTH ?? v.length ?? null,
    source:      'marinetraffic',
  };
}

async function mtFetch(path: string, ttl = CACHE_MS) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.data;

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`MarineTraffic ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  cache.set(path, { data, expires: Date.now() + ttl });
  return data;
}

export async function GET(req: NextRequest) {
  const key = process.env.MARINETRAFFIC_KEY;
  if (!key) {
    return NextResponse.json({
      vessels: [], count: 0,
      error: 'MARINETRAFFIC_KEY not set — add it to .env',
      notConfigured: true,
    });
  }

  const { searchParams } = req.nextUrl;
  const action   = searchParams.get('action')   ?? 'positions';
  const region   = searchParams.get('region')   ?? 'medBlackSea';
  const typeParam = searchParams.get('type')    ?? 'all';
  const timespan  = searchParams.get('timespan') ?? '10';
  const limit     = searchParams.get('limit')   ?? '100';

  try {
    // ── Live vessel positions ──────────────────────────────────────────────────
    if (action === 'positions') {
      const bbox = BBOXES[region] ?? BBOXES.medBlackSea;
      const params = new URLSearchParams({
        protocol:  'json',
        msgtype:   'extended',
        timespan,
        MINLAT:    String(bbox[0]),
        MINLON:    String(bbox[1]),
        MAXLAT:    String(bbox[2]),
        MAXLON:    String(bbox[3]),
        limit,
      });

      const typeCode = SHIP_TYPE_CODES[typeParam];
      if (typeCode) params.set('TYPECODE', typeCode);

      const cacheKey = `positions:${region}:${typeParam}:${timespan}`;
      const cachedHit = cache.get(cacheKey);
      if (cachedHit && cachedHit.expires > Date.now()) {
        return NextResponse.json({ ...cachedHit.data, cached: true });
      }

      const data = await mtFetch(`/exportvessels/v:8/${key}?${params}`, CACHE_MS);

      // MT returns either array directly or { data: [...] }
      const raw: any[] = Array.isArray(data) ? data : (data?.data ?? data?.vessels ?? []);
      const vessels = raw
        .map(normaliseVessel)
        .filter(v => v.lat !== null && v.lon !== null && (v.lat !== 0 || v.lon !== 0));

      const result = { vessels, count: vessels.length, region, source: 'marinetraffic' };
      cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_MS });
      return NextResponse.json(result);
    }

    // ── Vessel detail ─────────────────────────────────────────────────────────
    if (action === 'vesselinfo') {
      const mmsi = searchParams.get('mmsi') ?? '';
      const imo  = searchParams.get('imo')  ?? '';
      if (!mmsi && !imo) return NextResponse.json({ error: 'mmsi or imo required' }, { status: 400 });

      const params = new URLSearchParams({ protocol: 'json' });
      if (mmsi) params.set('mmsi', mmsi);
      if (imo)  params.set('imo',  imo);

      const data = await mtFetch(`/vesseldetails/v:1/${key}?${params}`, 10 * 60_000);
      const raw = Array.isArray(data) ? data[0] : (data?.data?.[0] ?? data);
      return NextResponse.json({ vessel: normaliseVessel(raw ?? {}) });
    }

    // ── Port calls ────────────────────────────────────────────────────────────
    if (action === 'portcalls') {
      const mmsi   = searchParams.get('mmsi')    ?? '';
      const portId = searchParams.get('port_id') ?? '';
      if (!mmsi && !portId) return NextResponse.json({ error: 'mmsi or port_id required' }, { status: 400 });

      const params = new URLSearchParams({ protocol: 'json', limit });
      if (mmsi)   params.set('mmsi',    mmsi);
      if (portId) params.set('portid',  portId);

      const data = await mtFetch(`/portcalls/v:1/${key}?${params}`, 10 * 60_000);
      const calls = Array.isArray(data) ? data : (data?.data ?? []);
      return NextResponse.json({ portCalls: calls, count: calls.length });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err: any) {
    const msg = err.message ?? '';
    return NextResponse.json({ vessels: [], count: 0, error: msg }, { status: 500 });
  }
}
