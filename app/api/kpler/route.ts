import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.kpler.com';

// ─── OAuth2 JWT cache ──────────────────────────────────────────────────────────
// Kpler's token (KPLER_TOKEN env var) is base64-encoded "client_id:client_secret".
// We exchange it for a short-lived JWT via the client_credentials flow,
// then use that JWT as Bearer on every API call.

let jwtCache: { token: string; expires: number } | null = null;

// Kpler token endpoint candidates (we try them in order)
// Kpler uses Auth0 — confirmed endpoint
const AUTH_BASE = 'https://auth.kpler.com';
const TOKEN_ENDPOINTS = [
  `${AUTH_BASE}/oauth/token`,  // correct endpoint (Auth0)
  `${BASE}/v1/tokens`,         // fallback
];

async function getJWT(): Promise<string> {
  // Return cached JWT if still valid (with 60s buffer)
  if (jwtCache && jwtCache.expires > Date.now() + 60_000) {
    return jwtCache.token;
  }

  const raw = process.env.KPLER_TOKEN;
  if (!raw) throw new Error('KPLER_TOKEN not configured');

  // Decode base64 → "client_id:client_secret"
  const decoded = Buffer.from(raw, 'base64').toString('utf8');
  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) {
    // Token doesn't decode to id:secret — use it directly as-is
    return raw;
  }
  const clientId     = decoded.slice(0, colonIdx);
  const clientSecret = decoded.slice(colonIdx + 1);

  // Try each token endpoint
  for (const endpoint of TOKEN_ENDPOINTS) {
    try {
      // Try JSON body first (most common)
      // Auth0 client_credentials flow — form-encoded with audience
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type:    'client_credentials',
          client_id:     clientId,
          client_secret: clientSecret,
          audience:      'https://api.kpler.com',
        }).toString(),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const json = await res.json();
        const token     = json.access_token ?? json.token ?? json.jwt ?? json.accessToken;
        const expiresIn = json.expires_in   ?? json.expiresIn ?? 3600;
        if (token) {
          jwtCache = { token, expires: Date.now() + expiresIn * 1000 };
          console.log(`[kpler] JWT obtained, expires in ${expiresIn}s`);
          return token;
        }
      }

      // Check for Auth0 "access_denied" — account not yet activated
      if (res.status === 401) {
        const body = await res.json().catch(() => ({}));
        if (body.error === 'access_denied') {
          throw new Error(
            'Kpler API access not activated. Go to developers.kpler.com → My Account → ' +
            'activate API access, then wait a few minutes for propagation.'
          );
        }
      }
    } catch (e: any) {
      if (e.message?.includes('developers.kpler.com')) throw e; // surface activation error
      continue;
    }
  }

  // All token endpoints failed — fall back to using the raw token as Bearer
  // (works if the account is activated and token is already a JWT)
  console.warn('[kpler] Could not exchange for JWT — using raw token as Bearer');
  return raw;
}

// ─── Data cache ────────────────────────────────────────────────────────────────
const cache = new Map<string, { data: any; expires: number }>();

