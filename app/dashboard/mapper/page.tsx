'use client';

import { useState } from 'react';
import { useGraphStore } from '@/store/useGraphStore';

export default function MapperPage() {
  const [targetQuery, setTargetQuery] = useState('');
  const { nodes, edges, loading, error, fetchGraphData } = useGraphStore();

  const handleMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetQuery.trim()) return;
    fetchGraphData(targetQuery);
  };

  return (
    <div className="p-10 bg-[#fff0f8] min-h-screen">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent mb-10">
        🕸️ Footprint Visualization Mapper
      </h1>

      <div className="bg-white border border-pink-200 rounded-3xl p-8 shadow-xl">
        <form onSubmit={handleMapping} className="flex gap-3 mb-8">
          <input
            type="text"
            value={targetQuery}
            onChange={(e) => setTargetQuery(e.target.value)}
            placeholder="Enter target name, company, or keyword..."
            className="flex-1 bg-pink-50 border border-pink-200 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-pink-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-pink-500 hover:bg-pink-600 text-white px-8 py-4 rounded-2xl font-bold uppercase text-sm transition disabled:opacity-50"
          >
            {loading ? 'MAPPING...' : 'BUILD NETWORK'}
          </button>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 min-h-[420px]">
          {nodes.length === 0 && !loading ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              Enter a target above to build the graph
            </div>
          ) : (
            <div className="space-y-4">
              {nodes.map((node) => (
                <div key={node.id} className="p-4 bg-slate-900 rounded-xl flex justify-between items-center text-sm">
                  <span className="text-pink-400 font-bold">{node.label}</span>
                  <span className="text-xs text-slate-400 uppercase tracking-widest">{node.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}