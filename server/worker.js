// Пердёж-балдёж: rooms for friends. One room = one raft; the server runs the river and tells every phone where the raft is.
import * as G from '../sim.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS) });
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const enc = new TextEncoder();
async function hmac(key, msg) { const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? enc.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return crypto.subtle.sign('HMAC', k, enc.encode(msg)); }
function same(a, b) { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const FRESH = 7*24*3600, STEP_MS = 1000*G.DT, SEND_EVERY = 2, WATCH_MAX = 12;
const botName = (env) => env.BOT_NAME || 'PerdezhBaldezhBot';
const link = (env, id) => 'https://t.me/' + botName(env) + '?startapp=r_' + id;
const roomOk = (id) => typeof id === 'string' && /^[a-z0-9]{6,12}$/.test(id);
const newId = () => { const abc = 'abcdefghjkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(8)); let s = ''; for (let i = 0; i < 8; i++) s += abc[r[i] % abc.length]; return s; };
const cleanName = (u) => String(u.first_name || u.username || 'Игрок').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Игрок';

// who is asking: Telegram signs the data it hands to a Mini App with the bot's token.
// The test copy (GUEST = "1") also lets a plain browser in under a made-up name, so it can be tried without Telegram.
async function whoIs(init, env) {
  if (!init || typeof init !== 'string' || init.length > 4096) return null;
  if (env.GUEST === '1' && init.indexOf('guest:') === 0) { const m = /^guest:([a-z0-9]{6,16}):(.{0,40})$/.exec(init); return m ? { id: 'g' + m[1], name: cleanName({ first_name: decodeURIComponent(m[2]) || 'Гость' }) } : null; }
  if (!env.BOT_TOKEN) return null;
  const p = new URLSearchParams(init), hash = p.get('hash'); if (!hash) return null;
  const lines = []; for (const [k, v] of p) if (k !== 'hash') lines.push(k + '=' + v); lines.sort();
  const secret = await hmac('WebAppData', env.BOT_TOKEN), sign = hex(await hmac(secret, lines.join('\n')));
  if (!same(sign, hash)) return null;
  const at = parseInt(p.get('auth_date') || '0', 10); if (!(at > 0) || Date.now()/1000 - at > FRESH) return null;
  let u = null; try { u = JSON.parse(p.get('user') || 'null'); } catch (e) {}
  if (!u || !Number.isSafeInteger(u.id)) return null;
  return { id: String(u.id), name: cleanName(u) };
}
async function tg(env, method, body) { try { return await (await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch (e) { return null; } }

// ---- one room -------------------------------------------------------------
// People gather on the bank (up to four in the crew, the first one is the captain), the captain picks a river and
// casts off. On the water everyone works one jet. If somebody's phone drops out, a helmsman works their jet until
// they are back, so the rest are not left spinning.
export class Room {
  constructor(state, env) { this.env = env; this.crew = []; this.watch = new Set(); this.ph = 'bank'; this.lv = 0; this.S = null; this.seats = null; this.timer = null; this.t0 = 0; this.ev = []; this.empty = 0; this.last = null; }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch (e) {} }
  all(o) { const s = JSON.stringify(o); for (const m of this.crew) if (m.ws) try { m.ws.send(s); } catch (e) {} for (const ws of this.watch) try { ws.send(s); } catch (e) {} }
  captain() { return this.crew.find((m) => m.ws) || this.crew[0] || null; }
  seatOf(id) { return this.seats ? this.seats.findIndex((m) => m.id === id) : -1; }
  roomMsg(forId) { const cap = this.captain(), list = this.ph === 'bank' ? this.crew : this.seats || this.crew;
    return { t: 'room', sv: G.VERSION, ph: this.ph, lv: this.lv, cap: cap ? list.findIndex((m) => m.id === cap.id) : 0, you: list.findIndex((m) => m.id === forId), crew: list.map((m) => ({ n: m.name, on: !!m.ws })), wait: this.crew.filter((m) => list.indexOf(m) < 0).length + this.watch.size, last: this.last }; }
  tellRoom() { for (const m of this.crew) if (m.ws) this.send(m.ws, this.roomMsg(m.id)); for (const ws of this.watch) this.send(ws, this.roomMsg(ws.uid)); }
  startMsg(forId) { return { t: 'start', lv: this.lv, n: this.seats.length, seat: this.seatOf(forId), names: this.seats.map((m) => m.name), d: G.save(this.S) }; }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: false, err: 'ws' }, 400);
    const id = request.headers.get('X-Uid'), name = decodeURIComponent(request.headers.get('X-Name') || 'Игрок');
    const pair = new WebSocketPair(), ws = pair[1]; ws.accept(); ws.uid = id; ws.nm = name; ws.hb = Date.now();
    this.sweep(); let me = this.crew.find((m) => m.id === id);
    if (me) { if (me.ws && me.ws !== ws) { try { me.ws.close(4001, 'again'); } catch (e) {} } me.ws = ws; me.name = name; }
    else if (this.crew.length < G.MAXP) { me = { id, name, ws }; this.crew.push(me); }
    else if (this.watch.size < WATCH_MAX) this.watch.add(ws); else { this.send(ws, { t: 'full' }); try { ws.close(4002, 'full'); } catch (e) {} return new Response(null, { status: 101, webSocket: pair[0] }); }
    ws.addEventListener('message', (e) => { try { this.onMsg(ws, id, JSON.parse(e.data)); } catch (err) {} });
    const gone = () => this.onGone(ws, id); ws.addEventListener('close', gone); ws.addEventListener('error', gone);
    this.tellRoom(); if (this.ph !== 'bank' && this.S) this.send(ws, this.startMsg(id)); if (this.ph === 'done' && this.last) this.send(ws, Object.assign({ t: 'over', n: this.seats.length }, this.last));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  // a phone that has said nothing for a while is gone, even if its connection has not noticed yet
  sweep() { const now = Date.now(); for (const m of this.crew.slice()) if (m.ws && now - m.ws.hb > 6000) { const ws = m.ws; this.onGone(ws, m.id); try { ws.close(4003, 'quiet'); } catch (e) {} } for (const ws of Array.from(this.watch)) if (now - ws.hb > 6000) { this.watch.delete(ws); try { ws.close(4003, 'quiet'); } catch (e) {} } }
  onGone(ws, id) {
    this.watch.delete(ws); const me = this.crew.find((m) => m.id === id && m.ws === ws); if (!me) return;
    me.ws = null; if (this.ph === 'bank' || this.seatOf(id) < 0) this.crew = this.crew.filter((m) => m !== me);
    if (this.ph === 'bank') { const ws2 = this.watch.values().next().value; if (ws2 && this.crew.length < G.MAXP) { this.watch.delete(ws2); this.crew.push({ id: ws2.uid, name: ws2.nm || 'Игрок', ws: ws2 }); } }
    else { const k = this.seatOf(id); if (k >= 0 && this.S) G.input(this.S, k, null, false); }
    this.tellRoom();
  }
  onMsg(ws, id, m) {
    if (!m || typeof m.t !== 'string') return; ws.hb = Date.now();
    if (m.t === 'p') { if (this.ph !== 'run') this.sweep(); return this.send(ws, { t: 'q', c: m.c }); }
    const cap = this.captain(), isCap = !!cap && cap.id === id, k = this.seatOf(id);
    if (m.t === 'i') { if (this.ph === 'run' && k >= 0 && this.S) G.input(this.S, k, typeof m.a === 'number' ? m.a/100 : null, !!m.f); return; }
    if (!isCap) return;
    if (m.t === 'lv' && this.ph === 'bank') { this.lv = Math.max(0, Math.min(G.LEVELS.length - 1, m.lv | 0)); this.tellRoom(); }
    else if (m.t === 'go' && this.ph !== 'run') { if (Number.isInteger(m.lv)) this.lv = Math.max(0, Math.min(G.LEVELS.length - 1, m.lv)); this.begin(); }
    else if (m.t === 'again' && this.ph !== 'bank') this.begin();
    else if (m.t === 'bank' && this.ph !== 'bank') this.toBank();
  }
  begin() {
    this.crew = this.crew.filter((m) => m.ws); if (!this.crew.length) return;
    // whoever was only watching gets a seat now, if there is one
    for (const ws of Array.from(this.watch)) { if (this.crew.length >= G.MAXP) break; if (this.crew.some((m) => m.id === ws.uid)) continue; this.watch.delete(ws); this.crew.push({ id: ws.uid, name: ws.nm || 'Игрок', ws }); }
    this.seats = this.crew.slice(); this.S = G.newRun(this.lv, this.seats.length); this.ph = 'run'; this.ev = []; this.t0 = Date.now(); this.empty = 0;
    this.tellRoom(); for (const m of this.seats) if (m.ws) this.send(m.ws, this.startMsg(m.id)); for (const ws of this.watch) this.send(ws, this.startMsg(ws.uid));
    if (!this.timer) this.timer = setInterval(() => this.tick(), STEP_MS);
  }
  toBank() { this.ph = 'bank'; this.S = null; this.seats = null; this.crew = this.crew.filter((m) => m.ws); if (this.timer) { clearInterval(this.timer); this.timer = null; } this.tellRoom(); }
  tick() {
    const S = this.S; if (!S || this.ph !== 'run') return;
    const want = Math.min(S.tick + 5, Math.floor((Date.now() - this.t0)/STEP_MS));
    while (S.tick < want && S.ph !== 'done') {
      const lost = []; this.seats.forEach((m, k) => { if (!m.ws) lost.push(k); }); if (lost.length) G.pilot(S, lost);
      G.step(S); for (const e of S.ev) if (e.t !== 'go') this.ev.push(e);
      if (S.tick % SEND_EVERY === 0 || S.ph === 'done') { this.all({ t: 's', d: G.save(S), e: this.ev.length ? this.ev : undefined }); this.ev = []; }
    }
    if (S.ph === 'done') { this.ph = 'done'; this.last = { lv: this.lv, time: S.time, stars: S.stars, bumps: S.bumps, volleys: S.volleys, wipes: S.wipes, gold: G.goldCount(S) }; clearInterval(this.timer); this.timer = null; this.all(Object.assign({ t: 'over', n: this.seats.length }, this.last)); this.tellRoom(); return; }
    if (S.tick % 30 === 0) this.sweep();
    // nobody left on the raft for a while: tie it up
    if (this.seats.some((m) => m.ws)) this.empty = 0; else if (++this.empty > 30*20) this.toBank();
    // a river cannot take for ever
    if (S.tm > 600) this.toBank();
  }
}

// ---- the bot --------------------------------------------------------------
async function telegram(env, request) {
  if (!env.HOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.HOOK_SECRET) return new Response('no', { status: 403 });
  let up = null; try { up = await request.json(); } catch (e) { return new Response('ok'); }
  const m = up && up.message; if (!m || !m.chat || typeof m.text !== 'string') return new Response('ok');
  const cmd = m.text.trim().split(/[\s@]/)[0].toLowerCase();
  if (cmd === '/fart' || cmd === '/game' || cmd === '/play' || (cmd === '/start' && m.chat.type !== 'private')) {
    const id = newId(), who = m.from ? cleanName(m.from) : '';
    await tg(env, 'sendMessage', { chat_id: m.chat.id, text: '💨 ' + who + ' собирает экипаж на плот! Нужно от 2 до 4 человек — каждый пукает со своей стороны.', reply_markup: { inline_keyboard: [[{ text: '🛶 Запрыгнуть на плот', url: link(env, id) }]] } });
  } else if (cmd === '/start' || cmd === '/help') {
    await tg(env, 'sendMessage', { chat_id: m.chat.id, text: 'Один плот на всех, вместо мотора — вы сами. Пукнул левый — плот несёт вправо, пукнул правый — влево, вместе — прямо.\n\nС друзьями: добавь меня в группу и напиши /fart.', reply_markup: { inline_keyboard: [[{ text: '💨 Играть', url: 'https://t.me/' + botName(env) + '?startapp=home' }]] } });
  }
  return new Response('ok');
}
async function setup(env, origin) {
  const hook = await tg(env, 'setWebhook', { url: origin + '/tg', secret_token: env.HOOK_SECRET, allowed_updates: ['message'] });
  const cmds = await tg(env, 'setMyCommands', { commands: [{ command: 'fart', description: 'Собрать экипаж на плот' }, { command: 'help', description: 'Как играть' }] });
  return { webhook: !!(hook && hook.ok), commands: !!(cmds && cmds.ok) };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
      if (path === '/ws') {
        const room = url.searchParams.get('room'), me = await whoIs(url.searchParams.get('init'), env);
        if (!roomOk(room)) return json({ ok: false, err: 'room' }, 400); if (!me) return json({ ok: false, err: 'auth' }, 401);
        const h = new Headers(request.headers); h.set('X-Uid', me.id); h.set('X-Name', encodeURIComponent(me.name));
        return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(new Request(request.url, { headers: h }));
      }
      if (path === '/new' && request.method === 'POST') { let q = {}; try { q = await request.json(); } catch (e) {} const me = await whoIs(q && q.init, env); if (!me) return json({ ok: false, err: 'auth' }, 401); const id = newId(); return json({ ok: true, id, link: link(env, id) }); }
      if (path === '/share' && request.method === 'POST') { let q = {}; try { q = await request.json(); } catch (e) {} const me = await whoIs(q && q.init, env), room = String((q && q.room) || ''); if (!me) return json({ ok: false, err: 'auth' }, 401); if (!roomOk(room)) return json({ ok: false, err: 'room' }, 400); if (!env.BOT_TOKEN || !/^\d+$/.test(me.id)) return json({ ok: false, err: 'tg' }, 400);
        const r = await tg(env, 'savePreparedInlineMessage', { user_id: Number(me.id), allow_user_chats: true, allow_group_chats: true, result: { type: 'article', id: 'r' + room, title: 'Пердёж-балдёж', description: 'Приглашение на плот', input_message_content: { message_text: '💨 ' + me.name + ' зовёт на плот! Нужен экипаж — каждый пукает со своей стороны 👇' }, reply_markup: { inline_keyboard: [[{ text: '🛶 Запрыгнуть на плот', url: link(env, room) }]] } } });
        return r && r.ok ? json({ ok: true, id: r.result.id }) : json({ ok: false, err: (r && r.description) || 'tg' }, 502); }
      if (path === '/tg' && request.method === 'POST') return await telegram(env, request);
      if (path === '/setup') { if (!env.HOOK_SECRET || url.searchParams.get('key') !== env.HOOK_SECRET) return json({ ok: false, err: 'key' }, 403); return json(Object.assign({ ok: true }, await setup(env, url.origin))); }
      if (path === '/health') return json({ ok: true, name: 'Perdezh-Baldezh', v: G.VERSION, rooms: !!env.ROOMS, token: !!env.BOT_TOKEN, key: !!env.HOOK_SECRET, guest: env.GUEST === '1' });
      return json({ ok: false, err: 'path' }, 404);
    } catch (e) { return json({ ok: false, err: 'server', msg: String(e && e.message || e).slice(0, 200) }, 500); }
  },
};
