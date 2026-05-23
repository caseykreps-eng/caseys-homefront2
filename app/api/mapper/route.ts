import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const KEY = process.env.MEDIASTACK_KEY;

// Country code → readable name
const COUNTRY_NAMES: Record<string, string> = {
  us: 'United States', gb: 'United Kingdom', ru: 'Russia', cn: 'China',
  ir: 'Iran', il: 'Israel', ps: 'Palestine', sy: 'Syria', iq: 'Iraq',
  sa: 'Saudi Arabia', ua: 'Ukraine', tr: 'Turkey', de: 'Germany',
  fr: 'France', jo: 'Jordan', lb: 'Lebanon', ye: 'Yemen', af: 'Afghanistan',
  pk: 'Pakistan', in: 'India', eg: 'Egypt', ly: 'Libya', so: 'Somalia',
  sd: 'Sudan', et: 'Ethiopia', ng: 'Nigeria', au: 'Australia', ca: 'Canada',
};

// Known organizations/actors to extract from article text
const ORG_KEYWORDS = [
  'Hamas', 'Hezbollah', 'ISIS', 'ISIL', 'Al-Qaeda', 'Taliban', 'Houthi',
  'NATO', 'UN', 'CIA', 'FBI', 'Mossad', 'Pentagon', 'Kremlin', 'White House',
  'EU', 'IMF', 'WHO', 'IAEA', 'Interpol', 'Wagner', 'Azov', 'IDF',
  'PLO', 'Fatah', 'PKK', 'Boko Haram', 'Al-Shabaab',
  'Russia', 'China', 'Iran', 'Israel', 'Ukraine', 'USA',
  'Biden', 'Trump', 'Putin', 'Netanyahu', 'Zelensky', 'Xi Jinping',
];

// 24-hour in-memory cache per query
const queryCache = new Map<string, { data: any; expires: number }>();

function extractOrgs(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const org of ORG_KEYWORDS) {
    if (lower.includes(org.toLowerCase())) found.push(org);
  }
  return [...new Set(found)];
}

function buildGraph(query: string, articles: any[]) {
  const nodes: any[] = [];
  const edges: any[] = [];
  const seen = new Set<string>();

  const addNode = (id: string, label: string, type: string, meta: any = {}) => {
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push({ id, label, type, ...meta });
    }
  };

  const addEdge = (source: string, target: string, label = '') => {
    edges.push({ source, target, label });
  };

  // Center target node
  const targetId = `target:${query}`;
  addNode(targetId, query, 'target');

  articles.slice(0, 20).forEach((article, i) => {
    const title = article.title || 'Untitled';
    const truncated = title.length > 55 ? title.slice(0, 52) + '...' : title;
    const articleId = `article:${i}`;

    addNode(articleId, truncated, 'event', {
      url: article.url,
      published: article.published_at,
      description: article.description,
    });
    addEdge(targetId, articleId, 'mentioned in');

    // Source node
    if (article.source) {
      const sourceId = `source:${article.source}`;
      addNode(sourceId, article.source, 'source');
      addEdge(articleId, sourceId, 'published by');
    }

    // Location node from country
    if (article.country && COUNTRY_NAMES[article.country]) {
      const locationId = `location:${article.country}`;
      addNode(locationId, COUNTRY_NAMES[article.country], 'location');
      addEdge(articleId, locationId, 'reported from');
    }

    // Organization nodes extracted from title + description
    const text = `${title} ${article.description || ''}`;
    const orgs = extractOrgs(text);
    orgs.forEach(org => {
      if (org.toLowerCase() === query.toLowerCase()) return;
      const orgId = `org:${org}`;
      addNode(orgId, org, 'organization');
      addEdge(articleId, orgId, 'involves');
    });
  });

  return { nodes, edges };
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')?.trim();
  if (!query) return NextResponse.json({ nodes: [], edges: [] });

  const cacheKey = query.toLowerCase();
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  if (!KEY) {
    return NextResponse.json({ error: 'MEDIASTACK_KEY not configured' }, { status: 500 });
  }

  try {
    const url = `http://api.mediastack.com/v1/news?access_key=${KEY}&keywords=${encodeURIComponent(query)}&limit=25&languages=en&sort=published_desc`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`MediaStack ${res.status}`);
    const json = await res.json();

    const articles = json.data || [];
    const graph = buildGraph(query, articles);

    const result = { ...graph, total: articles.length, query };
    queryCache.set(cacheKey, { data: result, expires: Date.now() + 24 * 60 * 60 * 1000 });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message, nodes: [], edges: [] }, { status: 500 });
  }
}
