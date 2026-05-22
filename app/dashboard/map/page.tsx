'use client';

import dynamic from 'next/dynamic';
import { useLiveData } from '../../../hooks/useLiveData';
import { useState } from 'react';
import type { IntelNode } from '../../../hooks/useLiveData';

const TacticalMap = dynamic(() => import('../../../components/TacticalMap'), { ssr: false });

export default function MapPage() {
  const { navalEvents = [], militaryFlights = [] } = useLiveData();
  const [isDarkMap, setIsDarkMap] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  return (
    <div className="p-8 bg-[#fff0f8] dark:bg-zinc-950 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-teal-400 via-cyan-500 to-purple-500 bg-clip-text text-transparent sparkle">
            ✨ Air & Sea Tracker ✨
          </h1>
          <p className="text-xs text-teal-600 dark:text-teal-400 font-mono mt-1 uppercase tracking-widest">
            LIVE FLIGHTS & VESSELS
          </p>
        </div>
        
        <button
          onClick={() => setIsDarkMap(!isDarkMap)}
          className="px-6 py-3 bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 rounded-2xl text-teal-600 dark:text-teal-400 font-medium hover:bg-teal-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
        >
          {isDarkMap ? '☀️ Light Radar' : '🌙 Dark Radar'}
        </button>
      </div>

      <div className="h-[calc(100vh-160px)] rounded-3xl overflow-hidden border border-teal-200 shadow-xl">
        <TacticalMap 
          navalEvents={navalEvents}
          militaryFlights={militaryFlights}
          visibleLayers={['naval', 'military']}
          selectedEventId={selectedEventId}
          onSelectNode={(event: IntelNode) => setSelectedEventId(event.id)}
          isDarkMap={isDarkMap}
        />
      </div>
    </div>
  );
}