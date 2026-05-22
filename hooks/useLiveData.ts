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

export function useLiveData() {
  const [events, setEvents] = useState<IntelNode[]>([]);
  const [navalEvents, setNavalEvents] = useState<IntelNode[]>([]);
  const [watchEvents, setWatchEvents] = useState<IntelNode[]>([]);
  const [militaryFlights, setMilitaryFlights] = useState<IntelNode[]>([]);
  const [news, setNews] = useState<any[]>([]);

  // Demo data so your map works immediately
  useEffect(() => {
    setEvents([
      { id: "1", event: "Missile Strike Reported", actor: "State Forces", region: "Southern Lebanon", lat: 33.27, lon: 35.35, timestamp: "Just now", source: "OSINT" },
      { id: "2", event: "Drone Activity Spotted", actor: "Iranian Proxies", region: "Northern Israel", lat: 32.95, lon: 35.68, timestamp: "14 min ago", source: "OSINT" },
      { id: "3", event: "Explosion Confirmed", actor: "Unknown", region: "Yemen Border", lat: 15.95, lon: 43.45, timestamp: "29 min ago", source: "OSINT" },
    ]);

    setMilitaryFlights([
      { id: "f1", event: "ISR Flight", actor: "USAF", region: "Eastern Mediterranean", lat: 33.1, lon: 34.8, timestamp: "Live", source: "Demo" },
      { id: "f2", event: "Recon Flight", actor: "Allied Forces", region: "Near Cyprus", lat: 34.2, lon: 33.5, timestamp: "Live", source: "Demo" },
    ]);

    setNavalEvents([
      { id: "n1", event: "Cargo Vessel", actor: "Commercial", region: "Eastern Mediterranean", lat: 33.8, lon: 34.2, timestamp: "Live", source: "Demo" },
      { id: "n2", event: "Warship Track", actor: "Naval Force", region: "Red Sea", lat: 29.5, lon: 34.8, timestamp: "Live", source: "Demo" },
    ]);

    setNews([
      { id: "nw1", title: "Tensions escalate in Southern Lebanon", source: "OSINT", timestamp: "12 min ago", url: "#" },
      { id: "nw2", title: "Drone activity reported near Israeli border", source: "OSINT", timestamp: "31 min ago", url: "#" },
    ]);
  }, []);

  return { 
    events, 
    navalEvents, 
    watchEvents, 
    militaryFlights,
    news 
  };
}