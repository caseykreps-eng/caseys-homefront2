import { NextResponse } from 'next/server';
import { inflateRaw } from 'node:zlib';
import { promisify } from 'node:util';

export const dynamic = 'force-dynamic';

const inflateRawP = promisify(inflateRaw);

// ---------- Keyword → [lat, lon] ----------
const LOCATION_MAP: Record<string, [number, number]> = {
  'gaza': [31.35, 34.35],
  'israel': [31.5, 34.8],
  'israeli': [31.5, 34.8],
  'lebanon': [33.9, 35.5],
  'lebanese': [33.9, 35.5],
  'hezbollah': [33.5, 35.5],
  'syria': [34.8, 38.9],
  'syrian': [34.8, 38.9],
  'iraq': [33.2, 43.7],
  'iraqi': [33.2, 43.7],
  'iran': [32.4, 53.7],
  'iranian': [32.4, 53.7],
  'yemen': [15.6, 48.5],
  'yemeni': [15.6, 48.5],
  'houthi': [14.8, 44.2],
  'ukraine': [48.4, 31.2],
  'ukrainian': [48.4, 31.2],
  'kyiv': [50.4, 30.5],
  'kharkiv': [50.0, 36.2],
  'russia': [55.7, 37.6],
  'russian': [55.7, 37.6],
  'somalia': [5.2, 46.2],
  'sudan': [12.9, 30.2],
  'myanmar': [19.2, 96.7],
  'pakistan': [30.4, 69.3],
  'afghanistan': [33.9, 67.7],
  'west bank': [31.9, 35.2],
  'ramallah': [31.9, 35.2],
  'red sea': [20.0, 38.5],
  'hormuz': [26.6, 56.3],
  'taiwan': [23.7, 121.0],
  'south china sea': [15.0, 115.0],
  'sahel': [15.0, 2.0],
  'mali': [17.6, -2.0],
  'ethiopia': [9.1, 40.5],
  'congo': [-4.0, 21.8],
};

function geoFromTitle(title: string): [number, number] | null {
  const lower = title.toLowerCase();
  for (const [keyword, coords] of Object.entries(LOCATION_MAP)) {
    if (lower.includes(keyword)) {
      return [coords[0] + (Math.random() - 0.5) * 0.4, coords[1] + (Math.random() - 0.5) * 0.4];
    }
  }
  return null;
}

// ---------- RSS parser (no dependencies) ----------
function parseRss(xml: string): Array<{ title: string; pubDate: string; link: string }> {
  const items: Array<{ title: string; pubDate: string; link: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const titleM = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(block);
    const dateM = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block);
    const linkM = /<link>([\s\S]*?)<\/link>/i.exec(block);
    const title = titleM?.[1]?.trim() ?? '';
    if (title) items.push({
      title,
      pubDate: dateM?.[1]?.trim() ?? '',
      link: linkM?.[1]?.trim() ?? String(Math.random()),
    });
  }
  return items;
}

