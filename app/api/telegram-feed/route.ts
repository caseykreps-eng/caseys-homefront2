import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Hybrid Telegram feed:
 *  1. Tries the local MTProto relay (real-time, all channels, full data)
 *  2. Falls back to RSShub RSS scraping (public channels only, no setup)
 *
 * Relay setup: cd telegram-relay && npm install && node relay.js
 * On first run you'll be prompted for a Telegram verification code.
 */

const RELAY_URL    = process.env.TG_RELAY_URL    ?? '';
const RELAY_SECRET = process.env.TG_RELAY_SECRET ?? '';

// ─── RSShub fallback channels ──────────────────────────────────────────────────
const RSS_CHANNELS = [
  { name: 'rybar',               label: 'Rybar',                 category: 'Russian mil-blog' },
  { name: 'wartranslated',       label: 'War Translated',         category: 'Translations'     },
  { name: 'intelslava',          label: 'Intel Slava Z',          category: 'Russian mil-blog' },
  { name: 'militarylandnet',     label: 'Military Land',          category: 'Analysis'         },
  { name: 'ukraine_world',       label: 'Ukraine World',          category: 'Ukrainian'        },
  { name: 'disclosetv',          label: 'DiscloseTV',             category: 'Breaking news'    },
  { name: 'osintdefender',       label: 'OSINT Defender',         category: 'OSINT'            },
  { name: 'MiddleEastSpectator', label: 'Middle East Spectator',  category: 'Middle East'      },
  { name: 'TheInsiderRu',        label: 'The Insider',            category: 'Investigations'   },
  { name: 'mod_russia',          label: 'MoD Russia',             category: 'Official'         },
];

const RSSHUB_HOSTS = [
  'https://rsshub.app',
  'https://rss.shinyowo.net',
  'https://rsshub.rssforever.com',
];

const rssCache = new Map<string, { items: any[]; fetched: number }>();
let rssFull: { items: any[]; expires: number } | null = null;

function parseRSS(xml: string, ch: typeof RSS_CHANNELS[0]): any[] {
  const items: any[] = [];
  for (const match of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(
        `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*<\\/${tag}>`, 'i'
      ));
      return m ? m[1].trim()
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
        .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#[0-9]+;/g,'')
        : '';
    };
    const title   = get('title');
    const link    = get('link');
    const pubDate = get('pubDate');
    const desc    = get('description').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 600);
    if (!desc && !title) continue;
    const imgMatch = block.match(/<img[^>]+src=["']([^"']+)["']/i)
      ?? block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
    items.push({
      id:           `tg-rss-${ch.name}-${link || pubDate || Math.random()}`,
      msgId:        null,
      channel:      ch.name,
      channelLabel: ch.label,
      category:     ch.category,
      text:         desc || title,
      title:        title || desc.slice(0, 80),
      link:         link || `https://t.me/${ch.name}`,
      tmeLink:      link?.replace('https://t.me/s/','https://t.me/') ?? `https://t.me/${ch.name}`,
      image:        imgMatch?.[1] ?? null,
      timestamp:    pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      views:        null,
      fwdFrom:      null,
      source:       'rss',
    });
  }
  return items;
}

