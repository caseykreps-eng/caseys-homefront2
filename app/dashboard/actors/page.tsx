'use client';
import { useState } from 'react';

type SearchVector = 'username' | 'email' | 'phone' | 'dork' | 'breach';

export default function ActorsPage() {
  const [activeVector, setActiveVector] = useState<SearchVector>('username');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [intelPayload, setIntelPayload] = useState<any>(null);

  const executeSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query) return;
    
    setLoading(true);
    setIntelPayload(null);
    
    try {
      const res = await fetch(`/api/actors/search?type=${activeVector}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setIntelPayload(data);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  return (
    <div className="p-10 bg-slate-950 min-h-screen font-mono text-slate-100">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-500 to-purple-500 bg-clip-text text-transparent mb-8">// PERSON INTELLIGENCE</h1>
      
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        
        {/* Navigation Selector Tabs Block - Full Preservation */}
        <div className="flex gap-2 mb-6">
          {(['username', 'email', 'phone', 'dork', 'breach'] as SearchVector[]).map((v) => (
            <button 
              key={v} 
              type="button"
              onClick={() => { setActiveVector(v); setIntelPayload(null); }} 
              className={`px-4 py-2 text-xs font-bold uppercase rounded border transition-all duration-150 ${activeVector === v ? 'bg-cyan-950 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              {v}
            </button>
          ))}
        </div>
        
        {/* Input Wrapper Form Structure enabling Autofill Elements */}
        <form onSubmit={executeSearch} className="flex gap-2 mb-6">
          <input 
            type="text" 
            name="query" 
            id="search-input"
            autoComplete="on"
            value={query} 
            onChange={(e) => setQuery(e.target.value)} 
            placeholder={`Enter target ${activeVector}...`}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors" 
          />
          <button 
            type="submit"
            disabled={loading}
            className="bg-cyan-950 border border-cyan-700 text-cyan-400 px-6 py-2.5 rounded-lg text-xs font-bold uppercase hover:bg-cyan-900 disabled:opacity-50 transition-all"
          >
            {loading ? 'SCANNING...' : 'ENGAGE VECTOR'}
          </button>
        </form>

        {/* Intelligence Payload Terminal Render Panel */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 min-h-[200px]">
          <div className="text-3xs text-slate-500 font-bold border-b border-slate-900 pb-2 mb-4 uppercase tracking-widest">
            {intelPayload?.engine || 'STANDBY'}
          </div>
          
          <div className="flex flex-col gap-1">
            {intelPayload?.results && intelPayload.results.length === 0 && (
              <div className="text-xs text-slate-600 p-3 italic">No structural intelligence mapped to vector payload.</div>
            )}
            
            {intelPayload?.results?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between items-center p-3 border-b border-slate-900 last:border-0 text-xs hover:bg-slate-900/40 rounded transition-colors">
                <span className="text-slate-300 font-bold">{item.platform}</span>
                <div className="flex items-center gap-4">
                  {item.url !== '#' && item.url !== '' ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300 font-bold text-3xs tracking-wider transition-colors">OPEN ↗</a>
                  ) : (
                    <span className="text-slate-600 text-3xs uppercase tracking-widest font-mono">DATA // STATIC</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}