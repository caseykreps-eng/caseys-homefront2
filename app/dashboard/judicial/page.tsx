'use client';

import { useState, useRef, useEffect } from 'react';

// ── Court filter options ────────────────────────────────────────────
const COURT_FILTERS = [
  { label: 'All Courts',        value: '' },
  { label: 'Supreme Court',     value: 'scotus' },
  { label: 'Federal Circuits',  value: 'ca1,ca2,ca3,ca4,ca5,ca6,ca7,ca8,ca9,ca10,ca11,cadc,cafc' },
  { label: 'Federal District',  value: 'dcd,nyed,nysd,cacd,txnd,txsd,ilnd,waed' },
  { label: 'Georgia Courts',    value: 'ga,gactapp,gacrimapp' },
];

// ── P2C portals directory ───────────────────────────────────────────
const P2C_PORTALS = [
  { name: 'Hall County Sheriff',   url: 'https://hallcounty.policetocitizen.com/EventSearch#search',   state: 'GA' },
  { name: 'Gainesville PD (GA)',   url: 'https://gainesville.policetocitizen.com/EventSearch#search',  state: 'GA' },
  { name: 'Forsyth County (GA)',   url: 'https://forsythcounty.policetocitizen.com/EventSearch#search',state: 'GA' },
  { name: 'Gwinnett County (GA)',  url: 'https://gwinnettcounty.policetocitizen.com/EventSearch#search',state: 'GA' },
  { name: 'Cherokee County (GA)',  url: 'https://cherokeecounty.policetocitizen.com/EventSearch#search',state: 'GA' },
];

// ── Lookup portals ──────────────────────────────────────────────────
const LOOKUP_PORTALS = [
  {
    emoji: '🏛️', title: 'Federal Inmate Locator',
    desc: 'Search all federal inmates — current & released — via the Bureau of Prisons.',
    url: 'https://www.bop.gov/inmateloc/',
    badge: 'BOP',
  },
  {
    emoji: '🗺️', title: 'National Sex Offender Registry',
    desc: 'NSOPW — search by name or address across all 50 states + territories.',
    url: 'https://www.nsopw.gov/',
    badge: 'NSOPW',
  },
  {
    emoji: '⚖️', title: 'PACER — Federal Court Records',
    desc: 'Federal case dockets, complaints, motions, and orders. Requires free PACER account.',
    url: 'https://pacer.uscourts.gov/',
    badge: 'PACER',
  },
  {
    emoji: '🔍', title: 'CourtListener (Full Site)',
    desc: 'Browse millions of court opinions, oral arguments, and PACER data for free.',
    url: 'https://www.courtlistener.com/',
    badge: 'Free',
  },
  {
    emoji: '📜', title: 'Georgia Offender Query',
    desc: 'Search Georgia Dept. of Corrections inmate and offender records.',
    url: 'https://www.dcor.state.ga.us/GDC/OffenderQuery/jsp/OffQryForm.jsp',
    badge: 'GA',
  },
  {
    emoji: '🚔', title: 'GA Sex Offender Registry',
    desc: 'Georgia GBI public sex offender search — name, address, county.',
    url: 'https://gbi.georgia.gov/information-center/georgia-sex-offender-registry',
    badge: 'GA GBI',
  },
];

