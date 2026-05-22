import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url');

  if (!target) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CaseysHomefront/1.0)',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 });
  }
}