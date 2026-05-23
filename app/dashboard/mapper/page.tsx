'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useGraphStore } from '@/store/useGraphStore';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const NODE_COLORS: Record<string, string> = {
  target:       '#ec4899',
  source:       '#a855f7',
  event:        '#ef4444',
  location:     '#10b981',
  organization: '#f59e0b',
};

const NODE_SIZES: Record<string, number> = {
  target:       14,
  source:       8,
  event:        6,
  location:     9,
  organization: 10,
};

const TYPE_LABELS: Record<string, string> = {
  target:       'TARGET',
  source:       'SOURCE',
  event:        'ARTICLE',
  location:     'LOCATION',
  organization: 'ENTITY',
};

export default function MapperPage() {
  const [targetQuery, setTargetQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const { nodes, edges, loading, error, fetchGraphData } = useGraphStore();
  const graphRef = useRef<any>(null);

  const handleMapping = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetQuery.trim()) return;
    fetchGraphData(targetQuery);
  };

  const graphData = {
    nodes: nodes.map(n => ({
      ...n,
      color: NODE_COLORS[n.type] ?? '#94a3b8',
      val:   NODE_SIZES[n.type]  ?? 6,
    })),
    links: edges.map(e => ({ source: e.source, target: e.target, label: e.label })),
  };

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = (NODE_SIZES[node.type] ?? 6) * 0.9;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    if (globalScale >= 1.2 || node.type === 'target') {
      ctx.font = `${node.type === 'target' ? 600 : 400} ${11 / globalScale}px sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        node.label?.length > 24 ? node.label.slice(0, 22) + '…' : node.label,
        node.x,
        node.y + r + 8 / globalScale,
      );
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800 shrink-0">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-teal-400 bg-clip-text text-transparent">
            Link Analysis Graph
          </h1>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-0.5">
            Entity · Source · Location · Relationship Mapping
          </p>
        </div>

        <form onSubmit={handleMapping} className="flex gap-3">
          <input
            type="text"
            value={targetQuery}
            onChange={e => setTargetQuery(e.target.value)}
            placeholder="Search entity, name, org, keyword..."
            className="w-72 bg-slate-800 border border-slate-600 rounded-xl px-5 py-3 text-sm focus:outline-none focus:border-pink-500 placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wide transition"
          >
            {loading ? 'Mapping…' : 'Build Graph'}
          </button>
        </form>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 px-8 py-2 border-b border-slate-800 shrink-0">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs text-slate-400 font-mono">{TYPE_LABELS[type]}</span>
          </div>
        ))}
        {nodes.length > 0 && (
          <span className="ml-auto text-xs text-slate-500 font-mono">
            {nodes.length} nodes · {edges.length} edges
          </span>
        )}
      </div>

      {/* Graph — full width */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-700 text-red-200 text-sm px-5 py-3 rounded-xl z-10">
            {error}
          </div>
        )}

        {nodes.length === 0 && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
            <svg className="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" strokeWidth="2"/>
              <circle cx="4"  cy="6"  r="2" strokeWidth="2"/>
              <circle cx="20" cy="6"  r="2" strokeWidth="2"/>
              <circle cx="4"  cy="18" r="2" strokeWidth="2"/>
              <circle cx="20" cy="18" r="2" strokeWidth="2"/>
              <line x1="12" y1="9"  x2="4"  y2="7"  strokeWidth="1.5"/>
              <line x1="12" y1="9"  x2="20" y2="7"  strokeWidth="1.5"/>
              <line x1="12" y1="15" x2="4"  y2="17" strokeWidth="1.5"/>
              <line x1="12" y1="15" x2="20" y2="17" strokeWidth="1.5"/>
            </svg>
            <p className="text-sm font-mono">Enter a target above to build the link graph</p>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-pink-400 text-sm font-mono animate-pulse">Building graph…</div>
          </div>
        )}

        {nodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            backgroundColor="#020617"
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={() => '#334155'}
            linkWidth={1}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            onNodeHover={setHoveredNode}
            nodeLabel={() => ''}
            cooldownTicks={120}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}

        {hoveredNode && (
          <div className="absolute bottom-6 left-6 bg-slate-800/95 border border-slate-600 rounded-xl p-4 max-w-xs text-sm pointer-events-none z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: NODE_COLORS[hoveredNode.type] ?? '#94a3b8' }} />
              <span className="text-xs font-mono text-slate-400 uppercase">{TYPE_LABELS[hoveredNode.type] ?? hoveredNode.type}</span>
            </div>
            <div className="font-semibold text-white leading-snug">{hoveredNode.label}</div>
            {hoveredNode.description && (
              <div className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {hoveredNode.description.slice(0, 140)}{hoveredNode.description.length > 140 ? '…' : ''}
              </div>
            )}
            {hoveredNode.url && (
              <div className="text-xs text-blue-400 mt-1.5 truncate">{hoveredNode.url}</div>
            )}
            {hoveredNode.published && (
              <div className="text-xs text-slate-500 mt-1">{new Date(hoveredNode.published).toLocaleString()}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
