import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Overpass API — query OpenStreetMap infrastructure data
// Free, no key. Be respectful with query size.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// 15-min cache per bbox+layer combo
const cache = new Map<string, { data: any; expires: number }>();

const LAYER_QUERIES: Record<string, (bbox: string) => string> = {
  power: (bbox) => `
    [out:json][timeout:25];
    (
      node["power"="plant"](${bbox});
      node["power"="substation"]["substation"="transmission"](${bbox});
      way["power"="plant"](${bbox});
    );
    out center 200;
  `,
  military: (bbox) => `
    [out:json][timeout:25];
    (
      node["military"~"base|airfield|bunker|barracks|range"](${bbox});
      way["military"~"base|airfield|bunker|barracks"](${bbox});
      relation["military"~"base|airfield"](${bbox});
    );
    out center 150;
  `,
  telecoms: (bbox) => `
    [out:json][timeout:25];
    (
      node["man_made"="mast"]["tower:type"~"communication|radio|tv"](${bbox});
      node["tower:type"~"communication|radio|tv|telecommunication"](${bbox});
      node["telecom"="data_center"](${bbox});
      node["man_made"="communications_tower"](${bbox});
    );
    out center 200;
  `,
  ports: (bbox) => `
    [out:json][timeout:25];
    (
      node["harbour"](${bbox});
      node["amenity"="ferry_terminal"](${bbox});
      way["harbour"](${bbox});
      node["aeroway"="aerodrome"](${bbox});
      way["aeroway"="aerodrome"](${bbox});
    );
    out center 150;
  `,
};

const LAYER_EMOJI: Record<string, string> = {
  power:    '⚡',
  military: '🪖',
  telecoms: '📡',
  ports:    '🚢',
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const layer  = searchParams.get('layer') ?? 'power';
  // bbox as south,west,north,east (Overpass format)
  const south  = parseFloat(searchParams.get('south') ?? '20');
  const west   = parseFloat(searchParams.get('west')  ?? '25');
  const north  = parseFloat(searchParams.get('north') ?? '45');
  const east   = parseFloat(searchParams.get('east')  ?? '65');

  if (!LAYER_QUERIES[layer]) {
    return NextResponse.json({ error: `Unknown layer: ${layer}` }, { status: 400 });
  }

  const bbox = `${south},${west},${north},${east}`;
  const cacheKey = `${layer}|${bbox}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  try {
    const query = LAYER_QUERIES[layer](bbox);
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = await res.json();

    const emoji = LAYER_EMOJI[layer] ?? '📍';
    const features = (json.elements ?? []).map((el: any) => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!lat || !lon) return null;

      const tags = el.tags ?? {};
      const name = tags.name ?? tags['name:en'] ?? tags.operator ?? tags.ref ?? '';
      const label = [tags.power, tags.military, tags['tower:type'], tags.telecom, tags.harbour, tags.aeroway]
        .filter(Boolean).join(' / ') || layer;

      return {
        id:      `overpass-${layer}-${el.id}`,
        lat,
        lon,
        name:    name || label,
        layer,
        emoji,
        tags: {
          type:     label,
          operator: tags.operator ?? '',
          voltage:  tags.voltage ?? '',
          country:  tags['addr:country'] ?? tags.country ?? '',
          wikidata: tags.wikidata ?? '',
        },
      };
    }).filter(Boolean);

    const payload = { features, count: features.length, layer };
    cache.set(cacheKey, { data: payload, expires: Date.now() + 15 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ features: [], count: 0, error: err.message }, { status: 500 });
  }
}
