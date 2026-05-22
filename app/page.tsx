'use client';

import { useLiveData } from '../hooks/useLiveData';
import { useState } from 'react';
import { Shield, Plane, Anchor, Activity, Newspaper } from 'lucide-react';

export default function Home() {
  const { events = [], navalEvents = [], militaryFlights = [], news = [] } = useLiveData();

  // ----------------------------------------------------
  // LAYER VISIBILITY TOGGLES
  // ----------------------------------------------------
  const [showConflicts, setShowConflicts] = useState(true);
  const [showAviation, setShowAviation] = useState(true);
  const [showMarine, setShowMarine] = useState(true);
  const [showInfrastructure, setShowInfrastructure] = useState(true);

  // Split your navalEvents telemetry array to get separate data-density tallies
  const infrastructureCount = navalEvents.filter((p: any) => p.id?.startsWith('infra-')).length;
  const marineCount = navalEvents.filter((p: any) => p.id?.startsWith('marine-node-')).length;

  return (
    // STRICT SCROLLABLE OVERRIDE: Enforces natural vertical scrolling to prevent text truncation at high zoom levels
    <div className="w-full min-h-screen bg-zinc-950 text-zinc-100 font-mono p-4 md:p-8">
      
      {/* HUD DECK HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-pink-500 via-purple-400 to-blue-400 bg-clip-text text-transparent">
            Global Intel Dashboard
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase mt-1">Tactical Telemetry Control Interface</p>
        </div>

        {/* INTERFACE LAYER TOGGLE MATRIX */}
        <div className="flex flex-wrap gap-2 bg-zinc-900/60 p-2 rounded-xl border border-zinc-800/80">
          
          {/* Conflicts Toggle */}
          <button
            onClick={() => setShowConflicts(!showConflicts)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all border ${
              showConflicts 
                ? 'bg-pink-950/40 text-pink-400 border-pink-500/40 shadow-[0_0_12px_rgba(244,63,94,0.15)]' 
                : 'bg-zinc-950/40 text-zinc-600 border-zinc-900'
            }`}
          >
            <Shield size={13} className={showConflicts ? 'animate-pulse' : ''} />
            <span>Conflict Ops</span>
          </button>

          {/* Aviation Toggle */}
          <button
            onClick={() => setShowAviation(!showAviation)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all border ${
              showAviation 
                ? 'bg-purple-950/40 text-purple-400 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]' 
                : 'bg-zinc-950/40 text-zinc-600 border-zinc-900'
            }`}
          >
            <Plane size={13} className={showAviation ? 'animate-pulse' : ''} />
            <span>Aviation Mode</span>
          </button>

          {/* Marine Toggle */}
          <button
            onClick={() => setShowMarine(!showMarine)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all border ${
              showMarine 
                ? 'bg-blue-950/40 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]' 
                : 'bg-zinc-950/40 text-zinc-600 border-zinc-900'
            }`}
          >
            <Anchor size={13} className={showMarine ? 'animate-pulse' : ''} />
            <span>Marine Ops</span>
          </button>

          {/* Infrastructure Toggle */}
          <button
            onClick={() => setShowInfrastructure(!showInfrastructure)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all border ${
              showInfrastructure 
                ? 'bg-amber-950/40 text-amber-400 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                : 'bg-zinc-950/40 text-zinc-600 border-zinc-900'
            }`}
          >
            <Activity size={13} className={showInfrastructure ? 'animate-pulse' : ''} />
            <span>Grid Infra</span>
          </button>
        </div>
      </div>

      {/* STRATEGIC FEED DATA COUNT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Live Conflicts Card */}
        <div className={`p-6 rounded-2xl border transition-all duration-200 ${
          showConflicts 
            ? 'bg-zinc-900/80 border-pink-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
            : 'bg-zinc-900/20 border-zinc-900/50 opacity-30'
        }`}>
          <div className="flex items-center justify-between text-pink-400">
            <h2 className="text-xs font-bold uppercase tracking-widest">Live Conflicts</h2>
            <Shield size={16} />
          </div>
          <p className="text-4xl md:text-5xl font-black mt-4 tracking-tighter text-zinc-100">
            {events.length}
          </p>
        </div>

        {/* Air Recon Card */}
        <div className={`p-6 rounded-2xl border transition-all duration-200 ${
          showAviation 
            ? 'bg-zinc-900/80 border-purple-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
            : 'bg-zinc-900/20 border-zinc-900/50 opacity-30'
        }`}>
          <div className="flex items-center justify-between text-purple-400">
            <h2 className="text-xs font-bold uppercase tracking-widest">Air Recon</h2>
            <Plane size={16} />
          </div>
          <p className="text-4xl md:text-5xl font-black mt-4 tracking-tighter text-zinc-100">
            {militaryFlights.length}
          </p>
        </div>

        {/* Marine Ops Card */}
        <div className={`p-6 rounded-2xl border transition-all duration-200 ${
          showMarine 
            ? 'bg-zinc-900/80 border-blue-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
            : 'bg-zinc-900/20 border-zinc-900/50 opacity-30'
        }`}>
          <div className="flex items-center justify-between text-blue-400">
            <h2 className="text-xs font-bold uppercase tracking-widest">Marine Ops</h2>
            <Anchor size={16} />
          </div>
          <p className="text-4xl md:text-5xl font-black mt-4 tracking-tighter text-zinc-100">
            {marineCount}
          </p>
        </div>

        {/* Grid Infrastructure Card */}
        <div className={`p-6 rounded-2xl border transition-all duration-200 ${
          showInfrastructure 
            ? 'bg-zinc-900/80 border-amber-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]' 
            : 'bg-zinc-900/20 border-zinc-900/50 opacity-30'
        }`}>
          <div className="flex items-center justify-between text-amber-400">
            <h2 className="text-xs font-bold uppercase tracking-widest">Grid Vector</h2>
            <Activity size={16} />
          </div>
          <p className="text-4xl md:text-5xl font-black mt-4 tracking-tighter text-zinc-100">
            {infrastructureCount}
          </p>
        </div>
      </div>

      {/* DYNAMIC HIGH-DENSITY NEWS LOG STREAM */}
      <div className="mt-12">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-4 mb-6">
          <Newspaper size={18} className="text-purple-400" />
          <h2 className="text-lg font-black uppercase tracking-wider text-zinc-200">
            Integrated Intel Stream
          </h2>
        </div>
        
        <div className="grid gap-3">
          {news.length > 0 ? (
            news.slice(0, 12).map((item) => {
              const isCfr = item.id?.includes('news-cfr') || item.title?.includes('GEOPOLITICAL');
              const isFlight = item.id?.includes('news-flt');
              const isMarine = item.id?.includes('news-marine');

              // Apply filtering rules directly onto the streaming visual nodes
              if (isCfr && !showConflicts) return null;
              if (isFlight && !showAviation) return null;
              if (isMarine && !showMarine) return null;
              if (!isCfr && !isFlight && !isMarine && !showInfrastructure) return null;

              return (
                <a 
                  key={item.id} 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`block p-5 bg-zinc-900/40 rounded-xl border transition-all duration-150 group ${
                    isCfr ? 'hover:border-pink-500/30 border-zinc-900/80 hover:bg-pink-950/10' :
                    isFlight ? 'hover:border-purple-500/30 border-zinc-900/80 hover:bg-purple-950/10' :
                    isMarine ? 'hover:border-blue-500/30 border-zinc-900/80 hover:bg-blue-950/10' :
                    'hover:border-amber-500/30 border-zinc-900/80 hover:bg-amber-950/10'
                  }`}
                >
                  <div className="text-xs leading-relaxed font-bold text-zinc-300 group-hover:text-zinc-100 transition-colors">
                    {item.title}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-zinc-50 mt-3 font-semibold">
                    <span className={
                      isCfr ? 'text-pink-500' :
                      isFlight ? 'text-purple-400' :
                      isMarine ? 'text-blue-400' : 'text-amber-400'
                    }>
                      {item.source}
                    </span>
                    <span>•</span>
                    <span>{item.timestamp}</span>
                  </div>
                </a>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-zinc-600 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/10">
              Initializing live systems sync loops...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}