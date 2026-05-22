import { create } from 'zustand';

interface GraphState {
  nodes: any[];
  edges: any[];
  loading: boolean;
  error: string | null;
  fetchGraphData: (query: string) => Promise<void>;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  loading: false,
  error: null,
  fetchGraphData: async (query: string) => {
    set({ loading: true, error: null });
    try {
      // Trigger the backend API instead of running exec locally on the client!
      const res = await fetch(`/api/mapper?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Failed to fetch mapping orchestration data.');
      
      const data = await res.json();
      set({ nodes: data.nodes, edges: data.edges });
    } catch (err: any) {
      set({ error: err.message || 'Unknown network execution error' });
    } finally {
      set({ loading: false });
    }
  },
}));