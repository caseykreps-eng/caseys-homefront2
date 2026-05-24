'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Constants ─────────────────────────────────────────────────────────────────
const HN_KEYWORDS = [
  'war', 'military', 'cyber', 'hack', 'breach', 'missile', 'drone', 'intel',
  'security', 'russia', 'china', 'iran', 'nato', 'conflict', 'attack',
  'surveillance', 'nsa', 'cia', 'fbi', 'espionage', 'nuclear', 'terror',
  'ukraine', 'israel', 'pentagon', 'dod', 'threat', 'vulnerability', 'exploit',
  'ransomware', 'malware', 'phishing', 'osint', 'geopolit', 'sanction',
];

const CONFLICT_SOURCES = [
  { name: 'ISW',             label: 'Institute for the Study of War', color: 'red',    category: 'Analysis' },
  { name: 'Airwars',         label: 'Airwars',                         color: 'orange', category: 'Civilian Casualties' },
  { name: 'Bellingcat',      label: 'Bellingcat',                      color: 'blue',   category: 'OSINT Investigation' },
  { name: 'ReliefWeb',       label: 'ReliefWeb (UN OCHA)',             color: 'teal',   category: 'Humanitarian' },
  { name: 'RadioFreeEurope', label: 'Radio Free Europe',               color: 'purple', category: 'Eastern Europe' },
  { name: 'AlMonitor',       label: 'Al-Monitor',                      color: 'yellow', category: 'Middle East' },
];

const TG_CHANNEL_COLORS: Record<string, string> = {
  'Russian mil-blog': 'bg-red-100 text-red-700 border-red-200',
  'Translations':     'bg-orange-100 text-orange-700 border-orange-200',
  'Analysis':         'bg-blue-100 text-blue-700 border-blue-200',
  'Ukrainian':        'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Official':         'bg-slate-100 text-slate-600 border-slate-200',
  'Breaking news':    'bg-pink-100 text-pink-700 border-pink-200',
  'Middle East':      'bg-amber-100 text-amber-700 border-amber-200',
  'Investigations':   'bg-purple-100 text-purple-700 border-purple-200',
  'OSINT':            'bg-teal-100 text-teal-700 border-teal-200',
};

