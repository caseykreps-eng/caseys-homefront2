import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gdeltUrl = 'https://api.gdeltproject.org/api/v2/doc/doc?query=strike+OR+attack+OR+missile&mode=artlist&maxrecords=10&format=json';

    const res = await fetch(gdeltUrl, { 
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      return NextResponse.json({ conflicts: [] });
    }

    const data = await res.json();
    return NextResponse.json({
      conflicts: data.articles || []
    });

  } catch (error) {
    console.error("Intel API Error:", error);
    return NextResponse.json({ conflicts: [] });
  }
}