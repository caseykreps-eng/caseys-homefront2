// components/ResultCard.tsx
'use client';

import { useGraphStore, NodeType } from '@/store/useGraphStore';

interface Props {
  name: string;
  type: NodeType;
}

export default function ResultCard({ name, type }: Props) {
  const addNode = useGraphStore((state) => state.addNode);

  return (
    <div className="p-4 bg-slate-800 rounded-lg flex justify-between">
      <span>{name}</span>
      <button 
        onClick={() => addNode(name, type)}
        className="bg-purple-600 px-3 py-1 rounded text-xs uppercase"
      >
        + Add to Map
      </button>
    </div>
  );
}