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
  heading?: number | null;
  altitude?: number | null;
  velocity?: number | null;
  aircraftType?: string | null;
  country?: string | null;
  operator?: string | null;
}

export interface Webcam {
  id: string;
  webcamId: string;
  title: string;
  lat: number;
  lon: number;
  city: string;
  country: string;
  preview: string | null;
  detailUrl: string | null;
}

const DEMO_FLIGHTS: IntelNode[] = [
  { id: 'f1', event: 'ISR Flight', actor: 'USAF', region: 'Eastern Mediterranean', lat: 33.1, lon: 34.8, timestamp: 'Demo', source: 'DEMO' },
  { id: 'f2', event: 'Recon Flight', actor: 'Allied Forces', region: 'Near Cyprus', lat: 34.2, lon: 33.5, timestamp: 'Demo', source: 'DEMO' },
];

const DEMO_NAVAL: IntelNode[] = [
  { id: 'n1', event: 'Cargo Vessel', actor: 'Commercial', region: 'Eastern Mediterranean', lat: 33.8, lon: 34.2, timestamp: 'Demo', source: 'DEMO' },
  { id: 'n2', event: 'Warship Track', actor: 'Naval Force', region: 'Red Sea', lat: 29.5, lon: 34.8, timestamp: 'Demo', source: 'DEMO' },
];

const DEMO_EVENTS: IntelNode[] = [
  { id: '1', event: 'Missile Strike Reported', actor: 'State Forces', region: 'Southern Lebanon', lat: 33.27, lon: 35.35, timestamp: 'Demo', source: 'DEMO' },
  { id: '2', event: 'Drone Activity Spotted', actor: 'Iranian Proxies', region: 'Northern Israel', lat: 32.95, lon: 35.68, timestamp: 'Demo', source: 'DEMO' },
  { id: '3', event: 'Explosion Confirmed', actor: 'Unknown', region: 'Yemen Border', lat: 15.95, lon: 43.45, timestamp: 'Demo', source: 'DEMO' },
];

export function useLiveData() {
  const [events, setEvents] = useState<IntelNode[]>(DEMO_EVENTS);
  const [navalEvents, setNavalEvents] = useState<IntelNode[]>(DEMO_NAVAL);
  const [militaryFlights, setMilitaryFlights] = useState<IntelNode[]>(DEMO_FLIGHTS);
  const [fires, setFires] = useState<IntelNode[]>([]);
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntel = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/intel');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();

      if (data.militaryFlights?.length > 0) setMilitaryFlights(data.militaryFlights);
      if (data.navalEvents?.length > 0) setNavalEvents(data.navalEvents);
      if (data.conflicts?.length > 0) setEvents(data.conflicts);
      if (data.fires?.length > 0) setFires(data.fires);
    } catch (err) {
      console.error('Live data fetch failed, using demo data:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const fetchWebcams = async () => {
    try {
      const res = await fetch('/api/webcams');
      if (!res.ok) return;
      const data = await res.json();
      if (data.webcams?.length > 0) setWebcams(data.webcams);
    } catch {
      // Webcams are non-critical
    }
  };

  useEffect(() => {
    fetchIntel();
    fetchWebcams();

    const intelInterval = setInterval(fetchIntel, 30_000);
    // Webcam tokens expire in 10 min on free tier — refresh every 9 min
    const webcamInterval = setInterval(fetchWebcams, 9 * 60_000);

    return () => {
      clearInterval(intelInterval);
      clearInterval(webcamInterval);
    };
  }, []);

  return { events, navalEvents, watchEvents: [] as IntelNode[], militaryFlights, fires, webcams, news, loading, error };
}
