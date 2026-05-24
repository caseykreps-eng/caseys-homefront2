import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// RDAP — Registration Data Access Protocol, replaces WHOIS, free, no key
const cache = new Map<string, { data: any; expires: number }>();

function isIP(s: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /^[0-9a-fA-F:]+$/.test(s);
}

function flattenRdap(json: any, type: 'domain' | 'ip') {
  if (type === 'domain') {
    const ns   = (json.nameservers ?? []).map((n: any) => n.ldhName ?? n.unicodeName ?? '').filter(Boolean);
    const dates = (json.events ?? []).reduce((acc: any, e: any) => {
      acc[e.eventAction] = e.eventDate;
      return acc;
    }, {});

    const entities: any[] = json.entities ?? [];
    const registrant = entities.find((e: any) => e.roles?.includes('registrant'));
    const registrar  = entities.find((e: any) => e.roles?.includes('registrar'));

    const vcardOf = (e: any) => {
      const card = e?.vcardArray?.[1] ?? [];
      const get = (type: string) => card.find((c: any[]) => c[0] === type)?.[3] ?? '';
      return { name: get('fn'), org: get('org'), email: get('email'), phone: get('tel'), country: get('country-name') };
    };

    return {
      type:         'domain',
      domain:       json.ldhName ?? json.unicodeName ?? '',
      status:       json.status ?? [],
      nameservers:  ns,
      registered:   dates.registration ?? null,
      expiration:   dates.expiration ?? null,
      lastChanged:  dates['last changed'] ?? null,
      registrant:   vcardOf(registrant),
      registrar:    vcardOf(registrar),
      registrarName: registrar?.vcardArray?.[1]?.find((c: any[]) => c[0] === 'fn')?.[3] ?? registrar?.handle ?? null,
      secureDns:    json.secureDNS?.delegationSigned ?? false,
      port43:       json.port43 ?? null,
      handle:       json.handle ?? null,
      links:        (json.links ?? []).map((l: any) => ({ rel: l.rel, href: l.href })),
    };
  } else {
    // IP
    const entity  = (json.entities ?? [])[0];
    const card    = entity?.vcardArray?.[1] ?? [];
    const getCard = (type: string) => card.find((c: any[]) => c[0] === type)?.[3] ?? '';
    const dates   = (json.events ?? []).reduce((acc: any, e: any) => {
      acc[e.eventAction] = e.eventDate;
      return acc;
    }, {});
    return {
      type:         'ip',
      startAddress: json.startAddress ?? '',
      endAddress:   json.endAddress ?? '',
      ipVersion:    json.ipVersion ?? '',
      handle:       json.handle ?? '',
      name:         json.name ?? '',
      country:      json.country ?? '',
      registered:   dates.registration ?? null,
      lastChanged:  dates['last changed'] ?? null,
      orgName:      (getCard('fn') || entity?.handle) ?? '',
      orgEmail:     getCard('email') ?? '',
      status:       json.status ?? [],
      links:        (json.links ?? []).map((l: any) => ({ rel: l.rel, href: l.href })),
    };
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? '';
  if (!q) return NextResponse.json({ error: 'q required' }, { status: 400 });

  const hit = cache.get(q);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  const type: 'domain' | 'ip' = isIP(q) ? 'ip' : 'domain';
  const rdapUrl = `https://rdap.org/${type}/${encodeURIComponent(q)}`;

  try {
    const res = await fetch(rdapUrl, {
      headers: { Accept: 'application/rdap+json', 'User-Agent': 'GlobalIntelDashboard/1.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`RDAP ${res.status}`);
    const json = await res.json();
    const payload = { ...flattenRdap(json, type), raw: json };
    cache.set(q, { data: payload, expires: Date.now() + 30 * 60_000 });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