function relDate(d: string) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1)   return 'Today';
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ── P2C iframe component ────────────────────────────────────────────
function P2CViewer({ portal }: { portal: typeof P2C_PORTALS[0] }) {
  const [blocked, setBlocked] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setBlocked(false);
    setLoaded(false);
    // If iframe hasn't signalled load within 4 s, assume it's blocked
    timerRef.current = window.setTimeout(() => setBlocked(true), 4000);
    return () => clearTimeout(timerRef.current);
  }, [portal.url]);

  const handleLoad = () => {
    clearTimeout(timerRef.current);
    setLoaded(true);
  };

  return (
    <div className="relative w-full h-full min-h-[520px]">
      {!loaded && !blocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-2xl">
          <div className="text-slate-400 text-sm animate-pulse">Loading {portal.name}…</div>
        </div>
      )}

      {blocked ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-slate-900 rounded-2xl text-center px-8">
          <div className="text-4xl">🚔</div>
          <div className="font-bold text-slate-700 dark:text-slate-200">{portal.name}</div>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs">
            This portal doesn't allow embedding — open it directly to search incidents, calls for service, and crime reports.
          </p>
          <a
            href={portal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white rounded-2xl font-bold text-sm transition"
          >
            Open {portal.name} ↗
          </a>
        </div>
      ) : (
        <iframe
          src={portal.url}
          onLoad={handleLoad}
          className="w-full h-full min-h-[520px] rounded-2xl border-0"
          title={portal.name}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────
export default function JudicialIntelPage() {
  const [activeTab, setActiveTab] = useState<'courts' | 'p2c' | 'lookup'>('courts');

  // Court search state
  const [query,      setQuery]      = useState('');
  const [courtFilter, setCourtFilter] = useState('');
  const [results,    setResults]    = useState<any[]>([]);
  const [count,      setCount]      = useState(0);
  const [searching,  setSearching]  = useState(false);
  const [searchErr,  setSearchErr]  = useState<string | null>(null);

  // P2C state
  const [selectedPortal, setSelectedPortal] = useState(P2C_PORTALS[0]);
  const [customP2C,      setCustomP2C]      = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true); setSearchErr(null); setResults([]);
    try {
      const params = new URLSearchParams({ q: query, type: 'o' });
      if (courtFilter) params.set('court', courtFilter);
      const res = await fetch(`/api/court-search?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResults(data.results);
      setCount(data.count);
    } catch (err: any) {
      setSearchErr(err.message);
    } finally {
      setSearching(false);
    }
  };

  const tabs = [
    { id: 'courts', label: '⚖️ Court Records',      desc: 'CourtListener · 10M+ opinions' },
    { id: 'p2c',    label: '🚔 Police Incidents',   desc: 'Police to Citizen portals' },
    { id: 'lookup', label: '🔍 Inmate & Offender',  desc: 'BOP · NSOPW · State registries' },
  ] as const;

  return (
    <div className="p-8 bg-[#fff0f8] dark:bg-zinc-950 min-h-full">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-2">
          ⚖️ Judicial Intel
        </h1>
        <p className="text-xs text-pink-600 dark:text-pink-400 font-mono uppercase tracking-widest mb-8">
          Court Records · Police Incidents · Inmate & Offender Lookup
        </p>

        {/* Tab bar */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-all flex flex-col items-start ${
                activeTab === t.id
                  ? 'bg-pink-500 text-white shadow-md'
                  : 'bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 hover:border-pink-400'
              }`}
            >
              <span>{t.label}</span>
              <span className={`text-[10px] font-normal mt-0.5 ${activeTab === t.id ? 'text-pink-100' : 'text-slate-400'}`}>{t.desc}</span>
            </button>
          ))}
        </div>

        {/* ── Court Records ──────────────────────────────── */}
        {activeTab === 'courts' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-8">
              <h2 className="font-bold text-pink-600 mb-5">Search Court Opinions & Cases</h2>

              <form onSubmit={handleSearch} className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Case name, party, keyword, statute…"
                    className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:border-pink-400"
                  />
                  <button
                    type="submit"
                    disabled={searching}
                    className="bg-pink-500 hover:bg-pink-600 disabled:opacity-40 text-white px-8 py-3 rounded-2xl font-bold text-sm transition"
                  >
                    {searching ? 'Searching…' : 'Search'}
                  </button>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {COURT_FILTERS.map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setCourtFilter(f.value)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        courtFilter === f.value
                          ? 'bg-purple-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </form>
            </div>

            {searchErr && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">{searchErr}</div>
            )}

            {results.length > 0 && (
              <>
                <p className="text-xs text-slate-500 font-mono">
                  {count.toLocaleString()} matching opinions · showing top {results.length}
                </p>
                <div className="space-y-3">
                  {results.map(r => (
                    <a
                      key={r.id}
                      href={r.url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white dark:bg-slate-800 border border-purple-100 dark:border-slate-700 hover:border-purple-400 rounded-2xl p-5 transition-all hover:shadow-lg group"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="font-semibold text-sm leading-snug group-hover:text-purple-600 transition-colors">
                          {r.caseName}
                        </h3>
                        <span className="text-xs text-slate-400 shrink-0 font-mono">{relDate(r.dateFiled)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="text-purple-600 dark:text-purple-400 font-medium">{r.court}</span>
                        {r.docketNumber && <span>Docket: {r.docketNumber}</span>}
                        {r.judge && <span>Judge: {r.judge}</span>}
                        {r.citation && <span className="font-mono">{r.citation}</span>}
                        {r.citeCount > 0 && (
                          <span className="ml-auto bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-lg">
                            {r.citeCount} citations
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </>
            )}

            {results.length === 0 && !searching && query && !searchErr && (
              <div className="text-center py-16 text-slate-400 italic">No opinions found for "{query}"</div>
            )}

            {results.length === 0 && !searching && !query && (
              <div className="bg-white dark:bg-slate-800 border border-dashed border-pink-200 dark:border-slate-700 rounded-3xl p-12 text-center text-slate-400 text-sm">
                Search by party name, statute, keyword, or case number — powered by CourtListener's 10M+ opinion database
              </div>
            )}
          </div>
        )}

        {/* ── Police to Citizen ─────────────────────────── */}
        {activeTab === 'p2c' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl p-6">
              <h2 className="font-bold text-pink-600 mb-4">Select a Police to Citizen Portal</h2>

              {/* Portal selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                {P2C_PORTALS.map(p => (
                  <button
                    key={p.url}
                    onClick={() => setSelectedPortal(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedPortal.url === p.url
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-700 hover:bg-pink-50 dark:hover:bg-slate-600'
                    }`}
                  >
                    {p.name}
                    <span className="ml-1.5 text-[10px] opacity-70">{p.state}</span>
                  </button>
                ))}
              </div>

              {/* Custom URL */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customP2C}
                  onChange={e => setCustomP2C(e.target.value)}
                  placeholder="Or paste any P2C portal URL…"
                  className="flex-1 bg-pink-50 dark:bg-slate-900 border border-pink-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-pink-400"
                />
                <button
                  onClick={() => {
                    if (customP2C.trim()) {
                      setSelectedPortal({ name: 'Custom Portal', url: customP2C.trim(), state: '' });
                      setCustomP2C('');
                    }
                  }}
                  className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl text-sm font-medium transition"
                >
                  Load
                </button>
              </div>
            </div>

            {/* P2C viewer */}
            <div className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 rounded-3xl overflow-hidden" style={{ height: 580 }}>
              <P2CViewer portal={selectedPortal} />
            </div>

            <p className="text-xs text-slate-400 text-center">
              P2C portals show calls for service, incidents, and crime reports published by participating agencies.
              If embedding is blocked, click the direct link to search in a new tab.
            </p>
          </div>
        )}

        {/* ── Inmate & Offender Lookup ───────────────────── */}
        {activeTab === 'lookup' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {LOOKUP_PORTALS.map(p => (
              <a
                key={p.url}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white dark:bg-slate-800 border border-pink-200 dark:border-slate-700 hover:border-purple-400 hover:shadow-xl rounded-3xl p-6 transition-all group flex flex-col gap-3"
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{p.emoji}</span>
                  <span className="text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-2.5 py-1 rounded-full">
                    {p.badge}
                  </span>
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                    {p.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {p.desc}
                  </div>
                </div>
                <div className="text-xs text-purple-500 font-medium mt-auto">Open ↗</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