async function kplerFetch(path: string, ttlMs: number) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.data;

  const jwt = await getJWT();

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (res.status === 401) {
    // JWT may have expired — clear cache and let caller handle
    jwtCache = null;
    const body = await res.text().catch(() => '');
    throw new Error(`Kpler 401: ${body.slice(0, 300)}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Kpler ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  cache.set(path, { data, expires: Date.now() + ttlMs });
  return data;
}

// ─── Normalise vessel shape ────────────────────────────────────────────────────
function normaliseVessel(v: any) {
  return {
    id:           v.id ?? v.vesselId ?? v.vessel_id ?? null,
    name:         v.name ?? v.vesselName ?? v.vessel_name ?? 'Unknown',
    imo:          v.imo ?? v.imoNumber ?? null,
    mmsi:         v.mmsi ?? null,
    type:         v.type ?? v.vesselType ?? v.vessel_type ?? '',
    subType:      v.subType ?? v.sub_type ?? '',
    flag:         v.flag ?? v.flagName ?? v.flag_name ?? '',
    flagCode:     v.flagCode ?? v.flag_code ?? v.flagIso ?? '',
    deadweight:   v.deadweight ?? v.dwt ?? null,
    grossTonnage: v.grossTonnage ?? v.gt ?? null,
    builtYear:    v.builtYear ?? v.built ?? null,
    operator:     v.operator ?? v.operatorName ?? '',
    owner:        v.owner ?? v.ownerName ?? '',
    lat:          v.lat ?? v.latitude ?? null,
    lon:          v.lon ?? v.longitude ?? null,
    speed:        v.speed ?? v.sog ?? null,
    heading:      v.heading ?? v.cog ?? null,
    status:       v.navigationStatus ?? v.nav_status ?? v.status ?? '',
    destination:  v.destination ?? '',
    eta:          v.eta ?? null,
    lastSeen:     v.lastSeen ?? v.timestamp ?? v.time ?? null,
    draught:      v.draught ?? null,
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action') ?? 'search';

  try {
    if (action === 'search') {
      const q    = searchParams.get('q')?.trim() ?? '';
      const type = searchParams.get('type') ?? '';
      const flag = searchParams.get('flag') ?? '';
      if (!q && !type && !flag) return NextResponse.json({ vessels: [] });

      const params = new URLSearchParams();
      if (q)    params.set('name', q);
      if (type) params.set('vessel_type', type);
      if (flag) params.set('flag', flag);
      params.set('limit', '50');

      const data = await kplerFetch(`/v1/vessels?${params}`, 5 * 60_000);
      const vessels = (data?.vessels ?? data?.data ?? (Array.isArray(data) ? data : [])).map(normaliseVessel);
      return NextResponse.json({ vessels, count: vessels.length });
    }

    if (action === 'positions') {
      const vesselType = searchParams.get('type') ?? '';
      const limit      = searchParams.get('limit') ?? '200';
      const params     = new URLSearchParams({ limit });
      if (vesselType) params.set('vessel_type', vesselType);

      const data = await kplerFetch(`/v2/maritime/ais-latest?${params}`, 3 * 60_000);
      const positions = (data?.vessels ?? data?.data ?? (Array.isArray(data) ? data : []))
        .map(normaliseVessel)
        .filter((v: any) => v.lat != null && v.lon != null);
      return NextResponse.json({ positions, count: positions.length });
    }

    if (action === 'detail') {
      const id = searchParams.get('id') ?? '';
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      const data = await kplerFetch(`/v1/vessels/${id}`, 10 * 60_000);
      return NextResponse.json({ vessel: normaliseVessel(data?.vessel ?? data) });
    }

    if (action === 'portcalls') {
      const params = new URLSearchParams({ limit: searchParams.get('limit') ?? '25' });
      const vesselId = searchParams.get('vessel_id');
      const portId   = searchParams.get('port_id');
      if (vesselId) params.set('vessel_id', vesselId);
      if (portId)   params.set('port_id', portId);

      const data = await kplerFetch(`/v1/port-calls?${params}`, 10 * 60_000);
      const calls = data?.portCalls ?? data?.port_calls ?? data?.data ?? (Array.isArray(data) ? data : []);
      return NextResponse.json({ portCalls: calls, count: calls.length });
    }

    if (action === 'types') {
      const data = await kplerFetch('/v1/vessel-types', 60 * 60_000);
      const types = data?.vesselTypes ?? data?.vessel_types ?? data?.data ?? (Array.isArray(data) ? data : []);
      return NextResponse.json({ types });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (err: any) {
    const msg = err.message ?? '';
    const is401 = msg.includes('401');
    const isToken = msg.includes('JWT') || msg.includes('token') || msg.includes('auth');

    return NextResponse.json({
      error: msg,
      hint: is401 || msg.includes('developers.kpler.com')
        ? 'Kpler API access not activated. Visit developers.kpler.com → sign in → activate API access. Can take a few minutes to propagate after activation.'
        : undefined,
    }, { status: is401 ? 401 : 500 });
  }
}
