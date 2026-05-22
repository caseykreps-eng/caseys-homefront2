export interface ThreatEvent {
  id: string;
  event: string;
  region: string;
  severity: 'CRITICAL' | 'STANDARD';
  lat: number;
  lon: number;
  actor: string;
  fatalities?: number;
  timestamp?: string;
  source?: string;
}