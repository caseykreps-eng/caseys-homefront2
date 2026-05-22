'use client';

import dynamic from 'next/dynamic';
import { useLiveData } from '../../../hooks/useLiveData';
import { useState } from 'react';
import type { IntelNode } from '../../../hooks/useLiveData';

const TacticalMap = dynamic(() => import('../../../components/TacticalMap'), { ssr: false });

export default function ThreatIntelligencePage() {
  const { events } = useLiveData();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDarkMap, setIsDarkMap] = useState(false);

  return (
    <div className="p-8 bg-[#fff0f8] dark:bg-zinc-950 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent">
            Threat Intelligence Map
          </h1>
          <p className="text-xs text-pink-600 dark:text-pink-400 font-mono mt-1 uppercase tracking-widest">
            LIVE CONFLICT & WATCH LAYERS
          </p>
        </div>

        <button
          onClick={() => setIsDarkMap(!isDarkMap)}
          className="px-6 py-3 bg-white dark:bg-slate-800 border border-pink-300 dark:border-pink-700 rounded-2xl text-pink-600 dark:text-pink-400 font-medium hover:bg-pink-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
        >
          {isDarkMap ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-160px)]">
        <div className="lg:col-span-3 rounded-3xl overflow-hidden border border-pink-200">
          <TacticalMap 
            events={events}
            selectedEventId={selectedEventId}
            onSelectNode={(e: IntelNode) => setSelectedEventId(e.id)}
            isDarkMap={isDarkMap}
          />
        </div>

        <div className="bg-white dark:bg-slate-800 border border-pink-200 rounded-3xl p-6 overflow-y-auto">
          <h2 className="font-bold text-pink-600 mb-4">LIVE EVENTS</h2>
          {events.length > 0 ? events.map(event => (
            <div
              key={event.id}
              onClick={() => setSelectedEventId(event.id)}
              className={`p-4 mb-3 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${selectedEventId === event.id ? 'border-pink-500 bg-pink-50' : 'border-transparent hover:border-pink-200'}`}
            >
              <div className="font-medium">{event.event}</div>
              <div className="text-sm text-slate-600">{event.region} • {event.actor}</div>
              <div className="text-xs text-pink-500 mt-1">{event.timestamp}</div>
            </div>
          )) : (
            <p className="text-slate-500 italic">No recent events...</p>
          )}
        </div>
      </div>
    </div>
  );
}