async function fetchRssFeed(url: string): Promise<Array<{ title: string; pubDate: string; link: string }>> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status} from ${url}`);
  const xml = await res.text();
  return parseRss(xml);
}

// ---------- GDELT event-file helpers (no API key, no rate limits) ----------

// Unzip the first entry from a ZIP buffer using built-in Node zlib
async function unzipFirstEntry(buf: Buffer): Promise<string> {
  if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Not a ZIP file');
  }
  const method   = buf.readUInt16LE(8);
  const nameLen  = buf.readUInt16LE(26);
  const extraLen = buf.readUInt16LE(28);
  const dataStart = 30 + nameLen + extraLen;
  let   compSize  = buf.readUInt32LE(18);

  // If the data-descriptor flag is set, sizes in local header may be 0.
  // Fall back to reading from the central directory record.
  if (compSize === 0) {
    for (let i = buf.length - 22; i >= 0; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {          // end-of-central-dir sig
        const cdOff = buf.readUInt32LE(i + 16);
        if (buf.readUInt32LE(cdOff) === 0x02014b50) {     // central-dir file header sig
          compSize = buf.readUInt32LE(cdOff + 20);
        }
        break;
      }
    }
  }

  if (compSize <= 0 || dataStart + compSize > buf.length) {
    throw new Error('ZIP size mismatch');
  }

  const compressed = buf.subarray(dataStart, dataStart + compSize);
  if (method === 0) return compressed.toString('utf8');            // stored
  if (method === 8) return (await inflateRawP(compressed)).toString('utf8'); // deflate
  throw new Error(`ZIP method ${method} not supported`);
}

// CAMEO event root codes that indicate violence / armed conflict
const CONFLICT_ROOTS = new Set(['18', '19', '20']);

// Human-readable labels for CAMEO event codes
const CAMEO_LABEL: Record<string, string> = {
  '180': 'Armed Assault', '181': 'Abduction / Hostage-Taking',
  '182': 'Physical Assault', '183': 'Chemical / Bio Attack',
  '184': 'Conventional Military Force', '185': 'Blockade',
  '186': 'Territory Occupation', '190': 'Military Action',
  '191': 'Naval Blockade', '192': 'Air Strike',
  '193': 'Suicide / IED Bombing', '194': 'Firearms Used',
  '195': 'Missile / Rocket Attack', '196': 'Grenade / Mortar Attack',
  '200': 'Mass Violence', '201': 'Mass Expulsion',
  '202': 'Mass Killings', '203': 'Ethnic Cleansing',
  '204': 'Weapons of Mass Destruction',
};

// GDELT export CSV column indices (0-based, tab-separated, no header row)
const COL = {
  ACTOR1:    6,
  ACTOR2:    16,
  EVENTCODE: 26,
  ROOTCODE:  28,
  QUADCLASS: 29,
  GOLDSTEIN: 30,
  GEO_NAME:  52,
  GEO_LAT:   56,
  GEO_LON:   57,
  DATEADDED: 59,
  URL:       60,
};

async function fetchGdeltEvents(): Promise<any[]> {
  // Step 1: find the latest 15-min export file
  const lu = await fetch('http://data.gdeltproject.org/gdeltv2/lastupdate.txt', {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!lu.ok) throw new Error(`GDELT lastupdate ${lu.status}`);

  const text = await lu.text();
  const zipUrl = text.split('\n')[0]?.split(/\s+/)[2]?.trim();
  if (!zipUrl?.endsWith('.export.CSV.zip')) throw new Error('GDELT: could not parse lastupdate.txt');

  // Step 2: download the zip (typically 1-4 MB)
  const zipRes = await fetch(zipUrl, {
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!zipRes.ok) throw new Error(`GDELT zip ${zipRes.status}`);

  const zipBuf = Buffer.from(await zipRes.arrayBuffer());

  // Step 3: decompress
  const csv = await unzipFirstEntry(zipBuf);

  // Step 4: parse — no header row, tab-separated
  const events: any[] = [];
  const geoSeen = new Set<string>();

  for (const line of csv.split('\n')) {
    if (!line.trim()) continue;
    const f = line.split('\t');
    if (f.length < 61) continue;

    const rootCode = f[COL.ROOTCODE]?.trim();
    if (!CONFLICT_ROOTS.has(rootCode)) continue;

    const lat = parseFloat(f[COL.GEO_LAT]);
    const lon = parseFloat(f[COL.GEO_LON]);
    if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) continue;

    // Deduplicate by 0.5° grid cell
    const geoKey = `${(lat * 2 | 0)},${(lon * 2 | 0)}`;
    if (geoSeen.has(geoKey)) continue;
    geoSeen.add(geoKey);

    const eventCode = f[COL.EVENTCODE]?.trim() ?? '';
    const label     = CAMEO_LABEL[eventCode] ?? CAMEO_LABEL[rootCode] ?? 'Conflict Event';
    const actor1    = f[COL.ACTOR1]?.trim() || null;
    const actor2    = f[COL.ACTOR2]?.trim() || null;
    const geoName   = f[COL.GEO_NAME]?.trim() || '';
    const goldstein = parseFloat(f[COL.GOLDSTEIN] ?? '0');
    const dateRaw   = f[COL.DATEADDED]?.trim() ?? '';
    const timestamp = dateRaw.length >= 8
      ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
      : 'Recent';

    events.push({
      id: `gdelt_${geoKey}_${eventCode}`,
      event: label,
      actor: [actor1, actor2].filter(Boolean).join(' vs ') || 'Unknown',
      region: geoName,
      lat,
      lon,
      timestamp,
      source: 'GDELT',
      goldstein,
      url: f[COL.URL]?.trim() || null,
    });

    if (events.length >= 120) break;
  }

  // Sort by most severe (most negative Goldstein scale) first
  return events.sort((a, b) => a.goldstein - b.goldstein);
}

// ---- RSS fallback (BBC + Al Jazeera) ----
async function fetchConflictsFromRSS(): Promise<any[]> {
  const feeds = [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
  ];
  const results = await Promise.allSettled(feeds.map(fetchRssFeed));
  const allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  const seen = new Set<string>();
  const events: any[] = [];

  for (const item of allItems) {
    const coords = geoFromTitle(item.title);
    if (!coords || seen.has(item.title)) continue;
    seen.add(item.title);

    const d = item.pubDate ? new Date(item.pubDate) : null;
    const timestamp = d && !isNaN(d.getTime())
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
      : 'Recent';

    events.push({
      id: item.link,
      event: item.title,
      actor: 'News',
      region: '',
      lat: coords[0],
      lon: coords[1],
      timestamp,
      source: 'RSS',
    });
  }
  return events;
}

// ---------- Conflict cache (stale-while-revalidate, 20-min TTL) ----------
let conflictCache: { data: any[]; at: number } = { data: [], at: 0 };
let conflictFetching = false;
const CONFLICT_TTL = 20 * 60_000;

async function fetchConflicts(): Promise<any[]> {
  try {
    const gdelt = await fetchGdeltEvents();
    if (gdelt.length > 0) {
      console.log(`GDELT: loaded ${gdelt.length} conflict events`);
      return gdelt;
    }
  } catch (err) {
    console.warn('GDELT event file fetch failed, falling back to RSS:', err);
  }
  return fetchConflictsFromRSS();
}

function refreshConflictsIfStale(): void {
  if (conflictFetching || Date.now() - conflictCache.at < CONFLICT_TTL) return;
  conflictFetching = true;
  fetchConflicts()
    .then(data => { conflictCache = { data, at: Date.now() }; })
    .catch(err => console.error('Conflict refresh failed:', err))
    .finally(() => { conflictFetching = false; });
}

// ---------- Military aircraft type code → full name ----------
const MILITARY_TYPES: Record<string, string> = {
  // Bombers
  B52: 'B-52 Stratofortress', B1: 'B-1 Lancer', B2: 'B-2 Spirit', B21: 'B-21 Raider',
  TU95: 'Tu-95 Bear', TU160: 'Tu-160 Blackjack', H6: 'H-6 Badger',
  // Fighters / Attack
  F15: 'F-15 Eagle', F16: 'F-16 Falcon', F18: 'F/A-18 Hornet', FA18: 'F/A-18 Super Hornet',
  F22: 'F-22 Raptor', F35: 'F-35 Lightning II', F14: 'F-14 Tomcat',
  A10: 'A-10 Thunderbolt II', AV8: 'AV-8B Harrier', SU27: 'Su-27 Flanker',
  SU34: 'Su-34 Fullback', SU35: 'Su-35 Flanker-E', MIG29: 'MiG-29 Fulcrum',
  MIG31: 'MiG-31 Foxhound', J20: 'J-20 Mighty Dragon',
  // Transport / Airlift
  C17: 'C-17 Globemaster III', C130: 'C-130 Hercules', C5: 'C-5 Galaxy',
  C2: 'C-2 Greyhound', C141: 'C-141 Starlifter', IL76: 'Il-76 Candid',
  A400: 'A400M Atlas', CN235: 'CASA CN-235', C295: 'CASA C-295',
  // Tankers
  KC135: 'KC-135 Stratotanker', KC10: 'KC-10 Extender', KC46: 'KC-46 Pegasus',
  // ISR / Surveillance / SIGINT
  U2: 'U-2 Dragon Lady', RC135: 'RC-135 Rivet Joint', EP3: 'EP-3 Aries',
  E3: 'E-3 Sentry (AWACS)', E8: 'E-8 JSTARS', E6: 'E-6 Mercury',
  E2: 'E-2 Hawkeye', P3: 'P-3 Orion', P8: 'P-8 Poseidon',
  // Drones
  RQ4: 'RQ-4 Global Hawk', MQ9: 'MQ-9 Reaper', MQ1: 'MQ-1 Predator',
  // Helicopters
  UH60: 'UH-60 Black Hawk', MH60: 'MH-60 Sea Hawk', SH60: 'SH-60 Seahawk',
  AH64: 'AH-64 Apache', CH47: 'CH-47 Chinook', V22: 'V-22 Osprey',
  UH1: 'UH-1 Iroquois', AH1: 'AH-1 Cobra',
  // Maritime patrol
  MPA: 'Maritime Patrol Aircraft',
  // Trainers (often fly in mil callsign blocks)
  T38: 'T-38 Talon', T6: 'T-6 Texan II', T45: 'T-45 Goshawk',
};

function resolveType(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return MILITARY_TYPES[upper] ?? code; // fall back to raw code if unknown
}

// ---------- hexdb.io enrichment (owner / country) ----------
// Cached indefinitely — registration doesn't change
const hexEnrichCache = new Map<string, { operator: string; country: string }>();
let hexEnrichQueue: string[] = [];
let hexEnrichRunning = false;

async function processHexEnrichQueue(): Promise<void> {
  if (hexEnrichRunning) return;
  hexEnrichRunning = true;
  try {
    while (hexEnrichQueue.length > 0) {
      const batch = hexEnrichQueue.splice(0, 8); // 8 at a time
      await Promise.allSettled(batch.map(async hex => {
        if (hexEnrichCache.has(hex)) return;
        try {
          const res = await fetch(`https://hexdb.io/api/v1/aircraft/${hex}`, {
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) return;
          const d = await res.json();
          hexEnrichCache.set(hex, {
            operator: d.RegisteredOwners ?? '',
            country: d.Country ?? '',
          });
        } catch { /* skip — not critical */ }
      }));
    }
  } finally {
    hexEnrichRunning = false;
  }
}

