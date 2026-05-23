import { NextRequest, NextResponse } from 'next/server';

// Cache per callsign indefinitely — routes don't change mid-flight
const routeCache = new Map<string, any>();

export async function GET(req: NextRequest) {
  const callsign = req.nextUrl.searchParams.get('callsign')?.trim().toUpperCase();
  if (!callsign) return NextResponse.json({ error: 'callsign required' }, { status: 400 });

  if (routeCache.has(callsign)) {
    return NextResponse.json(routeCache.get(callsign));
  }

  const key = process.env.AVIATIONSTACK_KEY;
  if (!key) return NextResponse.json({ error: 'AVIATIONSTACK_KEY not configured' }, { status: 500 });

  try {
    // Free tier is HTTP only (HTTPS requires paid plan)
    const params = new URLSearchParams({ access_key: key, flight_icao: callsign, limit: '1' });
    const res = await fetch(`http://api.aviationstack.com/v1/flights?${params}`, {
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) throw new Error(`Aviationstack ${res.status}`);

    const data = await res.json();
    const flight = data.data?.[0];

    if (!flight) {
      const result = { found: false };
      routeCache.set(callsign, result);
      return NextResponse.json(result);
    }

    const result = {
      found: true,
      airline: flight.airline?.name ?? null,
      status: flight.flight_status ?? null,
      departure: flight.departure ? {
        airport: flight.departure.airport,
        iata: flight.departure.iata,
        scheduled: flight.departure.scheduled,
        actual: flight.departure.actual,
      } : null,
      arrival: flight.arrival ? {
        airport: flight.arrival.airport,
        iata: flight.arrival.iata,
        scheduled: flight.arrival.scheduled,
        estimated: flight.arrival.estimated,
      } : null,
      live: flight.live ? {
        lat: flight.live.latitude,
        lon: flight.live.longitude,
        altitude: flight.live.altitude,
        speed: flight.live.speed_horizontal,
        heading: flight.live.direction,
        updated: flight.live.updated,
      } : null,
    };

    routeCache.set(callsign, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Aviationstack lookup failed:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
