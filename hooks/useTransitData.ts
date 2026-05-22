'use client';

import { useState, useEffect } from 'react';

export interface IntelNode {
  id: string;
  event: string;
  actor: string;
  region: string;
  lat: number;
  lon: number;
  timestamp: string;
  source: string;
}

export function useTransitData() {
  const [militaryFlights, setMilitaryFlights] = useState<IntelNode[]>([]);
  const [navalEvents, setNavalEvents] = useState<IntelNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTransitLayers = async () => {
      try {
        const res = await fetch('/api/intel');
        if (res.ok) {
          const data = await res.json();
          setMilitaryFlights(data.militaryFlights || []);
          setNavalEvents(data.navalEvents || []);
        }
      } catch (error) {
        console.error("Logistics telemetry pipeline exception:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransitLayers();
    const interval = setInterval(fetchTransitLayers, 120000); // Polling loop every 2 minutes
    return () => clearInterval(interval);
  }, []);

  return { militaryFlights, navalEvents, loading };
}