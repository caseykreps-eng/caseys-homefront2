import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Conflict intelligence RSS feeds — no keys required
const SOURCES = [
  {
    name: 'ISW',
    label: 'Institute for the Study of War',
    url: 'https://www.understandingwar.org/rss.xml',
    category: 'Analysis',
    color: 'red',
  },
  {
    name: 'Airwars',
    label: 'Airwars',
    url: 'https://airwars.org/feed/',
    category: 'Civilian Casualties',
    color: 'orange',
  },
  {
    name: 'Bellingcat',
    label: 'Bellingcat',
    url: 'https://www.bellingcat.com/feed/',
    category: 'OSINT Investigation',
    color: 'blue',
  },
  {
    name: 'ReliefWeb',
    label: 'ReliefWeb (UN OCHA)',
    url: 'https://reliefweb.int/updates/rss.xml',
    category: 'Humanitarian',
    color: 'teal',
  },
  {
    name: 'RadioFreeEurope',
    label: 'Radio Free Europe',
    url: 'https://www.rferl.org/api/zpiqeu-eqirue/rss',
    category: 'Eastern Europe',
    color: 'purple',
  },
  {
    name: 'AlMonitor',
    label: 'Al-Monitor',
    url: 'https://www.al-monitor.com/rss',
    category: 'Middle East',
    color: 'yellow',
  },
];

const cache = new Map<string, { items: any[]; fetched: number }>();
let lastFull: { items: any[]; expires: number } | null = null;

function parseRSS(xml: string, source: typeof SOURCES[0]): any[] {
  const items: any[] = [];
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tag}>`, 'i'));
      return m ? m[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#[0-9]+;/g, '') : '';
    };
    const title   = get('title');
    const link    = get('link');
    const pubDate = get('pubDate');
    const desc    = get('description').replace(/<[^>]+>/g, '').slice(0, 300);
    if (!title || !link) continue;
    items.push({
      id:          `${source.name}-${link}`,
      title,
      link,
      description: desc,
      pubDate,
      timestamp:   pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      source:      source.name,
      sourceLabel: source.label,
      category:    source.category,
      color:       source.color,
    });
  }
  return items;
}

async function fetchSource(source: typeof SOURCES[0]): Promise<any[]> {
  const hit = cache.get(source.name);
  if (hit && Date.now() - hit.fetched < 10 * 60_000) return hit.items;
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'GlobalIntelDashboard/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const xml = await res.text();
    const items = parseRSS(xml, source).slice(0, 15);
    cache.set(source.name, { items, fetched: Date.now() });
    return items;
  } catch {
    return cache.get(source.name)?.items ?? [];
  }
}

export async function GET() {
  if (lastFull && lastFull.expires > Date.now()) {
    return NextResponse.json({ items: lastFull.items });
  }

  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const items = results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 80);

  lastFull = { items, expires: Date.now() + 8 * 60_000 };
  return NextResponse.json({ items, sources: SOURCES.map(s => s.name) });
}
