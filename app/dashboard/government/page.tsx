'use client';

import { useState, useEffect, useRef } from 'react';

/* ── types ── */
interface WikiPerson {
  id: string;
  label: string;
  description: string;
  wikidataUrl: string;
  wikipediaUrl: string | null;
  positionQid: string | null;
  countryQid: string | null;
  partyQid: string | null;
  dob: string | null;
  imageUrl: string | null;
}

interface Leader {
  personId: string;
  name: string;
  country: string;
  countryId: string;
  position: string;
  imageUrl: string | null;
  wikidataUrl: string;
  wikipediaUrl: string;
}

interface LegMember {
  id: string;
  name: string;
  party: string;
  area: string;
  role: string;
  gender: string;
  birthDate: string;
  startDate: string;
  imageUrl: string | null;
  links: { url: string; note: string }[];
}

interface CountryEntry {
  name: string;
  slug: string;
  legislatures: { name: string; slug: string; lastSeenDate: string | null; seats: number | null }[];
}

/* ──────────────────────────────────────────────────────── */

export default function GovernmentIntelPage() {
  const [activeTab, setActiveTab] = useState<'search' | 'legislature' | 'leaders' | 'fedregister'>('leaders');

  /* ── tab: Federal Register ── */
  const [frQuery, setFrQuery] = useState('');
  const [frType, setFrType]   = useState('');
  const [frResults, setFrResults] = useState<any[]>([]);
  const [frLoading, setFrLoading] = useState(false);
  const [frError, setFrError]     = useState('');
  const [frCount, setFrCount]     = useState(0);
  const [frExpanded, setFrExpanded] = useState<string | null>(null);

  const searchFedRegister = async () => {
    if (!frQuery.trim()) return;
    setFrLoading(true); setFrError(''); setFrResults([]);
    try {
      const params = new URLSearchParams({ q: frQuery });
      if (frType) params.set('type', frType);
      const res = await fetch(`/api/federal-register?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setFrResults(json.results ?? []);
      setFrCount(json.count ?? 0);
    } catch (e: any) {
      setFrError(e.message);
    } finally {
      setFrLoading(false);
    }
  };

  /* ── tab: Politician Search ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WikiPerson[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchDebounce = useRef<number | undefined>(undefined);

  const runSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/government/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setSearchResults(json.results ?? []);
    } catch {
      setSearchError('Search failed. Try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    window.clearTimeout(searchDebounce.current);
    searchDebounce.current = window.setTimeout(() => runSearch(val), 500);
  };

  /* ── tab: World Leaders ── */
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [leadersError, setLeadersError] = useState('');
  const [leaderFilter, setLeaderFilter] = useState('');
  const [leadersLoaded, setLeadersLoaded] = useState(false);

  const loadLeaders = async () => {
    if (leadersLoaded) return;
    setLeadersLoading(true);
    setLeadersError('');
    try {
      const res = await fetch('/api/government/leaders');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setLeaders(json.leaders ?? []);
      setLeadersLoaded(true);
    } catch (e: any) {
      setLeadersError(e.message ?? 'Failed to load leaders');
    } finally {
      setLeadersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leaders') loadLeaders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const filteredLeaders = leaders.filter(l =>
    !leaderFilter ||
    l.name.toLowerCase().includes(leaderFilter.toLowerCase()) ||
    l.country.toLowerCase().includes(leaderFilter.toLowerCase()) ||
    l.position.toLowerCase().includes(leaderFilter.toLowerCase())
  );

  /* ── tab: Legislature Browser ── */
  const [countries, setCountries] = useState<CountryEntry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesLoaded, setCountriesLoaded] = useState(false);
  const [legCountryFilter, setLegCountryFilter] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryEntry | null>(null);
  const [selectedLeg, setSelectedLeg] = useState<{ name: string; slug: string } | null>(null);
  const [members, setMembers] = useState<LegMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [memberPartyFilter, setMemberPartyFilter] = useState('');
  const [legDataNote, setLegDataNote] = useState('');

  const loadCountries = async () => {
    if (countriesLoaded) return;
    setCountriesLoading(true);
    try {
      const res = await fetch('/api/government/legislature?action=list');
      const json = await res.json();
      setCountries(json.countries ?? []);
      setCountriesLoaded(true);
    } catch {
      // silent — show empty state
    } finally {
      setCountriesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'legislature') loadCountries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadMembers = async (country: CountryEntry, leg: { name: string; slug: string }) => {
    setSelectedCountry(country);
    setSelectedLeg(leg);
    setMembers([]);
    setMembersError('');
    setMemberFilter('');
    setMemberPartyFilter('');
    setMembersLoading(true);
    try {
      const res = await fetch(
        `/api/government/legislature?action=members&country=${encodeURIComponent(country.slug)}&legislature=${encodeURIComponent(leg.slug)}`
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setMembers(json.members ?? []);
      setLegDataNote(json.dataNote ?? '');
    } catch (e: any) {
      setMembersError(e.message ?? 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  };

  const filteredCountries = countries.filter(c =>
    !legCountryFilter || c.name.toLowerCase().includes(legCountryFilter.toLowerCase())
  );

  const allParties = [...new Set(members.map(m => m.party).filter(Boolean))].sort();

  const filteredMembers = members.filter(m => {
    const matchName  = !memberFilter || m.name.toLowerCase().includes(memberFilter.toLowerCase()) || m.area.toLowerCase().includes(memberFilter.toLowerCase());
    const matchParty = !memberPartyFilter || m.party === memberPartyFilter;
    return matchName && matchParty;
  });

  /* ── helpers ── */
  const TABS = [
    { id: 'leaders',     label: '🌍 World Leaders'      },
    { id: 'search',      label: '🔍 Politician Search'   },
    { id: 'legislature', label: '🏛️ Legislature Browser'  },
    { id: 'fedregister', label: '📜 Federal Register'    },
  ] as const;

  const genderIcon = (g: string) => g === 'male' ? '♂' : g === 'female' ? '♀' : '⚬';

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
          🏛️ Government Intelligence
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Wikidata live data · EveryPolitician archive (historical, ~2019)
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === tab.id
                ? 'bg-slate-800 text-white border-indigo-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: World Leaders ── */}
      {activeTab === 'leaders' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              value={leaderFilter}
              onChange={e => setLeaderFilter(e.target.value)}
              placeholder="Filter by name, country, or role…"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
            <span className="text-slate-500 text-sm">{filteredLeaders.length} entries</span>
          </div>

          {leadersLoading && (
            <div className="flex items-center gap-3 text-slate-400 py-10">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Querying Wikidata SPARQL…
            </div>
          )}
          {leadersError && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
              ⚠️ {leadersError}
              <button onClick={() => { setLeadersLoaded(false); loadLeaders(); }} className="ml-3 underline">Retry</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredLeaders.map(l => (
              <div key={`${l.personId}-${l.countryId}`}
                className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex gap-3 hover:border-indigo-500 transition-colors group">
                {/* Photo */}
                <div className="flex-shrink-0">
                  {l.imageUrl ? (
                    <img
                      src={l.imageUrl}
                      alt={l.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-600 group-hover:border-indigo-400 transition-colors"
                      onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                      👤
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">{l.name}</div>
                  <div className="text-xs text-indigo-300 truncate">{l.country}</div>
                  <div className="text-xs text-slate-400 truncate mt-0.5">{l.position}</div>
                  <div className="flex gap-2 mt-2">
                    <a href={l.wikidataUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-200 underline">
                      Wikidata
                    </a>
                    <a href={l.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-200 underline">
                      Wikipedia
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!leadersLoading && !leadersError && filteredLeaders.length === 0 && leadersLoaded && (
            <div className="text-slate-500 text-center py-10">No results match your filter.</div>
          )}
        </div>
      )}

      {/* ── TAB: Politician Search ── */}
      {activeTab === 'search' && (
        <div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-4">
            <label className="block text-sm text-slate-400 mb-2">Search politicians, officials, world leaders</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runSearch(searchQuery)}
                placeholder="e.g. Angela Merkel, Joe Biden, Emmanuel Macron…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                autoFocus
              />
              <button
                onClick={() => runSearch(searchQuery)}
                disabled={searchLoading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {searchLoading ? '…' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Searches Wikidata — powered by live open data. Results include all public figures; filter by description.
            </p>
          </div>

          {searchError && (
            <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">
              ⚠️ {searchError}
            </div>
          )}

          {searchLoading && (
            <div className="flex items-center gap-2 text-slate-400 py-6">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              Searching Wikidata…
            </div>
          )}

          <div className="space-y-3">
            {searchResults.map(p => (
              <div key={p.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 flex gap-4 hover:border-indigo-500 transition-colors group">
                {/* Photo */}
                <div className="flex-shrink-0">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.label}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-slate-600 group-hover:border-indigo-400 transition-colors"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-700 flex items-center justify-center text-2xl border-2 border-slate-600">
                      👤
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-base">{p.label}</h3>
                      {p.description && (
                        <p className="text-sm text-indigo-300 mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono shrink-0">{p.id}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-400">
                    {p.dob && <span>🎂 {p.dob.slice(0, 10)}</span>}
                    {p.countryQid && <span>🌐 {p.countryQid}</span>}
                    {p.partyQid && <span>🎗️ {p.partyQid}</span>}
                  </div>

                  <div className="flex gap-3 mt-2.5">
                    <a href={p.wikidataUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-200 underline">
                      Wikidata ↗
                    </a>
                    {p.wikipediaUrl && (
                      <a href={p.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-200 underline">
                        Wikipedia ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!searchLoading && searchQuery && searchResults.length === 0 && !searchError && (
            <div className="text-slate-500 text-center py-10">
              No results for "{searchQuery}"
            </div>
          )}

          {!searchQuery && (
            <div className="text-slate-600 text-center py-10 text-sm">
              Type a name above to search Wikidata for politicians and public officials
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Legislature Browser ── */}
      {activeTab === 'legislature' && (
        <div className="flex gap-4 h-[70vh]">
          {/* Left: country + legislature list */}
          <div className="w-72 flex-shrink-0 flex flex-col">
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl px-3 py-2 text-xs text-amber-300 mb-3">
              ⚠️ EveryPolitician data is frozen ~May 2019. Use for historical reference only.
            </div>
            <input
              type="text"
              value={legCountryFilter}
              onChange={e => setLegCountryFilter(e.target.value)}
              placeholder="Filter countries…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400 mb-3"
            />
            {countriesLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Loading…
              </div>
            )}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {filteredCountries.map(c => (
                <div key={c.slug}>
                  <div className="text-xs font-bold text-slate-400 px-2 py-1 sticky top-0 bg-slate-950/80 backdrop-blur-sm">
                    {c.name}
                  </div>
                  {c.legislatures.map(l => (
                    <button
                      key={l.slug}
                      onClick={() => loadMembers(c, l)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        selectedCountry?.slug === c.slug && selectedLeg?.slug === l.slug
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {l.name}
                      {l.seats && <span className="text-xs text-slate-400 ml-1">({l.seats})</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right: members table */}
          <div className="flex-1 flex flex-col min-w-0">
            {!selectedCountry && !membersLoading && (
              <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
                ← Select a legislature to browse members
              </div>
            )}

            {membersLoading && (
              <div className="flex-1 flex items-center justify-center text-slate-400 gap-2">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                Loading members…
              </div>
            )}

            {membersError && (
              <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
                ⚠️ {membersError}
              </div>
            )}

            {selectedCountry && !membersLoading && !membersError && members.length > 0 && (
              <>
                {/* Header */}
                <div className="mb-3">
                  <h2 className="font-bold text-white text-lg">
                    {selectedCountry.name} — {selectedLeg?.name}
                  </h2>
                  {legDataNote && (
                    <p className="text-xs text-amber-400 mt-0.5">{legDataNote}</p>
                  )}
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={memberFilter}
                    onChange={e => setMemberFilter(e.target.value)}
                    placeholder="Filter by name or district…"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                  />
                  <select
                    value={memberPartyFilter}
                    onChange={e => setMemberPartyFilter(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-400 max-w-[180px]"
                  >
                    <option value="">All parties</option>
                    {allParties.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <span className="self-center text-slate-500 text-sm shrink-0">
                    {filteredMembers.length} / {members.length}
                  </span>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900 border-b border-slate-700 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">Name</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">Party</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">Area</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">Role</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">Since</th>
                        <th className="text-center px-3 py-2 text-slate-400 font-semibold">G</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((m, i) => (
                        <tr
                          key={`${m.id}-${i}`}
                          className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-3 py-2 text-white font-medium">{m.name}</td>
                          <td className="px-3 py-2 text-indigo-300 text-xs">{m.party}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs">{m.area}</td>
                          <td className="px-3 py-2 text-slate-400 text-xs">{m.role}</td>
                          <td className="px-3 py-2 text-slate-500 text-xs">{m.startDate ? m.startDate.slice(0,7) : '—'}</td>
                          <td className="px-3 py-2 text-center text-slate-400 text-xs">{genderIcon(m.gender)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1.5 flex-wrap">
                              {m.links.slice(0, 3).map((l, j) => (
                                <a
                                  key={j}
                                  href={l.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={l.note}
                                  className="text-xs text-cyan-500 hover:text-cyan-300 underline"
                                >
                                  {l.note || 'Link'}
                                </a>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {selectedCountry && !membersLoading && !membersError && members.length === 0 && (
              <div className="text-slate-500 text-center py-10 text-sm">
                No active members found for this legislature.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Federal Register ── */}
      {activeTab === 'fedregister' && (
        <div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5">
            <p className="text-xs text-slate-400 mb-3">
              Search <strong className="text-slate-200">FederalRegister.gov</strong> — US executive orders, proposed rules, notices, and presidential documents. Powered by api.data.gov.
            </p>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={frQuery}
                onChange={e => setFrQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchFedRegister()}
                placeholder="e.g. cybersecurity, sanctions, immigration, AI…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <select value={frType} onChange={e => setFrType(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-amber-400">
                <option value="">All types</option>
                <option value="Rule">Rule</option>
                <option value="Proposed Rule">Proposed Rule</option>
                <option value="Notice">Notice</option>
                <option value="Presidential Document">Presidential Document</option>
              </select>
              <button onClick={searchFedRegister} disabled={frLoading}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {frLoading ? '…' : 'Search'}
              </button>
            </div>
          </div>

          {frError && <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">⚠️ {frError}</div>}
          {frCount > 0 && <p className="text-slate-400 text-sm mb-4">{frCount.toLocaleString()} documents found · showing top {frResults.length}</p>}

          <div className="space-y-3">
            {frResults.map(r => (
              <div key={r.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden hover:border-amber-600 transition-colors">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setFrExpanded(frExpanded === r.id ? null : r.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-sm leading-snug">{r.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
                        <span className="bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-800">{r.type}</span>
                        {r.publicationDate && <span className="text-slate-400">📅 {r.publicationDate}</span>}
                        {r.effectiveDate   && <span className="text-slate-400">⚡ Effective {r.effectiveDate}</span>}
                        {r.citation        && <span className="text-slate-500 font-mono">{r.citation}</span>}
                      </div>
                      {r.agencies.length > 0 && (
                        <div className="text-xs text-indigo-300 mt-1 truncate">{r.agencies.join(' · ')}</div>
                      )}
                    </div>
                    <span className="text-slate-500 text-lg shrink-0">{frExpanded === r.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {frExpanded === r.id && (
                  <div className="border-t border-slate-700 px-4 pb-4 pt-3 space-y-2 text-sm">
                    {r.action && (
                      <div><span className="text-slate-400 text-xs">Action: </span><span className="text-slate-300">{r.action}</span></div>
                    )}
                    {r.abstract && (
                      <p className="text-slate-300 text-xs leading-relaxed">{r.abstract}</p>
                    )}
                    <div className="flex gap-3 flex-wrap pt-1">
                      {r.htmlUrl && (
                        <a href={r.htmlUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                          Read Document ↗
                        </a>
                      )}
                      {r.pdfUrl && (
                        <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                          PDF ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!frLoading && frQuery && frResults.length === 0 && !frError && (
            <div className="text-slate-500 text-center py-10">No results for "{frQuery}"</div>
          )}
          {!frQuery && (
            <div className="text-slate-600 text-center py-10 text-sm">
              Search US federal rules, executive orders, and notices above
            </div>
          )}
        </div>
      )}
    </div>
  );
}