// ---------- ADSB.lol flights ----------
function mapAircraft(a: any): any {
  const hex: string = a.hex || '';
  const enrich = hexEnrichCache.get(hex);
  // Queue hex for background enrichment if not yet cached
  if (hex && !hexEnrichCache.has(hex) && !hexEnrichQueue.includes(hex)) {
    hexEnrichQueue.push(hex);
  }
  return {
    id: hex || String(Math.random()),
    event: a.flight?.trim() || a.r || 'Unknown Callsign',
    actor: a.r || hex || 'Unknown',           // tail number / registration
    region: a.t || '',                         // raw ICAO type code
    aircraftType: resolveType(a.t),            // human-readable type name
    operator: enrich?.operator ?? null,
    country: enrich?.country ?? null,
    lat: a.lat as number,
    lon: a.lon as number,
    heading: a.track ?? null,
    altitude: typeof a.alt_baro === 'number' ? Math.round(a.alt_baro * 0.3048) : null,
    velocity: a.gs != null ? Math.round(a.gs * 0.514444) : null,
    timestamp: 'Live',
    source: 'ADS-B',
  };
}

async function adsbFetch(url: string): Promise<any[]> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`adsb.lol ${res.status}`);
  const text = await res.text();
  if (!text || text.trim() === '') return [];
  const data = JSON.parse(text);
  return (data.ac || []).filter((a: any) => a.lat != null && a.lon != null && a.alt_baro !== 'ground');
}