async function fetchRSSChannel(ch: typeof RSS_CHANNELS[0]): Promise<any[]> {
  const hit = rssCache.get(ch.name);
  if (hit && Date.now() - hit.fetched < 8 * 60_000) return hit.items;

  for (const host of RSSHUB_HOSTS) {
    try {
      const res = await fetch(`${host}/telegram/channel/${ch.name}`, {
        headers: { 'User-Agent': 'GlobalIntelDashboard/1.0', Accept: 'application/rss+xml, */*' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      if (!xml.includes('<item')) continue;
      const items = parseRSS(xml, ch).slice(0, 20);
      rssCache.set(ch.name, { items, fetched: Date.now() });
      return items;
    } catch { continue; }
  }

  // Direct t.me/s/ fallback
  try {
    const res = await fetch(`https://t.me/s/${ch.name}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', Accept: 'text/html' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const html = await res.text();
      const msgs  = [...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
      const dates = [...html.matchAll(/datetime="([^"]+)"/gi)];
      const posts = [...html.matchAll(/data-post="([^"]+)"/gi)];
      const items = msgs.slice(0, 20).map((m, i) => {
        const text = m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0, 600);
        const date = dates[i]?.[1] ?? '';
        const postId = posts[i]?.[1] ?? '';
        return {
          id: `tg-rss-${ch.name}-${postId || i}`,
          msgId: null, channel: ch.name, channelLabel: ch.label, category: ch.category,
          text, title: text.slice(0, 80),
          link: postId ? `https://t.me/${postId}` : `https://t.me/${ch.name}`,
          tmeLink: postId ? `https://t.me/${postId}` : `https://t.me/${ch.name}`,
          image: null,
          timestamp: date ? new Date(date).toISOString() : new Date().toISOString(),
          views: null, fwdFrom: null, source: 'rss',
        };
      }).filter(i => i.text.length > 10);
      if (items.length) { rssCache.set(ch.name, { items, fetched: Date.now() }); return items; }
    }
  } catch { /* silent */ }

  return rssCache.get(ch.name)?.items ?? [];
}

async function getRSSFeed(channelFilter: string, limit: number, offset: number) {
  const channels = channelFilter === 'all'
    ? RSS_CHANNELS
    : RSS_CHANNELS.filter(c => c.name === channelFilter);

  if (rssFull && rssFull.expires > Date.now() && channelFilter === 'all') {
    const page = rssFull.items.slice(offset, offset + limit);
    return { items: page, total: rssFull.items.length, channels: RSS_CHANNELS, source: 'rss', offset, limit };
  }

  const results = await Promise.allSettled(channels.map(fetchRSSChannel));
  const items = results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (channelFilter === 'all') rssFull = { items, expires: Date.now() + 8 * 60_000 };

  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    channels: RSS_CHANNELS,
    source: 'rss',
    offset,
    limit,
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const limit   = Math.min(parseInt(req.nextUrl.searchParams.get('limit')  ?? '100'), 200);
  const offset  = parseInt(req.nextUrl.searchParams.get('offset') ?? '0');
  const channel = req.nextUrl.searchParams.get('channel') ?? 'all';

  // ── Try MTProto relay first ────────────────────────────────────────────────
  if (RELAY_URL) {
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset), channel });
      const res = await fetch(`${RELAY_URL}/messages?${params}`, {
        headers: { 'x-relay-secret': RELAY_SECRET },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        // Normalise relay messages to same shape as RSS items
        const items = (data.messages ?? []).map((m: any) => ({
          id:           `tg-relay-${m.channel}-${m.msgId}`,
          msgId:        m.msgId,
          channel:      m.channel,
          channelLabel: m.channel,
          category:     'Live',
          text:         m.text,
          title:        m.text?.slice(0, 80),
          link:         m.link,
          tmeLink:      m.link,
          image:        null,
          timestamp:    m.date,
          views:        m.views,
          fwdFrom:      m.fwdFrom,
          source:       'relay',
        }));
        return NextResponse.json({
          items,
          total:    data.total ?? items.length,
          channels: (data.channels ?? []).map((name: string) => ({
            name, label: name, category: 'Live',
          })),
          source:   'relay',
          relayOnline: true,
          offset,
          limit,
        });
      }
    } catch { /* relay offline — fall through to RSS */ }
  }

  // ── RSS fallback ───────────────────────────────────────────────────────────
  const rssData = await getRSSFeed(channel, limit, offset);
  return NextResponse.json({ ...rssData, relayOnline: false });
}

// Health check
export async function HEAD() {
  if (!RELAY_URL) return new NextResponse(null, { status: 200, headers: { 'x-relay': 'rss-only' } });
  try {
    const res = await fetch(`${RELAY_URL}/health`, { signal: AbortSignal.timeout(2000) });
    const j = await res.json();
    return new NextResponse(null, {
      status: j.ok ? 200 : 503,
      headers: { 'x-relay': j.connected ? 'connected' : 'disconnected' },
    });
  } catch {
    return new NextResponse(null, { status: 503, headers: { 'x-relay': 'offline' } });
  }
}
