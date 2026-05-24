'use client';

import dynamic from 'next/dynamic';
import { useLiveData } from '../../../hooks/useLiveData';
import { useState, useEffect } from 'react';
import type { IntelNode } from '../../../hooks/useLiveData';

const TacticalMap = dynamic(() => import('../../../components/TacticalMap'), { ssr: false });

export default function ThreatIntelligencePage() {
  const { events, fires = [], webcams = [] } = useLiveData();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDarkMap, setIsDarkMap] = useState(false);

  // UCDP GED conflict events
  const [ucdpEvents, setUcdpEvents] = useState<any[]>([]);
  const [ucdpLoading, setUcdpLoading] = useState(false);
  const [ucdpError, setUcdpError] = useState<string | null>(null);
  const [showUcdpPanel, setShowUcdpPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<'gdelt' | 'ucdp'>('gdelt');

  useEffect(() => {
    setUcdpLoading(true);
    fetch('/api/ucdp?limit=200')
      .then(r => r.json())
      .then(d => {
        setUcdpEvents(d.events ?? []);
        if (d.error) setUcdpError(d.error);
      })
      .catch(e => setUcdpError(String(e)))
      .finally(() => setUcdpLoading(false));
  }, []);

  const allEvents = [...events];
  const selectedEvent = allEvents.find(e => e.id === selectedEventId)
    ?? ucdpEvents.find(e => e.id === selectedEventId);

  return (
    <div className="p-8 bg-[#fff0f8] dark:bg-zinc-950 min-h-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent">
            Threat Intelligence Map
          </h1>
          <p className="text-xs text-pink-600 dark:text-pink-400 font-mono mt-1 uppercase tracking-widest">
            LIVE CONFLICT · UCDP GED · WATCH LAYERS · WEBCAMS
          </p>
        </div>

        <div className="flex gap-3">
          {/* UCDP stats chip */}
          <div className="px-4 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs">
            {ucdpLoading ? (
              <span className="text-rose-400 animate-pulse">Loading UCDP…</span>
            ) : ucdpError ? (
              <span className="text-red-400">UCDP error</span>
            ) : (
              <span className="text-rose-700 dark:text-rose-300 font-semibold">
                ☠️ {ucdpEvents.length} UCDP events (last 12mo)
              </span>
            )}
          </div>
          <button
            onClick={() => setIsDarkMap(!isDarkMap)}
            className="px-6 py-3 bg-white dark:bg-slate-800 border border-pink-300 dark:border-pink-700 rounded-2xl text-pink-600 dark:text-pink-400 font-medium hover:bg-pink-50 dark:hover:bg-slate-700 transition flex items-center gap-2"
          >
            {isDarkMap ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-180px)]">
        <div className="lg:col-span-3 rounded-3xl overflow-hidden border border-pink-200">
          <TacticalMap
            events={events}
            fires={fires}
            webcams={webcams}
            ucdpEvents={ucdpEvents}
            visibleLayers={['conflict', 'fires', 'webcams']}
            selectedEventId={selectedEventId}
            onSelectNode={(e: IntelNode) => setSelectedEventId(e.id)}
            isDarkMap={isDarkMap}
          />
        </div>

        {/* Right panel */}
        <div className="bg-white dark:bg-slate-800 border border-pink-200 rounded-3xl p-6 overflow-y-auto flex flex-col">
          {/* Tab selector */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPanelTab('gdelt')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${panelTab === 'gdelt' ? 'bg-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
            >
              💥 GDELT ({events.length})
            </button>
            <button
              onClick={() => setPanelTab('ucdp')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${panelTab === 'ucdp' ? 'bg-rose-700 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}
            >
              ☠️ UCDP ({ucdpEvents.length})
            </button>
          </div>

          {panelTab === 'gdelt' && (
            <>
              <h2 className="font-bold text-pink-600 mb-3 text-sm uppercase tracking-widest">GDELT Live Events</h2>
              {events.length > 0 ? events.map(event => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={`p-3 mb-2 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${selectedEventId === event.id ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20' : 'border-transparent hover:border-pink-200'}`}
                >
                  <div className="font-medium text-sm leading-snug">{event.event}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{event.region} · {event.actor}</div>
                  <div className="text-xs text-pink-500 mt-1">{event.timestamp}</div>
                </div>
              )) : (
                <p className="text-slate-500 italic text-sm">No recent GDELT events...</p>
              )}
            </>
          )}

          {panelTab === 'ucdp' && (
            <>
              <h2 className="font-bold text-rose-700 mb-3 text-sm uppercase tracking-widest">UCDP Conflict Events</h2>
              {ucdpLoading && (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />)}
                </div>
              )}
              {!ucdpLoading && ucdpEvents.length === 0 && (
                <p className="text-slate-500 italic text-sm">{ucdpError ?? 'No UCDP events loaded.'}</p>
              )}
              {!ucdpLoading && ucdpEvents.slice(0, 80).map(event => (
                <div
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={`p-3 mb-2 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${selectedEventId === event.id ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20' : 'border-transparent hover:border-rose-200'}`}
                >
                  <div className="font-medium text-sm leading-snug">{event.event}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{event.region}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs text-rose-500 font-semibold">☠️ {event.deaths} deaths</span>
                    <span className="text-xs text-slate-400">{event.date?.slice(0, 10)}</span>
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 rounded">{event.eventType}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