async function fetchFlights(): Promise<any[]> {
  // /v2/mil returns only aircraft with military/government hex blocks and squawk codes
  // The regional endpoint was also catching commercial traffic — removed
  const aircraft = await adsbFetch('https://api.adsb.lol/v2/mil');
  const seen = new Set<string>();
  const result: any[] = [];
  for (const a of aircraft) {
    const key = a.hex || String(Math.random());
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(mapAircraft(a));
    if (result.length >= 150) break;
  }
  return result;
}

// ---------- NASA FIRMS fire hotspots ----------
// Area: west,south,east,north — covers Middle East + Eastern Europe
const FIRMS_AREA = '15,10,65,55';

let fireCache: { data: any[]; at: number } = { data: [], at: 0 };
let fireFetching = false;
const FIRE_TTL = 30 * 60_000;

function parseFirmsCSV(csv: string): any[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (values[i] ?? '').trim().replace(/"/g, ''); });
    return obj;
  });
}

async function fetchFires(): Promise<any[]> {
  const key = process.env.NASA_FIRMS_KEY;
  if (!key) return [];

  // VIIRS SNPP NRT — most current near-real-time satellite fire detections
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${FIRMS_AREA}/1`;
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);

  const csv = await res.text();
  const rows = parseFirmsCSV(csv);

  return rows
    .filter(r => r.confidence === 'h' && parseFloat(r.frp) >= 5)
    .map((r, i) => ({
      id: `fire_${r.acq_date}_${r.acq_time}_${i}`,
      event: `Fire Detected — ${parseFloat(r.frp).toFixed(0)} MW`,
      actor: `${r.satellite === 'N' ? 'VIIRS SNPP' : r.satellite} · ${r.daynight === 'N' ? 'Night' : 'Day'}`,
      region: 'NASA FIRMS',
      lat: parseFloat(r.latitude),
      lon: parseFloat(r.longitude),
      timestamp: `${r.acq_date} ${r.acq_time?.substring(0, 2)}:${r.acq_time?.substring(2, 4)}z`,
      source: 'FIRMS',
      frp: parseFloat(r.frp),
    }))
    .filter(f => !isNaN(f.lat) && !isNaN(f.lon));
}

function refreshFiresIfStale(): void {
  if (fireFetching || Date.now() - fireCache.at < FIRE_TTL) return;
  fireFetching = true;
  fetchFires()
    .then(data => { fireCache = { data, at: Date.now() }; })
    .catch(err => console.error('FIRMS refresh failed:', err))
    .finally(() => { fireFetching = false; });
}

// ---------- Route ----------
export async function GET() {
  refreshConflictsIfStale();
  refreshFiresIfStale();

  const militaryFlights = await fetchFlights().catch(err => {
    console.error('ADSB.lol fetch failed:', err);
    return [] as any[];
  });

  if (hexEnrichQueue.length > 0) processHexEnrichQueue();

  return NextResponse.json({
    militaryFlights,
    navalEvents: [],
    conflicts: conflictCache.data,
    fires: fireCache.data,
  });
}