const SOURCE_COLORS: Record<string, string> = {
  red:    'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
  teal:   'bg-teal-100 text-teal-700 border-teal-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

function sentimentBadge(score: number | undefined) {
  if (score == null) return { label: 'Neutral', color: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (score < -0.1)  return { label: 'Negative', color: 'bg-red-100 text-red-700 border-red-200' };
  if (score > 0.1)   return { label: 'Positive', color: 'bg-green-100 text-green-700 border-green-200' };
  return { label: 'Neutral', color: 'bg-slate-100 text-slate-600 border-slate-200' };
}

async function fetchHNStories(): Promise<any[]> {
  const topIds: number[] = await fetch(
    'https://hacker-news.firebaseio.com/v0/topstories.json'
  ).then(r => r.json());
  const stories = await Promise.all(
    topIds.slice(0, 80).map(id =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r => r.json()).catch(() => null)
    )
  );
  return stories
    .filter(s => s?.title && s?.url)
    .filter(s => HN_KEYWORDS.some(kw => (s.title + ' ' + (s.url ?? '')).toLowerCase().includes(kw)))
    .slice(0, 30);
}

// ─── Component ─────────────────────────────────────────────────────────────────
type Tab = 'conflict' | 'telegram' | 'worldnews' | 'hackernews';

export default function NewsFeedPage() {
  const [tab, setTab] = useState<Tab>('conflict');

  // World News
  const [news, setNews] = useState<any[]>([]);
  const [newsFilter, setNewsFilter] = useState('all');
  const [newsLoading, setNewsLoading] = useState(false);

  // HackerNews
  const [hnStories, setHnStories] = useState<any[]>([]);
  const [hnLoading, setHnLoading] = useState(false);
  const [hnLoaded, setHnLoaded] = useState(false);

  // Conflict RSS
  const [conflictItems, setConflictItems] = useState<any[]>([]);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [conflictFilter, setConflictFilter] = useState('all');
  const [conflictLoaded, setConflictLoaded] = useState(false);

  // Telegram (MTProto relay → RSS fallback)
  const [tgItems, setTgItems] = useState<any[]>([]);
  const [tgTotal, setTgTotal] = useState(0);
  const [tgChannels, setTgChannels] = useState<any[]>([]);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgLoaded, setTgLoaded] = useState(false);
  const [tgChannelFilter, setTgChannelFilter] = useState('all');
  const [tgCategoryFilter, setTgCategoryFilter] = useState('all');
  const [tgError, setTgError] = useState<string | null>(null);
  const [tgSource, setTgSource] = useState<'relay' | 'rss' | null>(null);

  const [error, setError] = useState<string | null>(null);

  // ── World News ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'worldnews') return;
    setNewsLoading(true); setError(null);
    fetch(`/api/news?category=${newsFilter}`)
      .then(r => r.json())
      .then(d => { setNews(d.news ?? []); if (d.error && !d.news?.length) setError(d.error); })
      .catch(e => setError(String(e)))
      .finally(() => setNewsLoading(false));
  }, [newsFilter, tab]);

  // ── HackerNews ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'hackernews' || hnLoaded) return;
    setHnLoading(true);
    fetchHNStories()
      .then(s => { setHnStories(s); setHnLoaded(true); })
      .catch(e => setError(String(e)))
      .finally(() => setHnLoading(false));
  }, [tab, hnLoaded]);

  // ── Conflict RSS ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'conflict' || conflictLoaded) return;
    setConflictLoading(true);
    fetch('/api/conflict-rss')
      .then(r => r.json())
      .then(d => { setConflictItems(d.items ?? []); setConflictLoaded(true); })
      .catch(e => setError(String(e)))
      .finally(() => setConflictLoading(false));
  }, [tab, conflictLoaded]);

  // ── Telegram RSS ─────────────────────────────────────────────────────────────
  const loadTelegram = useCallback(async (force = false) => {
    if (tgLoaded && !force) return;
    setTgLoading(true); setTgError(null);
    try {
      const params = new URLSearchParams({ limit: '150' });
      if (tgChannelFilter !== 'all') params.set('channel', tgChannelFilter);
      if (tgCategoryFilter !== 'all') params.set('category', tgCategoryFilter);
      const res = await fetch(`/api/telegram-feed?${params}`);
      const d = await res.json();
      setTgItems(d.items ?? []);
      setTgTotal(d.total ?? 0);
      setTgChannels(d.channels ?? []);
      setTgSource(d.source ?? 'rss');
      setTgLoaded(true);
    } catch (e) {
      setTgError(String(e));
    } finally {
      setTgLoading(false);
    }
  }, [tgLoaded, tgChannelFilter, tgCategoryFilter]);

  useEffect(() => {
    if (tab !== 'telegram') return;
    loadTelegram();
  }, [tab, loadTelegram]);

  // Refetch when channel/category filter changes
  useEffect(() => {
    if (tab !== 'telegram') return;
    setTgLoaded(false);
  }, [tgChannelFilter, tgCategoryFilter]);

  // Filtered conflict items
  const filteredConflict = conflictFilter === 'all'
    ? conflictItems
    : conflictItems.filter(i => i.source === conflictFilter);

  // Telegram categories
  const tgCategories = [...new Set(tgChannels.map((c: any) => c.category))];

  return (
    <div className="p-8 bg-[#fff0f8] dark:bg-[#0f172a] min-h-full">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-2">
          Live News Feed
        </h1>
        <p className="text-slate-400 text-sm mb-6">Real-time intel from conflict reporters, OSINT sources, and Telegram channels.</p>

        {/* Tab bar */}
        <div className="flex gap-2 mb-7 flex-wrap">
          {([
            { id: 'conflict',   label: '🔴 Conflict Intel',   active: 'bg-red-600' },
            { id: 'telegram',   label: '✈️ Telegram Channels', active: 'bg-sky-600' },
            { id: 'worldnews',  label: '🌐 World News',        active: 'bg-purple-600' },
            { id: 'hackernews', label: '🔶 HackerNews',        active: 'bg-orange-500' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id as Tab); setError(null); }}
              className={`px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all border ${
                tab === t.id
                  ? `${t.active} text-white border-transparent shadow-md`
                  : 'bg-white dark:bg-slate-800 border-slate-200 hover:shadow'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        {/* ── CONFLICT INTEL ─────────────────────────────────────────────────── */}
        {tab === 'conflict' && (
          <>
            <div className="flex gap-2 mb-6 flex-wrap">
              <button onClick={() => setConflictFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${conflictFilter === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-200'}`}>
                All Sources
              </button>
              {CONFLICT_SOURCES.map(src => (
                <button key={src.name} onClick={() => setConflictFilter(src.name)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${conflictFilter === src.name ? 'bg-slate-700 text-white border-slate-700' : `bg-white dark:bg-slate-800 ${SOURCE_COLORS[src.color]}`}`}>
                  {src.label}
                </button>
              ))}
              <button onClick={() => { setConflictLoaded(false); setConflictItems([]); }}
                className="ml-auto px-4 py-2 rounded-xl text-xs border border-slate-200 bg-white dark:bg-slate-800 hover:border-slate-400">
                ↺ Refresh
              </button>
            </div>

            {conflictLoading ? (
              <div className="space-y-4">{[1,2,3,4,5].map(i => <div key={i} className="h-24 rounded-2xl bg-white dark:bg-slate-800 border border-red-100 animate-pulse" />)}</div>
            ) : filteredConflict.length === 0 ? (
              <div className="p-20 text-center text-slate-400 italic">No conflict intel items found...</div>
            ) : (
              <div className="space-y-4">
                {filteredConflict.map(item => {
                  const src = CONFLICT_SOURCES.find(s => s.name === item.source);
                  const colorClass = SOURCE_COLORS[src?.color ?? 'blue'];
                  return (
                    <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
                      className="block p-5 rounded-2xl bg-white dark:bg-slate-800 border border-red-100 hover:border-red-400 hover:shadow-lg transition-all group">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h2 className="font-semibold text-sm leading-snug group-hover:text-red-600 transition-colors line-clamp-2">{item.title}</h2>
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border flex-shrink-0 ${colorClass}`}>{item.sourceLabel ?? item.source}</span>
                      </div>
                      {item.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{item.description}</p>}
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="font-mono text-red-400">{item.category}</span>
                        <span>·</span>
                        <span>{relativeTime(item.timestamp)}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── TELEGRAM CHANNELS ──────────────────────────────────────────────── */}
        {tab === 'telegram' && (
          <>
            {/* Status bar */}
            <div className={`flex items-center gap-3 mb-5 p-3 rounded-xl border text-xs ${
              tgSource === 'relay'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                : 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
            }`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tgSource === 'relay' ? 'bg-green-500 animate-pulse' : 'bg-sky-400'}`} />
              {tgSource === 'relay' ? (
                <span><strong>MTProto relay online</strong> — real-time, private + public channels</span>
              ) : (
                <span>
                  <strong>RSS mode</strong> — public channels only ·{' '}
                  <span className="opacity-75">Start relay for real-time: <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded">cd telegram-relay &amp;&amp; node relay.js</code></span>
                </span>
              )}
              <button onClick={() => { setTgLoaded(false); loadTelegram(true); }}
                className="ml-auto font-semibold hover:opacity-70">↺ Refresh</button>
            </div>

            {/* Channel filter */}
            <div className="flex gap-2 mb-3 flex-wrap">
              <button onClick={() => setTgChannelFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${tgChannelFilter === 'all' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white dark:bg-slate-800 border-sky-200 hover:border-sky-400'}`}>
                All Channels
              </button>
              {tgChannels.map((ch: any) => (
                <button key={ch.name} onClick={() => setTgChannelFilter(ch.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${tgChannelFilter === ch.name ? 'bg-sky-600 text-white border-sky-600' : 'bg-white dark:bg-slate-800 border-sky-200 hover:border-sky-400'}`}>
                  @{ch.name}
                </button>
              ))}
            </div>

            {/* Category filter */}
            {tgCategories.length > 0 && (
              <div className="flex gap-2 mb-5 flex-wrap">
                <button onClick={() => setTgCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${tgCategoryFilter === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-200'}`}>
                  All Categories
                </button>
                {tgCategories.map(cat => (
                  <button key={cat} onClick={() => setTgCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${tgCategoryFilter === cat ? 'bg-slate-700 text-white border-slate-700' : `bg-white dark:bg-slate-800 ${TG_CHANNEL_COLORS[cat] ?? 'border-slate-200'}`}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {tgError && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{tgError}</div>
            )}

            {tgLoading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="h-24 rounded-2xl bg-white dark:bg-slate-800 border border-sky-100 animate-pulse" />)}</div>
            ) : tgItems.length === 0 ? (
              <div className="p-16 text-center text-slate-400 italic">
                No messages loaded. Some channels may be temporarily unavailable.
              </div>
            ) : (
              <>
                <div className="text-xs text-slate-400 mb-4">{tgTotal} posts across {tgChannels.length} channels</div>
                <div className="space-y-3">
                  {tgItems.map(msg => {
                    const catColor = TG_CHANNEL_COLORS[msg.category] ?? 'bg-slate-100 text-slate-600 border-slate-200';
                    return (
                      <a key={msg.id} href={msg.tmeLink} target="_blank" rel="noopener noreferrer"
                        className="block p-4 rounded-2xl bg-white dark:bg-slate-800 border border-sky-100 hover:border-sky-400 hover:shadow-md transition-all group">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs font-mono rounded-lg border border-sky-200">
                            @{msg.channel}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-lg border ${catColor}`}>
                            {msg.category}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">{relativeTime(msg.timestamp)}</span>
                        </div>
                        {msg.image && (
                          <img src={msg.image} alt="" className="w-full max-h-40 object-cover rounded-xl mb-2 border border-slate-200"
                            onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        )}
                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-5 group-hover:line-clamp-none transition-all">
                          {msg.text}
                        </p>
                        <div className="mt-2 text-xs text-sky-400 group-hover:text-sky-600">
                          Open in Telegram →
                        </div>
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* ── WORLD NEWS ─────────────────────────────────────────────────────── */}
        {tab === 'worldnews' && (
          <>
            <div className="flex gap-3 mb-6 flex-wrap">
              {[{ label: 'All', value: 'all' }, { label: 'Conflict', value: 'conflict' }, { label: 'Naval', value: 'naval' }, { label: 'Military', value: 'military' }].map(cat => (
                <button key={cat.value} onClick={() => setNewsFilter(cat.value)}
                  className={`px-5 py-2.5 rounded-2xl text-sm font-medium transition-all ${newsFilter === cat.value ? 'bg-pink-500 text-white shadow-md' : 'bg-white dark:bg-slate-800 border border-pink-200 hover:border-pink-400'}`}>
                  {cat.label}
                </button>
              ))}
            </div>
            {newsLoading ? (
              <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-32 rounded-3xl bg-white dark:bg-slate-800 border border-purple-100 animate-pulse" />)}</div>
            ) : news.length === 0 ? (
              <div className="p-20 text-center text-slate-400 text-lg italic">No matching headlines right now...</div>
            ) : (
              <div className="space-y-5">
                {news.map(item => {
                  const badge = sentimentBadge(item.sentiment);
                  return (
                    <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noopener noreferrer"
                      className="flex gap-5 p-5 rounded-3xl bg-white dark:bg-slate-800 border border-purple-100 hover:border-purple-400 hover:shadow-xl transition-all group">
                      {item.image && (
                        <img src={item.image} alt="" className="w-28 h-20 object-cover rounded-2xl flex-shrink-0 opacity-90 group-hover:opacity-100"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h2 className="font-semibold text-base leading-snug group-hover:text-purple-600 transition-colors line-clamp-2">{item.title}</h2>
                          <span className={`flex-shrink-0 px-3 py-1 text-xs font-medium rounded-full border ${badge.color}`}>{badge.label}</span>
                        </div>
                        {item.summary && <p className="text-sm text-slate-500 line-clamp-2 mb-2">{item.summary}</p>}
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          {item.authors?.length > 0 && <><span className="text-purple-500 font-medium">{item.authors[0]}</span><span>·</span></>}
                          <span>{relativeTime(item.publish_date)}</span>
                          {item.sentiment != null && <><span>·</span><span>Sentiment: {item.sentiment.toFixed(2)}</span></>}
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── HACKERNEWS ─────────────────────────────────────────────────────── */}
        {tab === 'hackernews' && (
          <>
            <p className="text-xs text-orange-500 font-mono uppercase tracking-widest mb-6">
              Hacker News · Top stories filtered for security &amp; geopolitics · Live
            </p>
            {hnLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-3xl bg-white dark:bg-slate-800 border border-orange-100 animate-pulse" />)}</div>
            ) : hnStories.length === 0 ? (
              <div className="p-20 text-center text-slate-400 text-lg italic">No relevant stories found...</div>
            ) : (
              <div className="space-y-3">
                {hnStories.map((story, i) => (
                  <a key={story.id} href={story.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-start gap-4 p-5 rounded-3xl bg-white dark:bg-slate-800 border border-orange-100 hover:border-orange-400 hover:shadow-xl transition-all group">
                    <div className="text-orange-300 font-mono text-sm w-6 shrink-0 pt-0.5 text-right">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-base leading-snug group-hover:text-orange-600 transition-colors">{story.title}</h2>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        <span className="text-orange-500 font-medium">{story.score} pts</span>
                        <span>·</span>
                        <span>{story.descendants ?? 0} comments</span>
                        <span>·</span>
                        <span>{story.by}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0 font-mono">
                      {story.url ? (() => { try { return new URL(story.url).hostname.replace('www.', ''); } catch { return ''; } })() : 'text'}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
