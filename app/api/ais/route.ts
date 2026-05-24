import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * AIS vessel tracking via aisstream.io
 * Free tier — sign up at https://aisstream.io to get an API key
 * Set AIS_KEY in .env
 *
 * On each request we open a WebSocket, subscribe to a bounding box,
 * collect messages for COLLECT_MS, close, cache for CACHE_MS, return.
 * Node 24 has built-in WebSocket — no extra packages needed.
 */

const AIS_WS   = 'wss://stream.aisstream.io/v0/stream';
const COLLECT_MS = 6000;   // collect AIS messages for 6 seconds per request
const CACHE_MS   = 3 * 60_000; // cache results 3 minutes

const cache = new Map<string, { vessels: any[]; expires: number }>();

// Default bounding boxes
const BBOXES: Record<string, number[][]> = {
  // [minLat, minLon, maxLat, maxLon]
  global:       [[-90, -180, 90, 180]],
  medBlackSea:  [[28, -6,  48, 42]],
  persianGulf:  [[20, 48,  32, 62]],
  redSea:       [[10, 30,  30, 50]],
  hormuz:       [[22, 54,  27, 60]],
  bosporus:     [[40, 28,  42, 30]],
  northAtlantic:[[ 0, -70, 65, 20]],
  indiaOcean:   [[-30, 30, 30, 90]],
};

// MMSI vessel type filter → aisstream ShipType codes
const SHIP_TYPES: Record<string, number[]> = {
  tanker:    [80, 81, 82, 83, 84, 85, 86, 87, 88, 89],
  cargo:     [70, 71, 72, 73, 74, 75, 76, 77, 78, 79],
  lng:       [80],   // tankers (LNG falls here)
  military:  [35],
  tug:       [21, 22],
  passenger: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69],
  fishing:   [30],
  all:       [],
};

function streamAIS(key: string, bbox: number[][], filterTypes: number[]): Promise<any[]> {
  return new Promise((resolve) => {
    const vessels = new Map<string, any>();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      resolve([...vessels.values()]);
    };

    // Node 24 built-in WebSocket
    const ws = new (globalThis as any).WebSocket(AIS_WS);
    const timer = setTimeout(finish, COLLECT_MS + 2000);

    ws.onopen = () => {
      const sub: any = {
        Apikey: key,
        BoundingBoxes: bbox.map(b => [
          [b[0], b[1]],
          [b[2], b[3]],
        ]),
        FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'],
      };
      if (filterTypes.length > 0) sub.FilterShipMMSI = undefined; // can't filter by type in sub, do it post
      ws.send(JSON.stringify(sub));
      setTimeout(finish, COLLECT_MS);
    };

    ws.onmessage = (event: any) => {
      try {
        const msg = JSON.parse(event.data);
        const meta = msg.MetaData ?? {};
        const pos  = msg.Message?.PositionReport
               ?? msg.Message?.StandardClassBPositionReport
               ?? msg.Message?.ExtendedClassBPositionReport;
        if (!pos) return;

        const mmsi = String(meta.MMSI ?? pos.UserID ?? '');
        if (!mmsi) return;

        // Apply ship type filter post-receive
        if (filterTypes.length > 0) {
          // ShipType in AIS is in the vessel data, not always in position report
          // Skip type filter here — apply when we have it
        }

        const lat = pos.Latitude  ?? meta.latitude_dd;
        const lon = pos.Longitude ?? meta.longitude_dd;
        if (!lat || !lon || lat === 0 || lon === 0) return;

        vessels.set(mmsi, {
          id:          `ais-${mmsi}`,
          mmsi,
          name:        meta.ShipName?.trim() || `MMSI ${mmsi}`,
          lat:         parseFloat(lat.toFixed(5)),
          lon:         parseFloat(lon.toFixed(5)),
          speed:       pos.SpeedOverGround ?? 0,
          heading:     pos.TrueHeading ?? pos.CourseOverGround ?? 0,
          status:      pos.NavigationalStatus ?? 0,
          destination: meta.Destination?.trim() ?? '',
          shipType:    meta.ShipType ?? 0,
          flag:        meta.MMSI ? mmsiToFlag(String(meta.MMSI)) : '',
          timestamp:   meta.time_utc ?? new Date().toISOString(),
          imo:         meta.IMONumber ?? null,
          callsign:    meta.CallSign?.trim() ?? '',
          length:      meta.Dimension?.A != null
                         ? (meta.Dimension.A + meta.Dimension.B)
                         : null,
          source:      'aisstream',
        });
      } catch { /* malformed message */ }
    };

    ws.onerror = () => { clearTimeout(timer); finish(); };
    ws.onclose = () => { clearTimeout(timer); finish(); };
  });
}

// Rough MMSI → flag country (MID prefix lookup)
function mmsiToFlag(mmsi: string): string {
  const mid = mmsi.slice(0, 3);
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

// Navigational status → label
function navStatus(code: number): string {
  const s: Record<number, string> = {
    0: 'Underway', 1: 'At anchor', 2: 'Not under command',
    3: 'Restricted maneuverability', 5: 'Moored', 6: 'Aground', 7: 'Engaged in fishing',
    8: 'Underway sailing', 15: 'Not defined',
  };
  return s[code] ?? 'Unknown';
}

export async function GET(req: NextRequest) {
  const key = process.env.AIS_KEY;
  if (!key) {
    return NextResponse.json({
      vessels: [],
      count: 0,
      error: 'AIS_KEY not set — sign up free at aisstream.io and add AIS_KEY to .env',
      notConfigured: true,
    });
  }

  const region    = req.nextUrl.searchParams.get('region') ?? 'medBlackSea';
  const typeParam = req.nextUrl.searchParams.get('type')   ?? 'all';
  const cacheKey  = `${region}:${typeParam}`;

  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json({ vessels: hit.vessels, count: hit.vessels.length, cached: true, region });
  }

  const bbox        = BBOXES[region] ?? BBOXES.medBlackSea;
  const filterTypes = SHIP_TYPES[typeParam] ?? [];

  try {
    const rawVessels = await streamAIS(key, bbox, filterTypes);

    // Post-filter by ship type if requested
    const vessels = typeParam !== 'all' && filterTypes.length > 0
      ? rawVessels.filter(v => filterTypes.includes(v.shipType) || filterTypes.some(t => Math.floor(v.shipType / 10) === Math.floor(t / 10)))
      : rawVessels;

    // Add readable status
    const enriched = vessels.map(v => ({ ...v, statusLabel: navStatus(v.status) }));

    cache.set(cacheKey, { vessels: enriched, expires: Date.now() + CACHE_MS });
    return NextResponse.json({ vessels: enriched, count: enriched.length, region });
  } catch (err: any) {
    return NextResponse.json({ vessels: [], count: 0, error: err.message }, { status: 500 });
  }
}
