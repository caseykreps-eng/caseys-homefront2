'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveData } from '../../../hooks/useLiveData';
import type { IntelNode } from '../../../hooks/useLiveData';

const TacticalMap = dynamic(() => import('../../../components/TacticalMap'), { ssr: false });

interface Vessel {
  id: string;
  mmsi: string;
  name: string;
  lat: number;
  lon: number;
  speed: number;
  heading: number;
  status: number;
  statusLabel: string;
  destination: string;
  shipType: number;
  flag: string;
  timestamp: string;
  imo: string | null;
  callsign: string;
  length: number | null;
  source: string;
}

type Tab = 'positions' | 'search';

const REGIONS = [
  { value: 'medBlackSea',  label: '🌊 Med / Black Sea'   },
  { value: 'persianGulf',  label: '🛢️ Persian Gulf'       },
  { value: 'redSea',       label: '🚢 Red Sea'             },
  { value: 'indiaOcean',   label: '🌏 Indian Ocean'        },
  { value: 'northAtlantic',label: '🌎 North Atlantic'      },
  { value: 'global',       label: '🌍 Global (slow)'       },
];

const TYPES = [
  { value: 'all',       label: 'All vessels'   },
  { value: 'tanker',    label: '🛢️ Tankers'    },
  { value: 'cargo',     label: '📦 Cargo'       },
  { value: 'military',  label: '⚓ Military'    },
  { value: 'passenger', label: '🛳️ Passenger'  },
  { value: 'fishing',   label: '🎣 Fishing'    },
];

function shipEmoji(shipType: number): string {
  if (shipType >= 80 && shipType <= 89) return '🛢️';
  if (shipType >= 70 && shipType <= 79) return '📦';
  if (shipType === 35) return '⚓';
  if (shipType >= 60 && shipType <= 69) return '🛳️';
  if (shipType === 30) return '🎣';
  if (shipType >= 21 && shipType <= 29) return '🔧';
  return '🚢';
}

function speedColor(speed: number): string {
  if (speed < 0.5)  return 'text-slate-500';
  if (speed < 5)    return 'text-yellow-400';
  if (speed < 12)   return 'text-green-400';
  return 'text-teal-300';
}

