'use client';

import { useState, useEffect } from 'react';

const WORLD_NEWS_CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Conflict', value: 'conflict' },
  { label: 'Naval', value: 'naval' },
  { label: 'Military', value: 'military' },
];

// Keywords to filter HN stories relevant to intel/security/geopolitics
const HN_KEYWORDS = [
  'war', 'military', 'cyber', 'hack', 'breach', 'missile', 'drone', 'intel',
  'security', 'russia', 'china', 'iran', 'nato', 'conflict', 'attack',
  'surveillance', 'nsa', 'cia', 'fbi', 'espionage', 'nuclear', 'terror',
  'ukraine', 'israel', 'pentagon', 'dod', 'threat', 'vulnerability', 'exploit',
  'ransomware', 'malware', 'phishing', 'osint', 'geopolit', 'sanction',
];

function sentimentBadge(score: number | undefined) {
  if (score == null) return { label: 'Neutral', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (score < -0.1)  return { label: 'Negative', color: 'bg-red-100 text-red-700 border-red-200' };
  if (score > 0.1)   return { label: 'Positive', color: 'bg-green-100 text-green-700 border-green-200' };
  return { label: 'Neutral', color: 'bg-slate-100 text-slate-600 border-slate-200' };
}

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return 'Unknown';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function hnRelativeTime(unixTs: number): string {
  const diff = Date.now() - unixTs * 1000;
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function fetchHNStories(): Promise<any[]> {
  const topIds: number[] = await fetch(
    'https://hacker-news.firebaseio.com/v0/topstories.json'
  ).then(r => r.json());

  // Fetch first 80 stories, then filter for relevant ones
  const batch = topIds.slice(0, 80);
  const stories = await Promise.all(
    batch.map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r => r.json())
        .catch(() => null)
    )
  );

  return stories
    .filter(s => s && s.title && s.url)
    .filter(s => {
      const text = (s.title + ' ' + (s.url ?? '')).toLowerCase();
      return HN_KEYWORDS.some(kw => text.includes(kw));
    })
    .slice(0, 30);
}

export default function NewsFeedPage() {
  const [activeSource, setActiveSource] = useState<'worldnews' | 'hackernews'>('worldnews');
  const [news, setNews] = useState<any[]>([]);
  const [hnStories, setHnStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hnLoading, setHnLoading] = useState(false);
  const [hnLoaded, setHnLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');

  // Load World News
  useEffect(() => {
    if (activeSource !== 'worldnews') return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/news?category=${activeFilter}`);
        const data = await res.json();
        if (data.error && !data.news?.length) setError(data.error);
        setNews(data.news ?? []);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeFilter, activeSource]);

  // Load HackerNews (once per session)
  useEffect(() => {
    if (activeSource !== 'hackernews' || hnLoaded) return;
    setHnLoading(true);
    fetchHNStories()
      .then(s => { setHnStories(s); setHnLoaded(true); })
      .catch(e => setError(String(e)))
      .finally(() => setHnLoading(false));
  }, [activeSource, hnLoaded]);

  const isLoading = activeSource === 'worldnews' ? loading : hnLoading;

  return (
    <div className="p-8 bg-[#fff0f8] dark:bg-[#0f172a] min-h-full">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-2">
          Live News Feed
        </h1>

        {/* Source selector */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveSource('worldnews')}
            className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all border ${
              activeSource === 'worldnews'
                ? 'bg-purple-500 text-white border-purple-500 shadow-md'
                : 'bg-white dark:bg-slate-800 border-purple-200 hover:border-purple-400'
            }`}
          >
            🌐 World News API
          </button>
          <button
            onClick={() => setActiveSource('hackernews')}
            className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all border ${
              activeSource === 'hackernews'
                ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                : 'bg-white dark:bg-slate-800 border-orange-200 hover:border-orange-400'
            }`}
          >
            🔶 HackerNews · Intel & Security
          </button>
        </div>

        {/* World News filters */}
        {activeSource === 'worldnews' && (
          <div className="flex gap-3 mb-8 flex-wrap">
            {WORLD_NEWS_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setActiveFilter(cat.value)}
                className={`px-6 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                  activeFilter === cat.value
                    ? 'bg-pink-500 text-white shadow-md'
                    : 'bg-white dark:bg-slate-800 border border-pink-200 hover:border-pink-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {activeSource === 'hackernews' && (
          <p className="text-xs text-orange-500 font-mono uppercase tracking-widest mb-8">
            Hacker News · Top stories filtered for security &amp; geopolitics · Live
          </p>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error.includes('API key')
              ? 'Add your WORLDNEWS_API_KEY to .env and restart.'
              : `Feed error: ${error}`}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-3xl bg-white dark:bg-slate-800 border border-purple-100 animate-pulse" />
            ))}
          </div>
        ) : activeSource === 'worldnews' ? (
          news.length === 0 ? (
            <div className="p-20 text-center text-slate-400 text-lg italic">No matching headlines right now...</div>
          ) : (
            <div className="space-y-5">
              {news.map((item) => {
                const badge = sentimentBadge(item.sentiment);
                return (
                  <a
                    key={item.id}
                    href={item.url ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex gap-5 p-5 rounded-3xl bg-white dark:bg-slate-800 border border-purple-100 hover:border-purple-400 hover:shadow-xl transition-all group"
                  >
                    {item.image && (
                      <img
                        src={item.image}
                        alt=""
                        className="w-28 h-20 object-cover rounded-2xl flex-shrink-0 opacity-90 group-hover:opacity-100"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h2 className="font-semibold text-base leading-snug group-hover:text-purple-600 transition-colors line-clamp-2">
                          {item.title}
                        </h2>
                        <span className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      {item.summary && (
                        <p className="text-sm text-slate-500 line-clamp-2 mb-2">{item.summary}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        {item.authors?.length > 0 && <span className="text-purple-500 font-medium">{item.authors[0]}</span>}
                        {item.authors?.length > 0 && <span>·</span>}
                        <span>{relativeTime(item.publish_date)}</span>
                        {item.sentiment != null && (
                          <><span>·</span><span>Sentiment: {item.sentiment.toFixed(2)}</span></>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )
        ) : (
          // HackerNews stories
          hnStories.length === 0 ? (
            <div className="p-20 text-center text-slate-400 text-lg italic">No relevant stories found...</div>
          ) : (
            <div className="space-y-3">
              {hnStories.map((story, i) => (
                <a
                  key={story.id}
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-slate-800 border border-orange-100 hover:border-orange-400 hover:shadow-xl transition-all group"
                >
                  <div className="text-orange-300 font-mono text-sm w-6 shrink-0 pt-0.5 text-right">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-base leading-snug group-hover:text-orange-600 transition-colors">
                      {story.title}
                    </h2>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span className="text-orange-500 font-medium">{story.score} pts</span>
                      <span>·</span>
                      <span>{story.descendants ?? 0} comments</span>
                      <span>·</span>
                      <span>{hnRelativeTime(story.time)}</span>
                      <span>·</span>
                      <span className="truncate max-w-[160px]">{story.by}</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0 font-mono">
                    {story.url ? new URL(story.url).hostname.replace('www.', '') : 'text'}
                  </div>
                </a>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
