/**
 * Telegram MTProto Relay
 * ──────────────────────
 * Connects via GramJS (MTProto), monitors channels, stores to JSON,
 * exposes HTTP API for the Next.js dashboard.
 *
 * First run: node relay.js → enter phone + verification code (one-time)
 * After that: runs headlessly, session saved to .session
 */

require('dotenv').config();

const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');
const { NewMessage }     = require('telegram/events');
const input              = require('input');
const express            = require('express');
const low                = require('lowdb');
const FileSync           = require('lowdb/adapters/FileSync');
const path               = require('path');
const fs                 = require('fs');

// ─── Config ────────────────────────────────────────────────────────────────────
const API_ID       = parseInt(process.env.TG_API_ID   ?? '0');
const API_HASH     = process.env.TG_API_HASH           ?? '';
const PHONE        = process.env.TG_PHONE              ?? '';
const PORT         = parseInt(process.env.PORT         ?? '3001');
const SECRET       = process.env.RELAY_SECRET          ?? 'changeme';
const SESSION_FILE = path.join(__dirname, '.session');
const MAX_MESSAGES = 2000; // keep last 2000 per channel

if (!API_ID || !API_HASH) {
  console.error('[relay] TG_API_ID / TG_API_HASH missing — edit telegram-relay/.env');
  process.exit(1);
}

const CHANNELS = (process.env.TG_CHANNELS ?? 'rybar,wartranslated,intelslava')
  .split(',').map(c => c.trim()).filter(Boolean);

// ─── JSON DB (lowdb) ───────────────────────────────────────────────────────────
const adapter = new FileSync(path.join(__dirname, 'messages.json'));
const db = low(adapter);
db.defaults({ messages: [], lastFetch: {} }).write();

function saveMessage(msg) {
  const existing = db.get('messages').find({ id: `${msg.channel}-${msg.msgId}` }).value();
  if (existing) return false;
  db.get('messages')
    .push({ ...msg, id: `${msg.channel}-${msg.msgId}` })
    .write();

  // Trim to MAX_MESSAGES per channel
  const all = db.get('messages').filter({ channel: msg.channel }).sortBy('timestamp').value();
  if (all.length > MAX_MESSAGES) {
    const toRemove = all.slice(0, all.length - MAX_MESSAGES).map(m => m.id);
    db.get('messages').remove(m => toRemove.includes(m.id)).write();
  }
  return true;
}

// ─── Telegram Client ───────────────────────────────────────────────────────────
let sessionString = '';
if (fs.existsSync(SESSION_FILE)) {
  sessionString = fs.readFileSync(SESSION_FILE, 'utf8').trim();
  console.log('[relay] Loaded existing session');
}

const client = new TelegramClient(
  new StringSession(sessionString),
  API_ID,
  API_HASH,
  { connectionRetries: 5, retryDelay: 1000 }
);

let connected = false;
let startTime = Date.now();

function formatMsg(msg, channelName) {
  return {
    msgId:     msg.id,
    channel:   channelName,
    text:      msg.message ?? '',
    date:      msg.date ?? Math.floor(Date.now() / 1000),
    timestamp: new Date((msg.date ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    views:     msg.views ?? 0,
    fwdFrom:   msg.fwdFrom?.fromName ?? msg.fwdFrom?.channelPost ?? null,
    mediaType: msg.media
      ? (msg.media.className ?? '').replace('MessageMedia','').toLowerCase() || 'media'
      : null,
    link: `https://t.me/${channelName}/${msg.id}`,
  };
}

async function fetchHistory(channelName, limit = 100) {
  try {
    const entity = await client.getEntity(channelName);
    const messages = await client.getMessages(entity, { limit });
    let saved = 0;
    for (const msg of messages) {
      if (!msg.message && !msg.media) continue;
      if (saveMessage(formatMsg(msg, channelName))) saved++;
    }
    console.log(`[relay] @${channelName}: fetched ${messages.length}, saved ${saved} new`);
    db.set(`lastFetch.${channelName}`, Date.now()).write();
  } catch (err) {
    console.warn(`[relay] Could not fetch @${channelName}:`, err.message);
  }
}

async function startRelay() {
  await client.start({
    phoneNumber: async () => PHONE || await input.text('Phone number (+1...): '),
    password:    async () => await input.text('2FA password (if any, else Enter): '),
    phoneCode:   async () => await input.text('Telegram verification code: '),
    onError:     (err) => console.error('[auth]', err.message),
  });

  const session = client.session.save();
  fs.writeFileSync(SESSION_FILE, session, 'utf8');
  console.log('[relay] ✅ Authenticated — session saved');
  connected = true;

  // Initial history fetch
  for (const ch of CHANNELS) {
    await fetchHistory(ch, 100);
    await sleep(1500); // respect rate limits
  }

  // Listen for new messages
  client.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg?.message && !msg?.media) return;

      let channelName = null;
      if (event.chatId) {
        const chat = await client.getEntity(event.chatId).catch(() => null);
        if (chat?.username) {
          const uname = chat.username.toLowerCase();
          if (CHANNELS.map(c => c.toLowerCase()).includes(uname)) {
            channelName = chat.username;
          }
        }
      }
      if (!channelName) return;

      const saved = saveMessage(formatMsg(msg, channelName));
      if (saved) console.log(`[relay] New message @${channelName}`);
    } catch (err) {
      console.warn('[relay] Event handler error:', err.message);
    }
  }, new NewMessage({ incoming: true }));

  // Refresh history every 5 minutes
  setInterval(async () => {
    for (const ch of CHANNELS) {
      await fetchHistory(ch, 30);
      await sleep(1000);
    }
  }, 5 * 60_000);

  console.log(`[relay] Monitoring: ${CHANNELS.join(', ')}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── HTTP Server ───────────────────────────────────────────────────────────────
const app = express();

// Health — no auth
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    connected,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    channels: CHANNELS,
    messageCount: db.get('messages').size().value(),
  });
});

// Auth middleware for all other routes
app.use((req, res, next) => {
  const token = req.headers['x-relay-secret'] ?? req.query.secret;
  if (token !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

app.get('/messages', (req, res) => {
  const limit   = Math.min(parseInt(req.query.limit  ?? '50'), 200);
  const offset  = parseInt(req.query.offset ?? '0');
  const channel = req.query.channel;
  const since   = req.query.since ? parseInt(req.query.since) : null;

  let query = db.get('messages');

  if (channel && channel !== 'all') {
    query = query.filter(m => m.channel === channel);
  }
  if (since) {
    query = query.filter(m => m.date >= since);
  }

  const sorted = query.sortBy('date').reverse().value();
  const page   = sorted.slice(offset, offset + limit);

  res.json({
    messages: page,
    total:    sorted.length,
    channels: CHANNELS,
    offset,
    limit,
  });
});

app.get('/channels', (req, res) => {
  const stats = CHANNELS.map(ch => ({
    name:   ch,
    count:  db.get('messages').filter({ channel: ch }).size().value(),
    latest: db.get('messages').filter({ channel: ch }).maxBy('date').value()?.timestamp ?? null,
  }));
  res.json({ channels: stats });
});

app.listen(PORT, () => {
  console.log(`[relay] HTTP server on http://localhost:${PORT}`);
  startRelay().catch(err => {
    console.error('[relay] Fatal:', err.message);
    process.exit(1);
  });
});
