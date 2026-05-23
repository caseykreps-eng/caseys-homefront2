import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// 1,500 req/month free tier → cache 30 min = ~48 req/day, well within limit
let newsCache: { data: any[]; at: number } = { data: [], at: 0 };
const NEWS_TTL = 30 * 60_000;

function filterByCategory(news: any[], category: string): any[] {
  if (category === 'all') return news;
  return news.filter(item => {
    const text = ((item.title ?? '') + ' ' + (item.text ?? '')).toLowerCase();
    if (category === 'conflict') return text.includes('strike') || text.includes('missile') || text.includes('attack') || text.includes('drone') || text.includes('explosion');
    if (category === 'naval')    return text.includes('naval') || text.includes('ship') || text.includes('fleet') || text.includes('submarine');
    if (category === 'military') return text.includes('military') || text.includes('air force') || text.includes('nato') || text.includes('troops');
    return true;
  });
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? 'all';

  // Serve from cache if fresh
  if (Date.now() - newsCache.at < NEWS_TTL && newsCache.data.length > 0) {
    return NextResponse.json({ news: filterByCategory(newsCache.data, category), cached: true });
  }

  const apiKey = process.env.WORLDNEWS_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    console.warn('WORLDNEWS_API_KEY not set — news feed will be empty');
    return NextResponse.json({ news: [], error: 'API key not configured' });
  }

  try {
    const params = new URLSearchParams({
      text: 'military OR conflict OR strike OR attack OR drone OR missile OR war OR troops',
      language: 'en',
      number: '50',
    });

    const res = await fetch(`https://api.worldnewsapi.com/search-news?${params}`, {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`WorldNews ${res.status}`);

    const data = await res.json();
    newsCache = { data: data.news ?? [], at: Date.now() };

    return NextResponse.json({ news: filterByCategory(newsCache.data, category) });
  } catch (err) {
    console.error('WorldNews API failed:', err);
    // Return stale cache rather than empty
    return NextResponse.json({ news: filterByCategory(newsCache.data, category), error: String(err) });
  }
}
