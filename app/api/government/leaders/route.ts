import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 30-min cache — world leaders don't change that often
let leaderCache: { data: any; expires: number } | null = null;

const SPARQL_QUERY = `
SELECT DISTINCT ?person ?personLabel ?country ?countryLabel ?position ?positionLabel ?image WHERE {
  # head of government
  { ?person wdt:P39 ?position . ?position wdt:P1001 ?country . ?position wdt:P279* wd:Q48352 . }
  UNION
  # head of state
  { ?person wdt:P39 ?position . ?position wdt:P1001 ?country . ?position wdt:P279* wd:Q35802 . }
  # must be currently holding (no end time)
  ?person p:P39 ?stmt .
  ?stmt ps:P39 ?position .
  FILTER NOT EXISTS { ?stmt pq:P582 ?endtime }
  # country must be a sovereign state
  ?country wdt:P31/wdt:P279* wd:Q3624078 .
  OPTIONAL { ?person wdt:P18 ?image }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
}
ORDER BY ?countryLabel
LIMIT 300
`.trim();

export async function GET() {
  if (leaderCache && leaderCache.expires > Date.now()) {
    return NextResponse.json(leaderCache.data);
  }

  try {
    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(SPARQL_QUERY)}&format=json`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'GlobalIntelDashboard/1.0',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Wikidata SPARQL ${res.status}`);
    const json = await res.json();

    const seen = new Set<string>();
    const leaders: any[] = [];

    for (const row of json.results?.bindings ?? []) {
      const personId  = row.person?.value?.split('/').pop() ?? '';
      const countryId = row.country?.value?.split('/').pop() ?? '';
      const key = `${personId}:${countryId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const image = row.image?.value ?? null;
      leaders.push({
        personId,
        name:      row.personLabel?.value ?? personId,
        country:   row.countryLabel?.value ?? countryId,
        countryId,
        position:  row.positionLabel?.value ?? '',
        positionId: row.position?.value?.split('/').pop() ?? '',
        imageUrl:  image
          ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(image.split('/').pop()!)}?width=80`
          : null,
        wikidataUrl: `https://www.wikidata.org/wiki/${personId}`,
        wikipediaUrl: `https://en.wikipedia.org/wiki/Special:Search/${encodeURIComponent(row.personLabel?.value ?? '')}`,
      });
    }

    const payload = { leaders, count: leaders.length };
    leaderCache = { data: payload, expires: Date.now() + 30 * 60_000 };
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ leaders: [], count: 0, error: err.message }, { status: 500 });
  }
}
