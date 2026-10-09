// ===== Multiplayer: peer-to-peer (PeerJS / WebRTC), like Drift Kings =====
// No game server needed: works straight from GitHub Pages. Best when everyone is on the same Wi-Fi.
// PeerJS's free public server only introduces players; the host's browser relays the race.
// If Supabase is set up (js/config.js), open rooms also show in the Open rooms list (just a list, no game traffic).
const PREFIX = 'minidrifters-v1-';
const NET = { on: false, host: false, peer: null, conns: new Map(), hc: null, code: '', myId: '', players: new Map(), handlers: {}, inRace: false, rate: 50, public: true };
function netOn(ev, fn) { NET.handlers[ev] = fn; }
function emit(ev, d) { const f = NET.handlers[ev]; if (f) f(d); }
function netMode() { return srvOn() ? 'server' : typeof Peer !== 'undefined' ? 'p2p' : 'none'; }
function netAvailable() { return netMode() !== 'none'; }
function netNeedText() { return 'Multiplayer needs internet to load (PeerJS could not load). Check your connection and reload.'; }
function sbListOn() { return typeof CLOUD !== 'undefined' && CLOUD && typeof supabase !== 'undefined'; }
function listOn() { return srvOn() || sbListOn(); }
function randCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
function meInfo(me) { return Object.assign({ name: me.name }, carLook(me)); }

function netHost(me, cb) {
  NET.code = randCode(); NET.host = true; NET.myId = 'host';
  const peer = mkPeer(PREFIX + NET.code); NET.peer = peer; let opened = false;
  peer.on('open', () => { opened = true; NET.on = true; NET.players.clear(); NET.conns.clear(); NET.players.set('host', Object.assign({ id: 'host' }, meInfo(me))); cb(null); });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); netHost(me, cb); } else if (!opened) cb(e); else if (e.type !== 'peer-unavailable') emit('neterror', e); });
  peer.on('disconnected', () => { try { if (NET.on && NET.peer === peer) peer.reconnect(); } catch (e) { } });
  peer.on('connection', c => {
    c.on('data', d => hostData(c, d));
    c.on('close', () => { if (!NET.host || NET.peer !== peer) return; NET.conns.delete(c.peer); if (NET.players.delete(c.peer)) { emit('left', c.peer); if (typeof G === 'undefined' || G.state === 'lobby' || G.state === 'menu') netLobby(); else netSend({ t: 'gone', id: c.peer }); } });
  });
}
function netJoin(code, me, cb) {
  NET.host = false; NET.code = code.toUpperCase().trim(); let done = false;
  const finish = e => { if (!done) { done = true; cb(e); } };
  const peer = mkPeer(); NET.peer = peer;
  peer.on('open', id => {
    NET.myId = id; const c = peer.connect(PREFIX + NET.code, { reliable: true, serialization: 'json' }); NET.hc = c;
    const to = setTimeout(() => finish({ type: 'timeout' }), 12000);
    c.on('open', () => { clearTimeout(to); c.send(Object.assign({ t: 'hello' }, meInfo(me))); NET.on = true; finish(null); });
    c.on('data', d => { if (NET.hc === c) emit(d.t, d); });
    c.on('close', () => { if (NET.hc !== c) return; if (NET.on) emit('hostgone'); NET.on = false; });
  });
  peer.on('error', e => { if (!done) finish(e); else if (e.type !== 'peer-unavailable') emit('neterror', e); });
}
function hostData(c, d) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'hello') {
    if (NET.inRace) { c.send({ t: 'busy', msg: 'A race is in progress. Try again when it finishes.' }); setTimeout(() => c.close(), 500); return; }
    NET.conns.set(c.peer, c); NET.players.set(c.peer, Object.assign({ id: c.peer, name: String(d.name || 'Driver').slice(0, 14) }, carLook(d)));
    c.send({ t: 'welcome', id: c.peer }); emit('joined', c.peer); netLobby();
  } else if (!NET.players.has(c.peer)) return;
  else if (d.t === 'st') { const p = NET.players.get(c.peer); p.s = d.s; emit('st', { id: c.peer, s: d.s }); }
  else if (d.t === 'fin') { emit('fin', { id: c.peer, time: d.time, score: d.score, laps: d.laps, rid: d.rid }); }
  else if (d.t === 'info') { const p = NET.players.get(c.peer); p.name = String(d.name || p.name).slice(0, 14); netLobby(); }
}
function netSend(m) { if (!NET.on) return; if (NET.host && NET.peer && NET.peer.bcast) { NET.peer.bcast(m); return; } if (NET.host) { for (const c of NET.conns.values()) if (c.open) try { c.send(m); } catch (e) { } } else if (NET.hc && NET.hc.open) NET.hc.send(m); }
function netLobby() { if (!NET.host) return; const m = { t: 'lobby', players: [...NET.players.values()].map(p => Object.assign({ id: p.id, name: p.name }, carLook(p))), cfg: emitCfg() }; netSend(m); emit('lobby', m); rtListServer(); }
let emitCfg = () => ({});

