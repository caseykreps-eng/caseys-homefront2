'use client';

import { forwardRef, useState, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const createCleanIcon = (emoji: string, size = 26, rotateDeg?: number | null, label?: string | null) => {
  const badge = label
    ? `<div style="margin-top:2px;font-size:9px;background:rgba(15,23,42,0.82);color:#fff;padding:1px 5px;border-radius:4px;white-space:nowrap;font-weight:700;font-family:monospace;letter-spacing:0.3px;max-width:72px;overflow:hidden;text-overflow:ellipsis;">${label}</div>`
    : '';
  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;">
      <div style="font-size:${size}px;line-height:1;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.5));transform:rotate(${rotateDeg ?? 0}deg);">${emoji}</div>
      ${badge}
    </div>`,
    iconSize: [72, size + (label ? 20 : 4)],
    iconAnchor: [36, (size + (label ? 20 : 4)) / 2],
    className: 'emoji-pin',
  });
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const MAPBOX_STYLES = {
  light:     'mapbox/streets-v12',
  dark:      'mapbox/dark-v11',
  satellite: 'mapbox/satellite-streets-v12',
} as const;

type MapStyle = keyof typeof MAPBOX_STYLES;

function tileUrl(style: MapStyle) {
  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLES[style]}/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`;
}

const MAPBOX_ATTRIBUTION = '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export default forwardRef<any, any>(({
  events = [],
  navalEvents = [],
  militaryFlights = [],
  fires = [],
  webcams = [],
  ucdpEvents = [],
  visibleLayers = ['naval', 'military'],
  selectedEventId = null,
  onSelectNode,
  isDarkMap = false,
}, ref) => {

  const [mapStyle, setMapStyle] = useState<MapStyle>(isDarkMap ? 'dark' : 'light');
  const [showSentinel, setShowSentinel] = useState(false);
  const [sentinelOpacity, setSentinelOpacity] = useState(0.65);
  const [showNaval, setShowNaval] = useState(visibleLayers.includes('naval'));
  const [showMilitary, setShowMilitary] = useState(visibleLayers.includes('military'));
  const [showConflict, setShowConflict] = useState(visibleLayers.includes('conflict'));
  const [showFires, setShowFires] = useState(visibleLayers.includes('fires'));
  const [showWebcams, setShowWebcams] = useState(visibleLayers.includes('webcams'));
  const [showUcdp, setShowUcdp] = useState(ucdpEvents.length > 0);

  // Overpass infra layers — fetched on demand when toggled on
  type InfraLayer = 'power' | 'military' | 'telecoms' | 'ports';
  const INFRA_LAYERS: { id: InfraLayer; label: string; emoji: string; color: string }[] = [
    { id: 'power',    label: 'Power',    emoji: '⚡', color: 'bg-yellow-600' },
    { id: 'military', label: 'Bases',    emoji: '🪖', color: 'bg-olive-600 bg-lime-800' },
    { id: 'telecoms', label: 'Telecoms', emoji: '📡', color: 'bg-blue-600' },
    { id: 'ports',    label: 'Ports',    emoji: '🚢', color: 'bg-sky-700' },
  ];
  const [infraOn, setInfraOn] = useState<Record<InfraLayer, boolean>>({
    power: false, military: false, telecoms: false, ports: false,
  });
  const [infraData, setInfraData] = useState<Record<InfraLayer, any[]>>({
    power: [], military: [], telecoms: [], ports: [],
  });
  const [infraLoading, setInfraLoading] = useState<Record<InfraLayer, boolean>>({
    power: false, military: false, telecoms: false, ports: false,
  });

  const toggleInfra = useCallback(async (layer: InfraLayer) => {
    const next = !infraOn[layer];
    setInfraOn(prev => ({ ...prev, [layer]: next }));
    if (next && infraData[layer].length === 0 && !infraLoading[layer]) {
      setInfraLoading(prev => ({ ...prev, [layer]: true }));
      try {
        // Default bbox covers Middle East + Eastern Europe
        const res = await fetch(
          `/api/overpass?layer=${layer}&south=20&west=20&north=58&east=70`
        );
        const json = await res.json();
        setInfraData(prev => ({ ...prev, [layer]: json.features ?? [] }));
      } catch { /* silent */ } finally {
        setInfraLoading(prev => ({ ...prev, [layer]: false }));
      }
    }
  }, [infraOn, infraData, infraLoading]);

  // Aviationstack on-demand route lookup — keyed by callsign
  const [routeDetails, setRouteDetails] = useState<Record<string, any>>({});

  const lookupRoute = useCallback(async (callsign: string) => {
    if (!callsign || routeDetails[callsign]) return;
    setRouteDetails(prev => ({ ...prev, [callsign]: { loading: true } }));
    try {
      const res = await fetch(`/api/flight-detail?callsign=${encodeURIComponent(callsign)}`);
      const data = await res.json();
      setRouteDetails(prev => ({ ...prev, [callsign]: data }));
    } catch {
      setRouteDetails(prev => ({ ...prev, [callsign]: { error: true } }));
    }
  }, [routeDetails]);

  const validNaval    = useMemo(() => navalEvents.filter((e: any) => e?.lat && !isNaN(e.lat) && e?.lon && !isNaN(e.lon)), [navalEvents]);
  const validMilitary = useMemo(() => militaryFlights.filter((e: any) => e?.lat && !isNaN(e.lat) && e?.lon && !isNaN(e.lon)), [militaryFlights]);
  const validEvents   = useMemo(() => events.filter((e: any) => e?.lat && !isNaN(e.lat) && e?.lon && !isNaN(e.lon)), [events]);
  const validFires    = useMemo(() => fires.filter((f: any) => f?.lat && !isNaN(f.lat) && f?.lon && !isNaN(f.lon)), [fires]);
  const validWebcams  = useMemo(() => webcams.filter((w: any) => w?.lat && !isNaN(w.lat) && w?.lon && !isNaN(w.lon)), [webcams]);
  const validUcdp     = useMemo(() => ucdpEvents.filter((e: any) => e?.lat && !isNaN(e.lat) && e?.lon && !isNaN(e.lon)), [ucdpEvents]);

  const hasConflictLayer = visibleLayers.includes('conflict') || events.length > 0;
  const hasFiresLayer    = visibleLayers.includes('fires') || fires.length > 0;
  const hasWebcamLayer   = visibleLayers.includes('webcams') || webcams.length > 0;

  return (
    <div className="relative w-full h-full">
      <MapContainer center={[30, 36]} zoom={4} className="w-full h-full" zoomControl={true}>
        <TileLayer
          key={mapStyle}
          url={tileUrl(mapStyle)}
          tileSize={512}
          zoomOffset={-1}
          attribution={MAPBOX_ATTRIBUTION}
        />

        {/* Sentinel-2 cloudless overlay — ESA/Copernicus via EOX IT Services, free */}
        {showSentinel && (
          <TileLayer
            key={`sentinel-${sentinelOpacity}`}
            url="https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg"
            opacity={sentinelOpacity}
            tileSize={256}
            zoomOffset={0}
            attribution='<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (CC BY 4.0)'
          />
        )}

        {showNaval && validNaval.map((e: any) => (
          <Marker key={e.id} position={[e.lat, e.lon]} icon={createCleanIcon('⚓', 26)} eventHandlers={{ click: () => onSelectNode?.(e) }}>
            <Popup className="bubbly-popup">
              <div className="font-bold text-teal-600">{e.event}</div>
              <div className="text-sm">{e.region}</div>
              <div className="text-xs text-slate-500">{e.timestamp}</div>
            </Popup>
          </Marker>
        ))}

        {showMilitary && validMilitary.map((e: any) => {
          const typeLabel = e.aircraftType
            ? e.aircraftType.split(' ')[0]
            : (e.region || e.event || null);
          const route = routeDetails[e.event];
          return (
            <Marker key={e.id} position={[e.lat, e.lon]} icon={createCleanIcon('✈️', 22, e.heading, typeLabel)} eventHandlers={{ click: () => onSelectNode?.(e) }}>
              <Popup className="bubbly-popup" minWidth={210}>
                <div className="font-bold text-orange-600 text-sm">{e.event}</div>
                {e.aircraftType && <div className="text-xs font-medium text-orange-500 mt-0.5">{e.aircraftType}</div>}
                {e.actor && e.actor !== e.id && <div className="text-xs text-slate-600 mt-1">Tail: {e.actor}</div>}
                {e.operator && <div className="text-xs text-slate-600">Operator: {e.operator}</div>}
                {e.country && <div className="text-xs text-slate-600">Country: {e.country}</div>}

                {!route && (
                  <button
                    onClick={() => lookupRoute(e.event)}
                    className="mt-1.5 text-xs text-blue-500 hover:text-blue-700 underline"
                  >
                    🔍 Lookup Route
                  </button>
                )}
                {route?.loading && <div className="text-xs text-slate-400 mt-1">Looking up route...</div>}
                {route?.error && <div className="text-xs text-red-400 mt-1">Route not available</div>}
                {route?.found === false && <div className="text-xs text-slate-400 mt-1">Not in commercial DB</div>}
                {route?.found && (
                  <div className="mt-1.5 text-xs border-t border-slate-100 pt-1.5 space-y-0.5">
                    {route.airline && <div className="text-slate-700 font-medium">{route.airline}</div>}
                    {route.departure && <div className="text-slate-600">From: {route.departure.airport} ({route.departure.iata})</div>}
                    {route.arrival && <div className="text-slate-600">To: {route.arrival.airport} ({route.arrival.iata})</div>}
                    {route.status && <div className="text-slate-500 capitalize">Status: {route.status}</div>}
                  </div>
                )}

                <div className="text-xs text-slate-400 mt-1.5 border-t border-slate-100 pt-1 flex gap-2">
                  {e.altitude != null && <span>{e.altitude.toLocaleString()}m</span>}
                  {e.velocity != null && <span>{Math.round(e.velocity * 1.944)}kt</span>}
                  {e.heading != null && <span>{Math.round(e.heading)}°</span>}
                </div>
                <div className="text-xs text-slate-400">{e.source} · Live</div>
              </Popup>
            </Marker>
          );
        })}

        {showConflict && validEvents.map((e: any) => {
          const goldstein = typeof e.goldstein === 'number' ? e.goldstein : null;
          const severity =
            goldstein == null ? null :
            goldstein <= -7  ? { label: 'Critical',  color: '#dc2626' } :
            goldstein <= -4  ? { label: 'Severe',    color: '#ea580c' } :
            goldstein <= -1  ? { label: 'Moderate',  color: '#d97706' } :
                               { label: 'Low',       color: '#65a30d' };
          return (
            <Marker
              key={e.id}
              position={[e.lat, e.lon]}
              icon={createCleanIcon(selectedEventId === e.id ? '🔴' : '💥', 20)}
              eventHandlers={{ click: () => onSelectNode?.(e) }}
            >
              <Popup className="bubbly-popup" minWidth={220}>
                <div className="font-bold text-red-600 text-sm leading-tight">{e.event}</div>
                {e.region && <div className="text-xs text-slate-500 mt-0.5">📍 {e.region}</div>}
                {e.actor && e.actor !== 'News' && (
                  <div className="text-xs text-slate-600 mt-1">Actors: {e.actor}</div>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-slate-500">{e.timestamp}</span>
                  {severity && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: severity.color + '20', color: severity.color }}>
                      {severity.label} ({goldstein?.toFixed(1)})
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{e.source}</span>
                </div>
                {e.url && (
                  <a href={e.url} target="_blank" rel="noopener noreferrer"
                    className="mt-1.5 block text-xs text-blue-500 hover:underline truncate">
                    🔗 Source article
                  </a>
                )}
              </Popup>
            </Marker>
          );
        })}

        {showFires && validFires.map((f: any) => (
          <Marker key={f.id} position={[f.lat, f.lon]} icon={createCleanIcon('🔥', 16)}>
            <Popup className="bubbly-popup">
              <div className="font-bold text-red-700 text-sm">{f.event}</div>
              <div className="text-xs text-slate-600 mt-0.5">{f.actor}</div>
              <div className="text-xs text-slate-500">{f.timestamp}</div>
              <div className="text-xs text-slate-400 mt-0.5">NASA FIRMS · VIIRS NRT</div>
            </Popup>
          </Marker>
        ))}

        {/* UCDP conflict events */}
        {showUcdp && validUcdp.map((e: any) => {
          const deathColor = e.deaths > 50 ? '🔴' : e.deaths > 10 ? '🟠' : '🟡';
          return (
            <Marker key={e.id} position={[e.lat, e.lon]} icon={createCleanIcon(deathColor, 16)} eventHandlers={{ click: () => onSelectNode?.(e) }}>
              <Popup className="bubbly-popup" minWidth={230}>
                <div className="font-bold text-red-700 text-sm leading-tight">{e.event}</div>
                <div className="text-xs text-slate-500 mt-0.5">📍 {e.region}</div>
                {e.actor && <div className="text-xs text-slate-600 mt-1">Actors: {e.actor}</div>}
                <div className="text-xs font-semibold text-red-600 mt-1.5">
                  ☠️ {e.deaths} estimated deaths
                  {e.deathsLow !== e.deathsHigh && ` (${e.deathsLow}–${e.deathsHigh})`}
                </div>
                {e.deathsCivilian > 0 && (
                  <div className="text-xs text-orange-500">👤 {e.deathsCivilian} civilian casualties</div>
                )}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{e.eventType}</span>
                  <span className="text-xs text-slate-400">{e.date}</span>
                  <span className="text-xs text-slate-400">UCDP GED</span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Overpass infrastructure layers */}
        {INFRA_LAYERS.map(({ id, emoji }) =>
          infraOn[id] && infraData[id].map((f: any) => (
            <Marker key={f.id} position={[f.lat, f.lon]} icon={createCleanIcon(emoji, 16)}>
              <Popup className="bubbly-popup" minWidth={180}>
                <div className="font-bold text-slate-700 text-sm">{f.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{f.tags?.type}</div>
                {f.tags?.operator && <div className="text-xs text-slate-400">Operator: {f.tags.operator}</div>}
                {f.tags?.voltage  && <div className="text-xs text-slate-400">Voltage: {f.tags.voltage}</div>}
                {f.tags?.wikidata && (
                  <a href={`https://www.wikidata.org/wiki/${f.tags.wikidata}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 underline mt-1 inline-block">Wikidata ↗</a>
                )}
                <div className="text-xs text-slate-400 mt-1">OpenStreetMap</div>
              </Popup>
            </Marker>
          ))
        )}

        {showWebcams && validWebcams.map((w: any) => (
          <Marker key={w.id} position={[w.lat, w.lon]} icon={createCleanIcon('📷', 18)}>
            <Popup className="bubbly-popup" minWidth={220}>
              <div className="font-bold text-cyan-700 text-sm leading-tight">{w.title}</div>
              {(w.city || w.country) && (
                <div className="text-xs text-slate-500 mt-0.5">{[w.city, w.country].filter(Boolean).join(', ')}</div>
              )}
              {w.preview && (
                <img
                  src={w.preview}
                  alt={w.title}
                  className="mt-2 w-full rounded object-cover"
                  style={{ maxHeight: 120 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              {w.detailUrl && (
                <a
                  href={w.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 block text-xs text-cyan-600 hover:text-cyan-800 underline"
                >
                  🔗 Open live feed
                </a>
              )}
              <div className="text-xs text-slate-400 mt-1">Windy Webcams</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Layer toggles */}
      <div className="absolute top-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-teal-200 z-[1000] flex flex-col gap-2">
        {/* Map style switcher */}
        <div className="flex gap-1 mb-1">
          {(['light', 'dark', 'satellite'] as MapStyle[]).map(s => (
            <button
              key={s}
              onClick={() => setMapStyle(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mapStyle === s
                  ? s === 'satellite' ? 'bg-emerald-600 text-white' : s === 'dark' ? 'bg-slate-700 text-white' : 'bg-sky-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'light' ? '☀️' : s === 'dark' ? '🌙' : '🛰️'}
            </button>
          ))}
        </div>

        {/* Sentinel-2 overlay */}
        <div className="border border-emerald-700/50 bg-emerald-950/40 rounded-xl px-2 py-1.5">
          <button
            onClick={() => setShowSentinel(!showSentinel)}
            className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showSentinel ? 'text-emerald-300' : 'text-slate-400 hover:text-emerald-400'
            }`}
          >
            <span className="text-base leading-none">🌍</span>
            <span>Sentinel-2</span>
            <span className={`ml-auto text-xs px-1.5 rounded font-bold ${showSentinel ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-700 text-slate-400'}`}>
              {showSentinel ? 'ON' : 'OFF'}
            </span>
          </button>
          {showSentinel && (
            <div className="px-1 pb-1 pt-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 w-6">{Math.round(sentinelOpacity * 100)}%</span>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={Math.round(sentinelOpacity * 100)}
                  onChange={e => setSentinelOpacity(Number(e.target.value) / 100)}
                  className="flex-1 h-1.5 accent-emerald-500"
                />
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-tight">ESA 2020 cloudless mosaic</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 mb-1" />
        {(visibleLayers.includes('naval') || showNaval) && (
          <button onClick={() => setShowNaval(!showNaval)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showNaval ? 'bg-teal-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            ⚓ Naval {showNaval ? 'ON' : 'OFF'}
          </button>
        )}
        {(visibleLayers.includes('military') || showMilitary) && (
          <button onClick={() => setShowMilitary(!showMilitary)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showMilitary ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            ✈️ Military {showMilitary ? 'ON' : 'OFF'}
          </button>
        )}
        {hasConflictLayer && (
          <button onClick={() => setShowConflict(!showConflict)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showConflict ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            💥 Conflict {showConflict ? 'ON' : 'OFF'}
          </button>
        )}
        {hasFiresLayer && (
          <button onClick={() => setShowFires(!showFires)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showFires ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            🔥 FIRMS {showFires ? 'ON' : 'OFF'} {validFires.length > 0 ? `(${validFires.length})` : ''}
          </button>
        )}
        {hasWebcamLayer && (
          <button onClick={() => setShowWebcams(!showWebcams)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showWebcams ? 'bg-cyan-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            📷 Webcams {showWebcams ? 'ON' : 'OFF'} {validWebcams.length > 0 ? `(${validWebcams.length})` : ''}
          </button>
        )}
        {validUcdp.length > 0 && (
          <button onClick={() => setShowUcdp(!showUcdp)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showUcdp ? 'bg-rose-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
            ☠️ UCDP {showUcdp ? 'ON' : 'OFF'} ({validUcdp.length})
          </button>
        )}

        {/* Infrastructure layers — on-demand from Overpass */}
        <div className="border-t border-slate-200 dark:border-slate-700 mt-1 pt-1">
          <div className="text-xs text-slate-400 px-1 mb-1 font-semibold">INFRA (OSM)</div>
          {INFRA_LAYERS.map(({ id, label, emoji, color }) => (
            <button
              key={id}
              onClick={() => toggleInfra(id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 w-full transition-all ${
                infraOn[id] ? `${color} text-white` : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {emoji} {label}
              {infraLoading[id] ? ' …' : infraOn[id] ? ` ON (${infraData[id].length})` : ' OFF'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
