'use client';

import { useState } from 'react';

/* ── types ── */
interface SanctionResult {
  id: string; caption: string; schema: string; datasets: string[];
  name: string | null; alias: string[]; birthDate: string | null;
  nationality: string | null; position: string | null; address: string | null;
  program: string[]; reason: string | null; listingDate: string | null;
  sourceUrl: string | null; wikidataUrl: string | null; osUrl: string;
  score: number | null;
}

interface LittleSisEntity {
  id: string; name: string; blurb: string; type: string;
  aliases: string[]; url: string; imageUrl: string | null;
}

interface LittleSisRelationship {
  id: string; category: string; description: string; isReverse: boolean;
  entity1: { id: string; name: string; blurb: string; url: string | null };
  entity2: { id: string; name: string; blurb: string; url: string | null };
  url: string | null;
}

type Tab = 'sanctions' | 'network' | 'opencorp';

/* ─────────────────────────────────────────── */
export default function BusinessIntelPage() {
  const [tab, setTab] = useState<Tab>('sanctions');

  /* ── OpenSanctions ── */
  const [osQuery, setOsQuery] = useState('');
  const [osSchema, setOsSchema] = useState('');
  const [osResults, setOsResults] = useState<SanctionResult[]>([]);
  const [osLoading, setOsLoading] = useState(false);
  const [osError, setOsError] = useState('');
  const [osTotal, setOsTotal] = useState(0);
  const [osSelected, setOsSelected] = useState<SanctionResult | null>(null);

  const searchSanctions = async () => {
    if (!osQuery.trim()) return;
    setOsLoading(true); setOsError(''); setOsResults([]); setOsSelected(null);
    try {
      const params = new URLSearchParams({ q: osQuery });
      if (osSchema) params.set('schema', osSchema);
      const res = await fetch(`/api/opensanctions?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setOsResults(json.results ?? []);
      setOsTotal(json.total ?? 0);
    } catch (e: any) {
      setOsError(e.message);
    } finally {
      setOsLoading(false);
    }
  };

  /* ── LittleSis ── */
  const [lsQuery, setLsQuery] = useState('');
  const [lsEntities, setLsEntities] = useState<LittleSisEntity[]>([]);
  const [lsSelected, setLsSelected] = useState<LittleSisEntity | null>(null);
  const [lsRels, setLsRels] = useState<LittleSisRelationship[]>([]);
  const [lsLoading, setLsLoading] = useState(false);
  const [lsRelsLoading, setLsRelsLoading] = useState(false);
  const [lsError, setLsError] = useState('');

  const searchLittleSis = async () => {
    if (!lsQuery.trim()) return;
    setLsLoading(true); setLsError(''); setLsEntities([]); setLsSelected(null); setLsRels([]);
    try {
      const res = await fetch(`/api/littlesis?action=search&q=${encodeURIComponent(lsQuery)}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setLsEntities(json.results ?? []);
    } catch (e: any) {
      setLsError(e.message);
    } finally {
      setLsLoading(false);
    }
  };

  const loadRelationships = async (entity: LittleSisEntity) => {
    setLsSelected(entity); setLsRels([]); setLsRelsLoading(true);
    try {
      const res = await fetch(`/api/littlesis?action=relationships&id=${entity.id}`);
      const json = await res.json();
      setLsRels(json.relationships ?? []);
    } catch { /* silent */ } finally {
      setLsRelsLoading(false);
    }
  };

  /* ── OpenCorporates ── */
  const [ocQuery, setOcQuery] = useState('');
  const [ocJurisdiction, setOcJurisdiction] = useState('');

  const searchOpenCorporates = () => {
    if (!ocQuery.trim()) return;
    const params = new URLSearchParams({ q: ocQuery });
    if (ocJurisdiction) params.set('jurisdiction_code', ocJurisdiction);
    window.open(`https://opencorporates.com/companies?${params}`, '_blank');
  };

  /* ── helpers ── */
  const SCHEMA_LABELS: Record<string, string> = {
    '': 'All types', Person: 'Person', Company: 'Company / Org',
    Vessel: 'Vessel', Aircraft: 'Aircraft', LegalEntity: 'Legal Entity',
  };

  const schemaColor = (s: string) => {
    if (s === 'Person') return 'text-indigo-300';
    if (s === 'Company' || s === 'LegalEntity') return 'text-emerald-300';
    if (s === 'Vessel') return 'text-cyan-300';
    if (s === 'Aircraft') return 'text-orange-300';
    return 'text-slate-300';
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'sanctions', label: '🚫 Sanctions & PEPs' },
    { id: 'network',   label: '🕸️ Power Network' },
    { id: 'opencorp',  label: '🏢 Corporate Records' },
  ];

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100">
      <div className="mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
          🏢 Business Intelligence
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          OpenSanctions · LittleSis power network · OpenCorporates
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
              tab === t.id
                ? 'bg-slate-800 text-white border-emerald-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Sanctions & PEPs ── */}
      {tab === 'sanctions' && (
        <div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5">
            <p className="text-xs text-slate-400 mb-3">
              <strong className="text-slate-200">OpenSanctions</strong> aggregates 100+ sanctions lists, PEP databases, and watchlists — OFAC, UN, EU, Interpol, and more.
            </p>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={osQuery}
                onChange={e => setOsQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSanctions()}
                placeholder="Name, company, vessel, alias…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                autoFocus
              />
              <select
                value={osSchema}
                onChange={e => setOsSchema(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-400"
              >
                {Object.entries(SCHEMA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button
                onClick={searchSanctions}
                disabled={osLoading}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {osLoading ? '…' : 'Search'}
              </button>
            </div>
          </div>

          {osError && <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">⚠️ {osError}</div>}
          {osTotal > 0 && <p className="text-slate-400 text-sm mb-4">{osTotal.toLocaleString()} total matches · showing top {osResults.length}</p>}

          {/* Detail panel */}
          {osSelected && (
            <div className="bg-slate-800 border border-emerald-700 rounded-2xl p-5 mb-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-white text-lg">{osSelected.caption}</h3>
                  <span className={`text-xs font-medium ${schemaColor(osSelected.schema)}`}>{osSelected.schema}</span>
                </div>
                <button onClick={() => setOsSelected(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {osSelected.birthDate   && <div><span className="text-slate-400">Born: </span>{osSelected.birthDate.slice(0,10)}</div>}
                {osSelected.nationality && <div><span className="text-slate-400">Nationality: </span>{osSelected.nationality}</div>}
                {osSelected.position    && <div><span className="text-slate-400">Position: </span>{osSelected.position}</div>}
                {osSelected.address     && <div className="col-span-2"><span className="text-slate-400">Address: </span>{osSelected.address}</div>}
                {osSelected.listingDate && <div><span className="text-slate-400">Listed: </span>{osSelected.listingDate.slice(0,10)}</div>}
                {osSelected.reason      && <div className="col-span-2"><span className="text-slate-400">Reason: </span>{osSelected.reason}</div>}
              </div>
              {osSelected.program.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-400 mb-1.5">Sanction Programs</div>
                  <div className="flex flex-wrap gap-1.5">
                    {osSelected.program.map(p => (
                      <span key={p} className="bg-red-900/40 text-red-300 text-xs px-2.5 py-1 rounded-lg border border-red-800">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {osSelected.alias.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-slate-400 mb-1.5">Aliases</div>
                  <div className="text-sm text-slate-300">{osSelected.alias.join(' · ')}</div>
                </div>
              )}
              <div className="flex gap-3 mt-4 flex-wrap">
                <a href={osSelected.osUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors">
                  OpenSanctions Profile ↗
                </a>
                {osSelected.wikidataUrl && (
                  <a href={osSelected.wikidataUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-violet-700 hover:bg-violet-600 text-white px-4 py-2 rounded-xl transition-colors">
                    Wikidata ↗
                  </a>
                )}
                {osSelected.sourceUrl && (
                  <a href={osSelected.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-colors">
                    Source ↗
                  </a>
                )}
              </div>
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">Datasets</div>
                <div className="flex flex-wrap gap-1">
                  {osSelected.datasets.map(d => (
                    <span key={d} className="bg-slate-700 text-slate-400 text-xs px-2 py-0.5 rounded">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {osResults.map(r => (
              <div
                key={r.id}
                onClick={() => setOsSelected(r)}
                className={`bg-slate-800/60 border rounded-xl p-4 cursor-pointer transition-all hover:border-emerald-500 ${
                  osSelected?.id === r.id ? 'border-emerald-500 bg-slate-800' : 'border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white">{r.caption}</h3>
                    {r.alias.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">AKA: {r.alias.slice(0,3).join(', ')}</p>
                    )}
                    <div className="flex gap-2 mt-1.5 flex-wrap text-xs">
                      <span className={`font-medium ${schemaColor(r.schema)}`}>{r.schema}</span>
                      {r.nationality && <span className="text-slate-400">🌐 {r.nationality}</span>}
                      {r.position && <span className="text-slate-400 truncate max-w-xs">{r.position}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {r.program.length > 0 && (
                      <span className="bg-red-900/50 text-red-300 text-xs px-2 py-0.5 rounded-lg border border-red-800">
                        🚫 Sanctioned
                      </span>
                    )}
                    {r.score != null && (
                      <span className="text-xs text-slate-500">match {(r.score * 100).toFixed(0)}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!osLoading && osQuery && osResults.length === 0 && !osError && (
            <div className="text-slate-500 text-center py-10">No matches found. Try a different spelling or remove the type filter.</div>
          )}
          {!osQuery && (
            <div className="text-slate-600 text-center py-10 text-sm">
              Search above to check against OFAC, UN, EU, Interpol, and 100+ other watchlists
            </div>
          )}
        </div>
      )}

      {/* ── TAB: LittleSis Power Network ── */}
      {tab === 'network' && (
        <div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5">
            <p className="text-xs text-slate-400 mb-3">
              <strong className="text-slate-200">LittleSis</strong> maps relationships between powerful people — politicians, executives, lobbyists, board members, and the organizations they control.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lsQuery}
                onChange={e => setLsQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchLittleSis()}
                placeholder="Person or organization name…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                autoFocus
              />
              <button
                onClick={searchLittleSis}
                disabled={lsLoading}
                className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {lsLoading ? '…' : 'Search'}
              </button>
            </div>
          </div>

          {lsError && <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">⚠️ {lsError}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Entity list */}
            <div className="space-y-2">
              {lsEntities.map(e => (
                <div
                  key={e.id}
                  onClick={() => loadRelationships(e)}
                  className={`bg-slate-800/60 border rounded-xl p-4 cursor-pointer transition-all hover:border-cyan-500 flex gap-3 ${
                    lsSelected?.id === e.id ? 'border-cyan-500 bg-slate-800' : 'border-slate-700'
                  }`}
                >
                  {e.imageUrl && (
                    <img src={e.imageUrl} alt={e.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-600 shrink-0"
                      onError={ev => { (ev.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-sm">{e.name}</div>
                    {e.blurb && <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">{e.blurb}</div>}
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-xs text-cyan-400">{e.type}</span>
                      <a href={e.url} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
                        className="text-xs text-slate-500 hover:text-slate-300 underline">LittleSis ↗</a>
                    </div>
                  </div>
                </div>
              ))}
              {!lsLoading && lsQuery && lsEntities.length === 0 && !lsError && (
                <div className="text-slate-500 text-sm py-6 text-center">No results for "{lsQuery}"</div>
              )}
              {!lsQuery && (
                <div className="text-slate-600 text-sm py-6 text-center">Search to explore the power elite network</div>
              )}
            </div>

            {/* Relationships panel */}
            <div>
              {lsSelected && (
                <div>
                  <h3 className="font-bold text-white mb-3">
                    Relationships: <span className="text-cyan-300">{lsSelected.name}</span>
                  </h3>
                  {lsRelsLoading && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                      <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </div>
                  )}
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {lsRels.map(r => (
                      <div key={r.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-medium">{r.entity1.name}</span>
                          <span className="text-cyan-400 text-xs px-2 py-0.5 bg-cyan-900/30 rounded-lg">{r.category}</span>
                          <span className="text-white font-medium">{r.entity2.name}</span>
                        </div>
                        {r.description && <p className="text-xs text-slate-400 mt-1">{r.description}</p>}
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-cyan-500 hover:text-cyan-300 underline mt-1 inline-block">
                            Details ↗
                          </a>
                        )}
                      </div>
                    ))}
                    {!lsRelsLoading && lsRels.length === 0 && (
                      <div className="text-slate-500 text-sm py-4 text-center">No relationships found.</div>
                    )}
                  </div>
                </div>
              )}
              {!lsSelected && (
                <div className="text-slate-600 text-sm py-6 text-center">← Select an entity to see its connections</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: OpenCorporates ── */}
      {tab === 'opencorp' && (
        <div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5">
            <p className="text-xs text-slate-400 mb-3">
              <strong className="text-slate-200">OpenCorporates</strong> — the world's largest open database of companies (200M+). Search by name or jurisdiction.
            </p>
            <div className="flex gap-3 mb-3">
              <input
                type="text"
                value={ocQuery}
                onChange={e => setOcQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchOpenCorporates()}
                placeholder="Company name…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                autoFocus
              />
              <input
                type="text"
                value={ocJurisdiction}
                onChange={e => setOcJurisdiction(e.target.value)}
                placeholder="Jurisdiction (e.g. us_de)"
                className="w-44 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                onClick={searchOpenCorporates}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                Search ↗
              </button>
            </div>
            <p className="text-xs text-slate-500">Opens OpenCorporates.com in a new tab. Common jurisdictions: us_de (Delaware), us_ca (California), gb (UK), de (Germany).</p>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'OCCRP Aleph', desc: 'Leaked documents, offshore records, court files', url: 'https://aleph.occrp.org', emoji: '🔍' },
              { title: 'Open Oligarchs', desc: 'OCCRP oligarch asset tracking', url: 'https://oligarchs.occrp.org', emoji: '💰' },
              { title: 'ICIJ Offshore Leaks', desc: 'Panama Papers, Pandora Papers, Paradise Papers', url: 'https://offshoreleaks.icij.org', emoji: '🏝️' },
              { title: 'OpenSanctions Explorer', desc: 'Browse all sanctions lists and PEP databases', url: 'https://www.opensanctions.org/search/', emoji: '🚫' },
              { title: 'SEC EDGAR', desc: 'US public company filings, executives, ownership', url: 'https://efts.sec.gov/LATEST/search-index?q=', emoji: '📈' },
              { title: 'Companies House UK', desc: 'UK company directors, filings, accounts', url: 'https://find-and-update.company-information.service.gov.uk/', emoji: '🇬🇧' },
              { title: 'OpenCorporates API', desc: 'Direct API access to company data', url: 'https://api.opencorporates.com/v0.4/companies/search?q=', emoji: '🔌' },
              { title: 'UNCTAD Investment Data', desc: 'Trade, FDI, and investment flows by country', url: 'https://unctadstat.unctad.org/EN/', emoji: '📊' },
              { title: 'UN Digital Library', desc: 'UN resolutions, reports, official documents', url: 'https://digitallibrary.un.org/', emoji: '📚' },
            ].map(link => (
              <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer"
                className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 hover:border-emerald-500 transition-all group">
                <div className="text-2xl mb-2">{link.emoji}</div>
                <div className="font-semibold text-white text-sm group-hover:text-emerald-300 transition-colors">{link.title}</div>
                <div className="text-xs text-slate-400 mt-1">{link.desc}</div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