// ---------- Open rooms list (only with Supabase set up) ----------
let SBC = null, SRV = null, SRVREADY = null, SRVCB = null;
function sbc() { if (!SBC) SBC = supabase.createClient(ONLINE.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), ONLINE.SUPABASE_ANON_KEY.trim(), { auth: { persistSession: false, autoRefreshToken: false } }); return SBC; }
function srvChannel() {
  if (!SRV) { SRV = sbc().channel('md-rooms', { config: { presence: { key: 'w' + Math.random().toString(36).slice(2, 10) } } }); SRV.on('presence', { event: 'sync' }, () => SRVCB && SRVCB(srvList())); SRVREADY = new Promise(res => SRV.subscribe(st => { if (st === 'SUBSCRIBED') res(); })); }
  return SRVREADY;
}
function srvList() { const st = SRV ? SRV.presenceState() : {}, out = []; for (const k in st) for (const p of st[k]) if (p.code && p.code !== NET.code) out.push(p); return out.sort((a, b) => (a.inRace - b.inRace) || (b.players - a.players)); }
function serversWatch(cb) { SRVCB = cb; if (srvOn()) return srvPoll(true); if (!listOn()) return cb(null); try { srvChannel().then(() => cb(srvList())); } catch (e) { cb(null); } }
async function rtListServer() {
  if (!listOn() || !NET.host || !NET.on) return; if (srvOn()) { if (NET.peer && NET.peer.meta) { const c = emitCfg(); NET.peer.meta({ host: (NET.players.get('host') || {}).name || 'Host', track: c.track, mode: c.mode, laps: c.laps, inRace: NET.inRace ? 1 : 0 }, NET.public); } return; } try { await srvChannel(); if (!NET.on || !NET.host) return;
    if (!NET.public) { SRV.untrack(); return; }
    const c = emitCfg(); SRV.track({ code: NET.code, host: (NET.players.get('host') || {}).name || 'Host', track: c.track, mode: c.mode, laps: c.laps, players: NET.players.size, inRace: NET.inRace ? 1 : 0 }); } catch (e) { }
}
function netLeave() {
  const wasHost = NET.host; NET.on = false;
  try { if (NET.peer) NET.peer.destroy(); } catch (e) { }
  try { if (wasHost && SRV) SRV.untrack(); } catch (e) { }
  NET.peer = null; NET.hc = null; NET.host = false; NET.conns.clear(); NET.players.clear(); NET.inRace = false; NET.code = '';
}
function netErrText(e) {
  const t = e && e.type; if (t === 'server') return 'Could not reach the game server. Check your internet, or the server may be down.'; if (t === 'server-lost') return 'Lost connection to the game server.';
  return t === 'peer-unavailable' ? 'Room not found. Check the code, or the host may have left.' : t === 'timeout' ? 'Could not connect (timed out). Make sure you are on the same Wi-Fi as the host. Some school or work Wi-Fi blocks peer-to-peer: try a phone hotspot.' : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Could not reach the matchmaking server. Check your internet.' : t === 'browser-incompatible' ? 'Your browser does not support WebRTC.' : 'Connection error: ' + (t || e);
}