export default function TransitLogisticsPage() {
  const { navalEvents = [], militaryFlights = [], webcams = [] } = useLiveData();
  const [isDarkMap, setIsDarkMap] = useState(true);
  const [tab, setTab] = useState<Tab>('positions');

  // AIS live positions
  const [region, setRegion]         = useState('medBlackSea');
  const [vesselType, setVesselType] = useState('all');
  const [vessels, setVessels]       = useState<Vessel[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [aisStatus, setAisStatus]   = useState<'ok' | 'error' | 'unconfigured' | 'loading'>('loading');
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  const loadPositions = useCallback(async (r: string, t: string) => {
    setLoading(true); setError('');
    try {
      // Try MarineTraffic first (real API key configured)
      const mtRes  = await fetch(`/api/marinetraffic?action=positions&region=${r}&type=${t}&timespan=10&limit=200`);
      const mtJson = await mtRes.json();

      if (!mtJson.notConfigured && !mtJson.error && (mtJson.vessels?.length ?? 0) > 0) {
        setVessels(mtJson.vessels ?? []);
        setAisStatus('ok');
        setLastUpdate(new Date().toLocaleTimeString());
        return;
      }

      // Fallback to aisstream.io
      const res  = await fetch(`/api/ais?region=${r}&type=${t}`);
      const json = await res.json();
      if (json.notConfigured) { setAisStatus('unconfigured'); return; }
      if (json.error) throw new Error(json.error);
      setVessels(json.vessels ?? []);
      setAisStatus('ok');
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e.message);
      setAisStatus('error');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadPositions(region, vesselType); }, [region, vesselType, loadPositions]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const iv = setInterval(() => loadPositions(region, vesselType), 3 * 60_000);
    return () => clearInterval(iv);
  }, [region, vesselType, loadPositions]);

  // Search tab (via MarineTraffic / VesselFinder external + MMSI lookup)
  const [searchQ, setSearchQ]           = useState('');
  const [mmsiResult, setMmsiResult]     = useState<Vessel | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Find vessel in current pool by name/MMSI
  const searchLocal = useCallback((q: string) => {
    if (!q.trim()) { setMmsiResult(null); return; }
    const lower = q.toLowerCase();
    const found = vessels.find(
      v => v.name.toLowerCase().includes(lower) || v.mmsi.includes(q) || (v.imo ?? '').includes(q)
    );
    setMmsiResult(found ?? null);
  }, [vessels]);

  // Map events
  const vesselEvents = vessels
    .filter(v => v.lat && v.lon)
    .map(v => ({
      id:        v.id,
      lat:       v.lat,
      lon:       v.lon,
      event:     v.name,
      region:    v.destination || v.flag || '',
      actor:     v.callsign || `MMSI ${v.mmsi}`,
      timestamp: v.timestamp,
      source:    v.source ?? 'AIS',
      goldstein: null,
      url:       null,
    }));

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            🚢 Maritime Intelligence
          </h1>
          {/* Status dot */}
          <span className={`w-2 h-2 rounded-full ${
            aisStatus === 'ok'           ? 'bg-emerald-400 animate-pulse' :
            aisStatus === 'unconfigured' ? 'bg-yellow-400' :
            aisStatus === 'error'        ? 'bg-red-400' : 'bg-slate-600'
          }`} />
          {aisStatus === 'ok' && lastUpdate && (
            <span className="text-xs text-slate-500">Updated {lastUpdate} · {vessels.length} vessels</span>
          )}
          {aisStatus === 'unconfigured' && (
            <span className="text-xs text-yellow-400 border border-yellow-800 bg-yellow-900/30 px-2 py-0.5 rounded-lg">
              AIS key needed — add MARINETRAFFIC_KEY or AIS_KEY to .env
            </span>
          )}
          {aisStatus === 'error' && (
            <span className="text-xs text-red-400 border border-red-800 bg-red-900/30 px-2 py-0.5 rounded-lg">
              AIS error
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadPositions(region, vesselType)} disabled={loading}
            className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 text-xs hover:bg-slate-700 transition disabled:opacity-50">
            {loading ? '⟳ Loading…' : '↺ Refresh'}
          </button>
          <button onClick={() => setIsDarkMap(!isDarkMap)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-300 text-sm hover:bg-slate-700 transition">
            {isDarkMap ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border-r border-slate-800 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-slate-800 shrink-0">
            {([{ id: 'positions', label: '📡 Live AIS' }, { id: 'search', label: '🔍 Find Vessel' }] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
                  tab === t.id ? 'text-teal-300 border-teal-400 bg-slate-800/50' : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ── LIVE AIS ── */}
            {tab === 'positions' && (
              <div className="p-3">
                {/* Region picker */}
                <div className="mb-2">
                  <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-widest">Region</div>
                  <div className="grid grid-cols-2 gap-1">
                    {REGIONS.map(r => (
                      <button key={r.value} onClick={() => setRegion(r.value)}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          region === r.value ? 'bg-teal-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type filter */}
                <div className="mb-3">
                  <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-widest">Filter</div>
                  <div className="flex gap-1 flex-wrap">
                    {TYPES.map(t => (
                      <button key={t.value} onClick={() => setVesselType(t.value)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          vesselType === t.value ? 'bg-cyan-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Setup notice */}
                {aisStatus === 'unconfigured' && (
                  <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-3 mb-3 text-xs text-yellow-300 space-y-1.5">
                    <div className="font-semibold">Setup required (2 min)</div>
                    <ol className="list-decimal list-inside space-y-1 text-yellow-400/80">
                      <li>Go to <a href="https://aisstream.io" target="_blank" className="underline text-yellow-300">aisstream.io</a> → sign up free</li>
                      <li>Copy your API key</li>
                      <li>Add <code className="bg-yellow-900/40 px-1 rounded">AIS_KEY=your-key</code> to <code>.env</code></li>
                      <li>Restart the dev server</li>
                    </ol>
                  </div>
                )}

                {error && !loading && (
                  <div className="bg-red-900/20 border border-red-800 rounded-xl p-3 mb-3 text-xs text-red-300">{error}</div>
                )}

                {loading && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
                    <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    Streaming AIS data…
                  </div>
                )}

                {!loading && vessels.length > 0 && (
                  <div className="text-xs text-slate-500 mb-2">{vessels.length} vessels · click to inspect</div>
                )}

                <div className="space-y-1.5">
                  {vessels.map(v => (
                    <div key={v.id}
                      onClick={() => setSelectedVessel(selectedVessel?.id === v.id ? null : v)}
                      className={`border rounded-xl p-3 cursor-pointer transition-all hover:border-teal-600 ${
                        selectedVessel?.id === v.id ? 'border-teal-500 bg-teal-900/20' : 'border-slate-700 bg-slate-800/40'
                      }`}>
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-white truncate">
                            {shipEmoji(v.shipType)} {v.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono">{v.mmsi} {v.callsign && `· ${v.callsign}`}</div>
                        </div>
                        <div className="text-right shrink-0 text-xs">
                          <div className={`font-mono font-semibold ${speedColor(v.speed)}`}>{v.speed.toFixed(1)} kn</div>
                          {v.flag && <div className="text-slate-400">{v.flag}</div>}
                        </div>
                      </div>
                      {v.destination && (
                        <div className="text-xs text-slate-400 mt-1 truncate">→ {v.destination}</div>
                      )}
                      {v.statusLabel && v.statusLabel !== 'Underway' && (
                        <div className="text-xs text-amber-400 mt-0.5">{v.statusLabel}</div>
                      )}
                    </div>
                  ))}
                  {!loading && aisStatus === 'ok' && vessels.length === 0 && (
                    <div className="text-slate-500 text-sm text-center py-8">No vessels in this region/filter.</div>
                  )}
                </div>
              </div>
            )}

            {/* ── VESSEL SEARCH ── */}
            {tab === 'search' && (
              <div className="p-3 space-y-3">
                <div>
                  <div className="text-xs text-slate-500 mb-2">Search vessels currently in the loaded region by name, MMSI, or callsign.</div>
                  <input
                    type="text"
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value); searchLocal(e.target.value); }}
                    placeholder="Vessel name, MMSI, or callsign…"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-teal-400"
                  />
                </div>

                {searchQ && !mmsiResult && (
                  <div className="text-slate-500 text-sm text-center py-4">
                    Not found in current region snapshot.
                    <br />
                    <span className="text-xs text-slate-600">Try loading a different region, or search externally:</span>
                  </div>
                )}

                {mmsiResult && (
                  <div className="border border-teal-600 rounded-xl p-3 bg-teal-900/10">
                    <div className="font-bold text-white text-base">{shipEmoji(mmsiResult.shipType)} {mmsiResult.name}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                      <span className="text-slate-500">MMSI</span><span className="font-mono text-slate-200">{mmsiResult.mmsi}</span>
                      {mmsiResult.imo && <><span className="text-slate-500">IMO</span><span className="font-mono text-slate-200">{mmsiResult.imo}</span></>}
                      <span className="text-slate-500">Speed</span><span className={speedColor(mmsiResult.speed)}>{mmsiResult.speed.toFixed(1)} kn</span>
                      <span className="text-slate-500">Heading</span><span className="text-slate-200">{Math.round(mmsiResult.heading)}°</span>
                      {mmsiResult.flag && <><span className="text-slate-500">Flag</span><span className="text-slate-200">{mmsiResult.flag}</span></>}
                      {mmsiResult.destination && <><span className="text-slate-500">Dest.</span><span className="text-slate-200 truncate">{mmsiResult.destination}</span></>}
                      <span className="text-slate-500">Status</span><span className="text-slate-200">{mmsiResult.statusLabel}</span>
                    </div>
                    <button onClick={() => setSelectedVessel(mmsiResult)}
                      className="mt-3 w-full py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs rounded-lg transition-colors">
                      Pin on map
                    </button>
                  </div>
                )}

                {/* External search links */}
                <div className="border-t border-slate-800 pt-3">
                  <div className="text-xs text-slate-500 mb-2 uppercase tracking-widest">External lookup</div>
                  <div className="space-y-1.5">
                    {[
                      { label: '🔵 MarineTraffic',   url: `https://www.marinetraffic.com/en/ais/home/centerx:0/centery:0/zoom:4${searchQ ? `/mmsi:${searchQ}` : ''}` },
                      { label: '🟡 VesselFinder',     url: `https://www.vesselfinder.com/${searchQ ? `?mmsi=${searchQ}` : ''}` },
                      { label: '🟢 FleetMon',         url: `https://www.fleetmon.com/vessels/?s=${encodeURIComponent(searchQ)}` },
                      { label: '⚪ Equasis (IMO DB)', url: `https://www.equasis.org/EquasisWeb/restricted/Search?fs=Search` },
                    ].map(link => (
                      <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 rounded-xl text-xs text-slate-300 transition-colors">
                        {link.label}
                        <span className="text-slate-600">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected vessel detail (pinned bottom) */}
          {selectedVessel && (
            <div className="border-t border-slate-700 bg-slate-900 p-3 shrink-0">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="font-bold text-white text-sm">{shipEmoji(selectedVessel.shipType)} {selectedVessel.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{selectedVessel.mmsi}</div>
                </div>
                <button onClick={() => setSelectedVessel(null)} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs mb-3">
                {selectedVessel.imo        && <><span className="text-slate-500">IMO</span><span className="font-mono text-slate-300">{selectedVessel.imo}</span></>}
                {selectedVessel.flag       && <><span className="text-slate-500">Flag</span><span className="text-slate-300">{selectedVessel.flag}</span></>}
                {selectedVessel.callsign   && <><span className="text-slate-500">Call</span><span className="font-mono text-slate-300">{selectedVessel.callsign}</span></>}
                {selectedVessel.length     && <><span className="text-slate-500">Length</span><span className="text-slate-300">{selectedVessel.length}m</span></>}
                <span className="text-slate-500">Speed</span><span className={speedColor(selectedVessel.speed)}>{selectedVessel.speed.toFixed(1)} kn</span>
                <span className="text-slate-500">Heading</span><span className="text-slate-300">{Math.round(selectedVessel.heading)}°</span>
                {selectedVessel.destination && <><span className="text-slate-500">Dest.</span><span className="text-slate-300 truncate">{selectedVessel.destination}</span></>}
                <span className="text-slate-500">Status</span><span className="text-slate-300">{selectedVessel.statusLabel}</span>
                <span className="text-slate-500">Pos.</span><span className="font-mono text-slate-400 text-xs">{selectedVessel.lat.toFixed(3)}, {selectedVessel.lon.toFixed(3)}</span>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {selectedVessel.imo && (
                  <a href={`https://www.marinetraffic.com/en/ais/details/ships/imo:${selectedVessel.imo}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-blue-800 hover:bg-blue-700 text-white px-2.5 py-1 rounded-lg transition-colors">
                    MarineTraffic ↗
                  </a>
                )}
                <a href={`https://www.vesselfinder.com/?mmsi=${selectedVessel.mmsi}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1 rounded-lg transition-colors">
                  VesselFinder ↗
                </a>
                {selectedVessel.imo && (
                  <a href={`https://www.equasis.org/EquasisWeb/restricted/Search?fs=Search&Q_IMO=${selectedVessel.imo}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1 rounded-lg transition-colors">
                    Equasis ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 min-w-0">
          <TacticalMap
            navalEvents={[...navalEvents, ...vesselEvents]}
            militaryFlights={militaryFlights}
            webcams={webcams}
            visibleLayers={['naval', 'webcams']}
            onSelectNode={(node: IntelNode) => {
              const v = vessels.find(v => v.id === node.id);
              if (v) setSelectedVessel(v);
            }}
            isDarkMap={isDarkMap}
          />
        </div>
      </div>
    </div>
  );
}
