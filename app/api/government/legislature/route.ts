import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EP_BASE = 'https://raw.githubusercontent.com/everypolitician/everypolitician-data/master';
const COUNTRIES_URL = `${EP_BASE}/countries.json`;

// Cache the countries list for 1 hour
let countriesCache: { data: any[]; expires: number } | null = null;
// Per-legislature member cache, 30 min
const memberCache = new Map<string, { data: any; expires: number }>();

async function getCountries(): Promise<any[]> {
  if (countriesCache && countriesCache.expires > Date.now()) return countriesCache.data;
  const res = await fetch(COUNTRIES_URL, {
    headers: { 'User-Agent': 'GlobalIntelDashboard/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`EP countries ${res.status}`);
  const data = await res.json();
  countriesCache = { data, expires: Date.now() + 60 * 60_000 };
  return data;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action   = searchParams.get('action') ?? 'list';       // list | members
  const country  = searchParams.get('country') ?? '';           // slug, e.g. "United-States"
  const legSlug  = searchParams.get('legislature') ?? '';       // e.g. "Senate"

  try {
    if (action === 'list') {
      const countries = await getCountries();
      // Return slim list: name + legislatures
      const slim = countries.map((c: any) => ({
        name:        c.name,
        slug:        c.name.replace(/\s+/g, '-'),
        legislatures: (c.legislatures ?? []).map((l: any) => ({
          name:     l.name,
          slug:     l.slug ?? l.name.replace(/\s+/g, '-'),
          lastSeenDate: l.lastSeenDate ?? null,
          seats:    l.seats ?? null,
        })),
      }));
      return NextResponse.json({ countries: slim });
    }

    if (action === 'members') {
      if (!country || !legSlug) {
        return NextResponse.json({ members: [], error: 'country and legislature required' }, { status: 400 });
      }

      const cacheKey = `${country}/${legSlug}`;
      const hit = memberCache.get(cacheKey);
      if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

      // Find the popolo URL from countries.json
      const countries = await getCountries();
      const countryObj = countries.find(
        (c: any) => c.name.replace(/\s+/g, '-') === country || c.name === country
      );
      if (!countryObj) {
        return NextResponse.json({ members: [], error: `Country "${country}" not found` }, { status: 404 });
      }

      const legObj = (countryObj.legislatures ?? []).find(
        (l: any) => (l.slug ?? l.name.replace(/\s+/g, '-')) === legSlug || l.name === legSlug
      );
      if (!legObj) {
        return NextResponse.json({ members: [], error: `Legislature "${legSlug}" not found` }, { status: 404 });
      }

      // Build raw GitHub URL from sources_directory
      // sources_directory is like "data/United-States/Senate/sources"
      // ep-popolo-v1.0.json lives one level up: "data/United-States/Senate/ep-popolo-v1.0.json"
      let popoloUrl: string;
      if (legObj.popolo_url) {
        // Replace old rawgit.com CDN with raw.githubusercontent.com
        popoloUrl = (legObj.popolo_url as string)
          .replace('https://cdn.rawgit.com/everypolitician/everypolitician-data/', `${EP_BASE}/`)
          .replace('rawgit.com/everypolitician/everypolitician-data/', `raw.githubusercontent.com/everypolitician/everypolitician-data/`)
          .replace('/master/', '/master/');
        // Normalize: strip query strings
        popoloUrl = popoloUrl.split('?')[0];
      } else if (legObj.sources_directory) {
        const dir = (legObj.sources_directory as string).replace(/\/sources\/?$/, '');
        popoloUrl = `${EP_BASE}/${dir}/ep-popolo-v1.0.json`;
      } else {
        return NextResponse.json({ members: [], error: 'No popolo URL available for this legislature' }, { status: 404 });
      }

      const popoloRes = await fetch(popoloUrl, {
        headers: { 'User-Agent': 'GlobalIntelDashboard/1.0' },
        signal: AbortSignal.timeout(20000),
      });
      if (!popoloRes.ok) throw new Error(`EP popolo ${popoloRes.status} for ${popoloUrl}`);
      const popolo = await popoloRes.json();

      const persons: any[] = popolo.persons ?? [];
      const memberships: any[] = popolo.memberships ?? [];
      const orgs: any[] = popolo.organizations ?? [];

      // Build party lookup
      const partyMap: Record<string, string> = {};
      for (const org of orgs) {
        partyMap[org.id] = org.name ?? org.id;
      }

      // Build person lookup
      const personMap: Record<string, any> = {};
      for (const p of persons) {
        personMap[p.id] = p;
      }

      // Active memberships only (no end_date, or no end_date field)
      const activeMembers = memberships
        .filter((m: any) => !m.end_date)
        .map((m: any) => {
          const p = personMap[m.person_id] ?? {};
          return {
            id:          m.person_id,
            name:        p.name ?? m.person_id,
            party:       partyMap[m.on_behalf_of_id ?? ''] ?? m.on_behalf_of_id ?? '',
            area:        m.area?.name ?? '',
            role:        m.role ?? 'Member',
            startDate:   m.start_date ?? '',
            gender:      p.gender ?? '',
            birthDate:   p.birth_date ?? '',
            links:       (p.links ?? []).map((l: any) => ({ url: l.url, note: l.note })),
            imageUrl:    p.image ?? null,
          };
        });

      const payload = {
        country:    countryObj.name,
        legislature: legObj.name,
        dataNote:   'Data from EveryPolitician (frozen ~2019). Historical reference only.',
        lastSeenDate: legObj.lastSeenDate ?? null,
        members:    activeMembers,
        count:      activeMembers.length,
      };
      memberCache.set(cacheKey, { data: payload, expires: Date.now() + 30 * 60_000 });
      return NextResponse.json(payload);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
