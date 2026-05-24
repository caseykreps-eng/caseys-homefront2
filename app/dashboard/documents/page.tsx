'use client';

import { useState } from 'react';

interface AlephResult {
  id: string; caption: string; schema: string; collection: string;
  collectionId: string | null; name: string | null; country: string | null;
  date: string | null; address: string | null;
  url: string; collectionUrl: string | null; sourceUrl: string | null; score: number | null;
}

type Tab = 'federated' | 'aleph';

export default function DocumentIntelPage() {
  const [tab, setTab] = useState<Tab>('aleph');
  const [query, setQuery] = useState('');

  /* ── Aleph ── */
  const [alephQ, setAlephQ]         = useState('');
  const [alephSchema, setAlephSchema] = useState('');
  const [alephResults, setAlephResults] = useState<AlephResult[]>([]);
  const [alephLoading, setAlephLoading] = useState(false);
  const [alephError, setAlephError]   = useState('');
  const [alephTotal, setAlephTotal]   = useState(0);
  const [alephSelected, setAlephSelected] = useState<AlephResult | null>(null);

  const searchAleph = async () => {
    if (!alephQ.trim()) return;
    setAlephLoading(true); setAlephError(''); setAlephResults([]); setAlephSelected(null);
    try {
      const params = new URLSearchParams({ q: alephQ });
      if (alephSchema) params.set('schema', alephSchema);
      const res = await fetch(`/api/aleph?${params}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAlephResults(json.results ?? []);
      setAlephTotal(json.total ?? 0);
    } catch (e: any) {
      setAlephError(e.message);
    } finally {
      setAlephLoading(false);
    }
  };

  /* ── Federated / Google dork ── */
  const runMetaSearch = () => {
    if (!query) return;
    const dork = `site:documentcloud.org OR site:offshoreleaks.icij.org OR site:courtlistener.com OR site:scribd.com "${query}"`;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(dork)}`, '_blank');
  };

  const schemaColor = (s: string) => {
    if (s === 'Document' || s === 'Email') return 'text-amber-300';
    if (s === 'Person') return 'text-indigo-300';
    if (s === 'Company' || s === 'LegalEntity') return 'text-emerald-300';
    return 'text-slate-300';
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'aleph',     label: '🔍 OCCRP Aleph' },
    { id: 'federated', label: '🌐 Federated Scanner' },
  ];

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100">
      <div className="mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-teal-400 bg-clip-text text-transparent">
          📂 Document Archive Mining
        </h1>
        <p className="text-slate-400 text-sm mt-1">OCCRP Aleph leaks & entity search · Google federated dork scanner</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
              tab === t.id
                ? 'bg-slate-800 text-white border-pink-400'
                : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: OCCRP Aleph ── */}
      {tab === 'aleph' && (
        <div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-5 mb-5">
            <p className="text-xs text-slate-400 mb-3">
              <strong className="text-slate-200">OCCRP Aleph</strong> searches across leaked documents, offshore records, court files, sanctions lists, and corporate registries from 200+ datasets — Panama Papers, Pandora Papers, and more.
            </p>
            <div className="flex gap-3 mb-2">
              <input
                type="text"
                value={alephQ}
                onChange={e => setAlephQ(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchAleph()}
                placeholder="Name, company, address, document keyword…"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-400"
                autoFocus
              />
              <select value={alephSchema} onChange={e => setAlephSchema(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-pink-400">
                <option value="">All schemas</option>
                <option value="Person">Person</option>
                <option value="Company">Company</option>
                <option value="Document">Document</option>
                <option value="Email">Email</option>
                <option value="LegalEntity">Legal Entity</option>
                <option value="Asset">Asset</option>
              </select>
              <button onClick={searchAleph} disabled={alephLoading}
                className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {alephLoading ? '…' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-slate-500">Also try searching directly at <a href="https://aleph.occrp.org" target="_blank" rel="noopener noreferrer" className="text-pink-400 underline">aleph.occrp.org</a> for advanced filters.</p>
          </div>

          {alephError && <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-4">⚠️ {alephError}</div>}
          {alephTotal > 0 && <p className="text-slate-400 text-sm mb-4">{alephTotal.toLocaleString()} results · showing top {alephResults.length}</p>}

          {/* Detail panel */}
          {alephSelected && (
            <div className="bg-slate-800 border border-pink-700 rounded-2xl p-5 mb-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-white text-lg">{alephSelected.caption}</h3>
                  <span className={`text-xs font-medium ${schemaColor(alephSelected.schema)}`}>{alephSelected.schema}</span>
                  {alephSelected.collection && <span className="text-xs text-slate-500 ml-2">· {alephSelected.collection}</span>}
                </div>
                <button onClick={() => setAlephSelected(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {alephSelected.country && <div><span className="text-slate-400">Country: </span>{alephSelected.country}</div>}
                {alephSelected.date    && <div><span className="text-slate-400">Date: </span>{alephSelected.date.slice(0,10)}</div>}
                {alephSelected.address && <div className="col-span-2"><span className="text-slate-400">Address: </span>{alephSelected.address}</div>}
              </div>
              <div className="flex gap-3 mt-4 flex-wrap">
                <a href={alephSelected.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-pink-700 hover:bg-pink-600 text-white px-4 py-2 rounded-xl transition-colors">
                  View in Aleph ↗
                </a>
                {alephSelected.collectionUrl && (
                  <a href={alephSelected.collectionUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-colors">
                    Dataset ↗
                  </a>
                )}
                {alephSelected.sourceUrl && (
                  <a href={alephSelected.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl transition-colors">
                    Source ↗
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {alephResults.map(r => (
              <div key={r.id}
                onClick={() => setAlephSelected(r)}
                className={`bg-slate-800/60 border rounded-xl p-4 cursor-pointer transition-all hover:border-pink-500 ${
                  alephSelected?.id === r.id ? 'border-pink-500 bg-slate-800' : 'border-slate-700'
                }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white text-sm">{r.caption}</h3>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs">
                      <span className={`font-medium ${schemaColor(r.schema)}`}>{r.schema}</span>
                      {r.country    && <span className="text-slate-400">🌐 {r.country}</span>}
                      {r.date       && <span className="text-slate-400">📅 {r.date.slice(0,10)}</span>}
                      {r.collection && <span className="text-slate-500 truncate max-w-xs">{r.collection}</span>}
                    </div>
                  </div>
                  {r.score != null && (
                    <span className="text-xs text-slate-500 shrink-0">score {r.score.toFixed(0)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!alephLoading && alephQ && alephResults.length === 0 && !alephError && (
            <div className="text-slate-500 text-center py-10">No results for "{alephQ}"</div>
          )}
          {!alephQ && (
            <div className="text-slate-600 text-center py-10 text-sm">
              Search Aleph above — leaked docs, offshore records, court files, and more
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Federated Scanner ── */}
      {tab === 'federated' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6">
            <h2 className="text-pink-400 font-bold mb-4">FEDERATED SCANNER</h2>
            <p className="text-slate-400 text-xs mb-4">Google dork across DocumentCloud, ICIJ Offshore Leaks, CourtListener, and Scribd simultaneously.</p>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runMetaSearch()}
              placeholder="Target name / company / ID…"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-pink-400 text-sm placeholder-slate-500"
            />
            <button onClick={runMetaSearch}
              className="w-full bg-pink-600 hover:bg-pink-500 text-white py-3 rounded-xl font-bold text-sm transition-colors">
              LAUNCH FEDERATED SEARCH ↗
            </button>
          </div>

          <div className="bg-slate-800/60 border border-purple-700/50 rounded-2xl p-6">
            <h2 className="text-purple-400 font-bold mb-4">OCCRP ALEPH ENGINE</h2>
            <p className="text-slate-400 text-xs mb-4">The investigative tool for leaks, offshore records & court files. Direct link with your current query.</p>
            <a href={`https://aleph.occrp.org/search?q=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer"
              className="block w-full bg-purple-700 hover:bg-purple-600 text-white py-3 rounded-xl font-bold text-center text-sm transition-colors mb-3">
              OPEN ALEPH ↗
            </a>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'ICIJ Offshore Leaks', url: 'https://offshoreleaks.icij.org/search?q=' },
                { label: 'DocumentCloud',        url: 'https://www.documentcloud.org/search/Search?q=' },
                { label: 'UN Digital Library',   url: 'https://digitallibrary.un.org/search?ln=en&p=' },
                { label: 'PACER (US Courts)',     url: 'https://pcl.uscourts.gov/pcl/pages/search/find.jsf' },
              ].map(l => (
                <a key={l.url} href={`${l.url}${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer"
                  className="block bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-2 px-3 rounded-xl text-center transition-colors">
                  {l.label} ↗
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
