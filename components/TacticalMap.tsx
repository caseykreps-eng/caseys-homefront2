'use client';

import { forwardRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const createCleanIcon = (emoji: string, size = 26) => L.divIcon({
  html: `<div style="font-size: ${size}px; line-height: 1; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5)); background: transparent; border: none;">${emoji}</div>`,
  iconSize: [size + 6, size + 6],
  iconAnchor: [(size + 6)/2, (size + 6)/2],
  className: 'emoji-pin',
});

export default forwardRef<any, any>(({
  navalEvents = [],
  militaryFlights = [],
  visibleLayers = ['naval', 'military'],
  onSelectNode,
  isDarkMap = false
}, ref) => {

  const [showNaval, setShowNaval] = useState(visibleLayers.includes('naval'));
  const [showMilitary, setShowMilitary] = useState(visibleLayers.includes('military'));

  const validNaval = useMemo(() => navalEvents.filter(e => e?.lat && !isNaN(e.lat) && e?.lon && !isNaN(e.lon)), [navalEvents]);
  const validMilitary = useMemo(() => militaryFlights.filter(e => e?.lat && !isNaN(e.lat) && e?.lon && !isNaN(e.lon)), [militaryFlights]);

  return (
    <div className="relative w-full h-full">
      <MapContainer center={[32.5, 36]} zoom={6} className="w-full h-full" zoomControl={true}>
        <TileLayer
          url={isDarkMap 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" 
            : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          }
        />

        {showNaval && validNaval.map(e => (
          <Marker key={e.id} position={[e.lat, e.lon]} icon={createCleanIcon('⚓', 26)} eventHandlers={{ click: () => onSelectNode?.(e) }}>
            <Popup className="bubbly-popup">
              <div className="font-bold text-teal-600">{e.event}</div>
              <div className="text-sm">{e.region}</div>
              <div className="text-xs text-slate-500">{e.timestamp}</div>
            </Popup>
          </Marker>
        ))}

        {showMilitary && validMilitary.map(e => (
          <Marker key={e.id} position={[e.lat, e.lon]} icon={createCleanIcon('✈️', 24)} eventHandlers={{ click: () => onSelectNode?.(e) }}>
            <Popup className="bubbly-popup">
              <div className="font-bold text-orange-600">{e.event}</div>
              <div className="text-sm">{e.region}</div>
              <div className="text-xs text-slate-500">{e.actor} • {e.timestamp}</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Toggles for Air & Sea page */}
      <div className="absolute top-4 right-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-teal-200 z-[1000] flex flex-col gap-2">
        <button onClick={() => setShowNaval(!showNaval)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showNaval ? 'bg-teal-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
          ⚓ Naval {showNaval ? 'ON' : 'OFF'}
        </button>
        <button onClick={() => setShowMilitary(!showMilitary)} className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${showMilitary ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
          ✈️ Military {showMilitary ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
});