// ===== Game server (WebSocket relay) =====
// If a game server is set (dev dashboard -> Settings, or js/config.js GAME_SERVER), multiplayer goes through it instead
// of peer-to-peer. WsPeer copies the bits of the PeerJS API the game uses, so the race code is the same either way.
function srvUrl() {
  let u = ''; try { u = new URLSearchParams(location.search).get('server') || localStorage.getItem('md_server') || ''; } catch (e) { }
  if (!u && typeof ONLINE !== 'undefined' && ONLINE.GAME_SERVER) u = ONLINE.GAME_SERVER;
  u = String(u || '').trim().replace(/\/+$/, ''); if (!u || u === 'off') return '';
  if (/^https:/i.test(u)) u = 'wss:' + u.slice(6); else if (/^http:/i.test(u)) u = 'ws:' + u.slice(5); else if (!/^wss?:/i.test(u)) u = 'wss://' + u;
  return u;
}
function srvHttp() { return srvUrl().replace(/^ws/i, 'http'); }
function srvOn() { return !!srvUrl() && typeof WebSocket !== 'undefined'; }
function mkPeer(id) { return srvOn() ? new WsPeer(id) : (id ? new Peer(id) : new Peer()); }
class Emitter { constructor() { this._h = {}; } on(e, f) { (this._h[e] = this._h[e] || []).push(f); return this; } emit(e, ...a) { for (const f of this._h[e] || []) try { f(...a); } catch (x) { reportErr && reportErr(x); } } }
class WsConn extends Emitter {
  constructor(owner, peerId, toHost) { super(); this.owner = owner; this.peer = peerId; this.toHost = toHost; this.open = false; }
  send(d) { if (!this.open) return; this.owner.raw(this.toHost ? { op: 'up', d } : { op: 'to', id: this.peer, d }); }
  close() { if (!this.open) return; this.open = false; if (this.toHost) this.owner.raw({ op: 'leave' }); else this.owner.raw({ op: 'kick', id: this.peer }); this.emit('close'); }
}
class WsPeer extends Emitter {
  constructor(wantId) {
    super(); this.want = wantId ? String(wantId).slice(PREFIX.length) : ''; this.conns = new Map(); this.hc = null; this.dead = false; this.ready = false;
    const ui = this.want ? 'hostMsg' : 'joinMsg';
    this.wakeT = setTimeout(() => { if (!this.ready && !this.dead && typeof msg === 'function') msg(ui, 'Waking the game server up... free servers sleep when nobody is playing, so this can take up to a minute.'); }, 1800);
    this.start();
  }
  async start() {
    // a quick HTTP request first wakes sleeping free servers (Render etc.) before the WebSocket tries to connect
    try { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 75000); await fetch(srvHttp() + '/health', { signal: ac.signal, cache: 'no-store' }); clearTimeout(t); } catch (e) { }
    if (this.dead) return;
    let ws; try { ws = new WebSocket(srvUrl()); } catch (e) { return this.fail('server'); }
    this.ws = ws; const to = setTimeout(() => { if (!this.ready) { try { ws.close(); } catch (e) { } this.fail('server'); } }, 20000);
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMsg(m, to); };
    ws.onclose = () => { clearTimeout(to); if (this.dead) return; if (!this.ready) return this.fail('server'); this.dead = true;
      if (this.hc) { const c = this.hc; this.hc = null; c.open = false; c.emit('close'); } else this.emit('error', { type: 'server-lost' }); };
    ws.onerror = () => { };
    this.pingT = setInterval(() => this.raw({ op: 'ping', t: Date.now() }), 15000);
  }
  fail(type) { if (this.dead) return; this.dead = true; clearTimeout(this.wakeT); this.emit('error', { type }); }
  raw(m) { const ws = this.ws; if (ws && ws.readyState === 1) try { ws.send(JSON.stringify(m)); } catch (e) { } }
  onMsg(m, to) {
    if (m.op === 'id') { this.id = m.id; if (this.want) this.raw({ op: 'host', code: this.want, public: NET.public !== false }); else { this.ready = true; clearTimeout(to); clearTimeout(this.wakeT); this.emit('open', m.id); } }
    else if (m.op === 'hosted') { this.ready = true; clearTimeout(to); clearTimeout(this.wakeT); this.emit('open', PREFIX + m.code); }
    else if (m.op === 'err') { clearTimeout(to); if (m.type === 'unavailable-id') { this.ready = true; } this.emit('error', { type: m.type }); }
    else if (m.op === 'conn') { const c = new WsConn(this, m.id, false); c.open = true; this.conns.set(m.id, c); this.emit('connection', c); }
    else if (m.op === 'from') { const c = this.conns.get(m.id); if (c) c.emit('data', m.d); }
    else if (m.op === 'close') { const c = this.conns.get(m.id); if (c) { this.conns.delete(m.id); c.open = false; c.emit('close'); } }
    else if (m.op === 'joined') { if (this.hc) { this.hc.open = true; this.hc.emit('open'); } }
    else if (m.op === 'd') { if (this.hc) this.hc.emit('data', m.d); }
    else if (m.op === 'hostgone' || m.op === 'closed') { if (this.hc) { const c = this.hc; this.hc = null; c.open = false; c.emit('close'); } }
  }
  connect(peerId) { const c = new WsConn(this, peerId, true); this.hc = c; this.raw({ op: 'join', code: String(peerId).slice(PREFIX.length) }); return c; }
  bcast(d) { this.raw({ op: 'all', d }); }
  meta(meta, pub) { this.raw({ op: 'meta', meta, public: pub !== false }); }
  reconnect() { }
  destroy() { this.dead = true; clearTimeout(this.wakeT); clearInterval(this.pingT); try { this.raw({ op: 'leave' }); this.ws && this.ws.close(); } catch (e) { } }
}
// Open rooms list from the game server (polled while the Multiplayer tab is open)
let SRVPOLL = null;
async function srvPoll(now) {
  if (now) { clearInterval(SRVPOLL); SRVPOLL = setInterval(() => srvPoll(), 3000); }
  const tab = document.getElementById('tab-mp'); if (!now && (document.hidden || (tab && tab.classList.contains('hidden')) || (typeof G !== 'undefined' && G.state !== 'menu' && G.state !== 'lobby'))) return;
  try { const ac = new AbortController(), t = setTimeout(() => ac.abort(), now ? 75000 : 8000); const r = await fetch(srvHttp() + '/rooms', { signal: ac.signal, cache: 'no-store' }); clearTimeout(t);
    const list = (await r.json()).filter(p => p && p.code && p.code !== NET.code); if (SRVCB) SRVCB(list); } catch (e) { if (now && SRVCB) SRVCB(null); }
}
