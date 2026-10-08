// ===== Multiplayer =====
// With Supabase configured (js/config.js), rooms run through Supabase Realtime servers: works across any
// network (home wifi, 4G, school, different countries) and rooms appear in a public server list.
// Without Supabase it falls back to PeerJS peer-to-peer (best on the same network).
const PREFIX = 'minidrifters-v1-';
const NET = { on: false, host: false, peer: null, conns: new Map(), hc: null, code: '', myId: '', players: new Map(), handlers: {}, inRace: false, rt: false, ch: null, rate: 66, public: true, syncFn: null };
function netOn(ev, fn) { NET.handlers[ev] = fn; }
function emit(ev, d) { const f = NET.handlers[ev]; if (f) f(d); }
function useRT() { return typeof CLOUD !== 'undefined' && CLOUD && typeof supabase !== 'undefined'; }
function netMode() { return useRT() ? 'servers' : typeof Peer !== 'undefined' ? 'p2p' : 'none'; }
function netAvailable() { return netMode() !== 'none'; }
function randCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
function netHost(me, cb) { return useRT() ? rtHost(me, cb) : p2pHost(me, cb); }
function netJoin(code, me, cb) { return useRT() ? rtJoin(code, me, cb) : p2pJoin(code, me, cb); }
function meInfo(me) { return { name: me.name, color: me.color, body: me.body, livery: me.livery }; }

// ---------- Supabase Realtime (servers) ----------
let SBC = null;
function sbc() { if (!SBC) SBC = supabase.createClient(ONLINE.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), ONLINE.SUPABASE_ANON_KEY.trim(), { auth: { persistSession: false, autoRefreshToken: false }, realtime: { params: { eventsPerSecond: 40 } } }); return SBC; }
function rtRoom(code, cb) {
  let once = false; const done = e => { if (!once) { once = true; cb(e); } };
  const ch = sbc().channel('md-room-' + code, { config: { broadcast: { self: false }, presence: { key: NET.myId } } }); NET.ch = ch;
  ch.on('broadcast', { event: 'm' }, ({ payload: p }) => { if (!p || p.from === NET.myId || (p.to && p.to !== NET.myId)) return; rtRecv(p.from, p.d); });
  ch.on('presence', { event: 'leave' }, ({ key }) => { const st = ch.presenceState(); if (!st[key]) rtLeft(key); });
  ch.on('presence', { event: 'sync' }, () => { if (NET.syncFn) NET.syncFn(); });
  ch.subscribe((st, err) => { if (st === 'SUBSCRIBED') done(null); else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') done({ type: 'rt', msg: (err && err.message) || st }); });
}
function rtSend(to, d) { if (NET.ch) NET.ch.send({ type: 'broadcast', event: 'm', payload: { from: NET.myId, to, d } }); }
function rtConn(id) { return { peer: id, open: true, send: m => rtSend(id, m), close() { } }; }
function rtRecv(from, d) { if (NET.host) hostData(NET.conns.get(from) || rtConn(from), d); else if (from === 'host') emit(d.t, d); }
function rtLeft(key) {
  if (NET.host) { if (NET.players.has(key) && key !== 'host') { NET.players.delete(key); NET.conns.delete(key); emit('left', key); netLobby(); } }
  else if (key === 'host' && NET.on) { NET.on = false; emit('hostgone'); }
}
function rtHost(me, cb) {
  NET.code = randCode(); NET.host = true; NET.myId = 'host'; NET.rt = true; NET.rate = 100;
  rtRoom(NET.code, async e => {
    if (e) return cb(e);
    await NET.ch.track({ role: 'host' }); NET.on = true; NET.players.clear(); NET.players.set('host', Object.assign({ id: 'host' }, meInfo(me))); cb(null);
  });
}
function rtJoin(code, me, cb) {
  NET.host = false; NET.rt = true; NET.rate = 100; NET.code = code.toUpperCase().trim(); NET.myId = 'p' + Math.random().toString(36).slice(2, 10);
  let done = false; const fin = e => { if (!done) { done = true; clearTimeout(to); NET.syncFn = null; cb(e); } };
  const to = setTimeout(() => fin({ type: 'peer-unavailable' }), 9000);
  rtRoom(NET.code, async e => {
    if (e) return fin(e);
    NET.syncFn = () => { if (!done && NET.ch.presenceState().host) { NET.on = true; NET.hc = { open: true }; rtSend('host', Object.assign({ t: 'hello' }, meInfo(me))); fin(null); } };
    await NET.ch.track({ role: 'player' }); NET.syncFn && NET.syncFn();
  });
}
// ---------- public server list ----------
let SRV = null, SRVREADY = null, SRVCB = null;
function srvChannel() {
  if (!SRV) { SRV = sbc().channel('md-servers', { config: { presence: { key: 'w' + Math.random().toString(36).slice(2, 10) } } }); SRV.on('presence', { event: 'sync' }, () => SRVCB && SRVCB(srvList())); SRVREADY = new Promise(res => SRV.subscribe(st => { if (st === 'SUBSCRIBED') res(); })); }
  return SRVREADY;
}
function srvList() { const st = SRV ? SRV.presenceState() : {}, out = []; for (const k in st) for (const p of st[k]) if (p.code) out.push(p); return out.sort((a, b) => (a.inRace - b.inRace) || (b.players - a.players)); }
function serversWatch(cb) { SRVCB = cb; if (!useRT()) return cb(null); srvChannel().then(() => cb(srvList())); }
async function rtListServer() {
  if (!NET.rt || !NET.host || !NET.on) return; await srvChannel(); if (!NET.on) return;
  if (!NET.public) { SRV.untrack(); return; }
  const c = emitCfg(); SRV.track({ code: NET.code, host: (NET.players.get('host') || {}).name || 'Host', track: c.track, mode: c.mode, laps: c.laps, players: NET.players.size, inRace: NET.inRace ? 1 : 0 });
}

// ---------- PeerJS (peer-to-peer fallback) ----------
function p2pHost(me, cb) {
  NET.code = randCode(); NET.host = true; NET.myId = 'host'; NET.rt = false; NET.rate = 66;
  const peer = new Peer(PREFIX + NET.code); NET.peer = peer;
  peer.on('open', () => { NET.on = true; NET.players.clear(); NET.players.set('host', Object.assign({ id: 'host' }, meInfo(me))); cb(null); });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); p2pHost(me, cb); } else cb(e); });
  peer.on('connection', c => {
    c.on('data', d => hostData(c, d));
    c.on('close', () => { NET.conns.delete(c.peer); NET.players.delete(c.peer); emit('left', c.peer); netLobby(); });
  });
}
function p2pJoin(code, me, cb) {
  NET.host = false; NET.rt = false; NET.rate = 66; NET.code = code.toUpperCase().trim(); let done = false;
  const finish = e => { if (!done) { done = true; cb(e); } };
  const peer = new Peer(); NET.peer = peer;
  peer.on('open', id => {
    NET.myId = id; const c = peer.connect(PREFIX + NET.code, { reliable: true, serialization: 'json' }); NET.hc = c;
    const to = setTimeout(() => finish({ type: 'timeout' }), 12000);
    c.on('open', () => { clearTimeout(to); c.send(Object.assign({ t: 'hello' }, meInfo(me))); NET.on = true; finish(null); });
    c.on('data', d => emit(d.t, d));
    c.on('close', () => { if (NET.on) emit('hostgone'); NET.on = false; });
  });
  peer.on('error', e => { if (!done) finish(e); else if (e.type !== 'peer-unavailable') emit('neterror', e); });
}

// ---------- shared ----------
function hostData(c, d) {
  if (d.t === 'hello') {
    if (NET.inRace) { c.send({ t: 'busy', msg: 'A race is in progress. Try again when it finishes.' }); setTimeout(() => c.close(), 500); return; }
    if (NET.players.size >= 8 && !NET.players.has(c.peer)) { c.send({ t: 'busy', msg: 'Room is full (8 players).' }); setTimeout(() => c.close(), 500); return; }
    NET.conns.set(c.peer, c); NET.players.set(c.peer, { id: c.peer, name: String(d.name || 'Driver').slice(0, 14), color: d.color, body: String(d.body || ''), livery: String(d.livery || '') });
    c.send({ t: 'welcome', id: c.peer }); emit('joined', c.peer); netLobby();
  } else if (!NET.players.has(c.peer)) return;
  else if (d.t === 'st') { const p = NET.players.get(c.peer); p.s = d.s; emit('st', { id: c.peer, s: d.s }); }
  else if (d.t === 'fin') { emit('fin', { id: c.peer, time: d.time, score: d.score }); }
  else if (d.t === 'chat') { const p = NET.players.get(c.peer); const m = { t: 'chat', name: p.name, msg: String(d.msg).slice(0, 80) }; netSend(m); emit('chat', m); }
  else if (d.t === 'info') { const p = NET.players.get(c.peer); p.name = String(d.name || p.name).slice(0, 14); netLobby(); }
}
function netSend(m) {
  if (!NET.on) return;
  if (NET.rt) { rtSend(NET.host ? undefined : 'host', m); return; }
  if (NET.host) { for (const c of NET.conns.values()) if (c.open) c.send(m); } else if (NET.hc && NET.hc.open) NET.hc.send(m);
}
function netLobby() { if (!NET.host) return; const m = { t: 'lobby', players: [...NET.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color, body: p.body, livery: p.livery })), cfg: emitCfg() }; netSend(m); emit('lobby', m); rtListServer(); }
let emitCfg = () => ({});
function netLeave() {
  const wasHost = NET.host && NET.rt; NET.on = false; NET.syncFn = null;
  try { if (NET.peer) NET.peer.destroy(); } catch (e) { }
  try { if (NET.ch) sbc().removeChannel(NET.ch); } catch (e) { }
  try { if (wasHost && SRV) SRV.untrack(); } catch (e) { }
  NET.peer = null; NET.ch = null; NET.hc = null; NET.conns.clear(); NET.players.clear(); NET.inRace = false;
}
function netErrText(e) {
  const t = e && e.type;
  if (t === 'rt') return 'Could not open a room on the Supabase server (' + e.msg + '). Check Realtime is enabled and public channels are allowed.';
  return t === 'peer-unavailable' ? 'Room not found. Check the code, or the host may have left.' : t === 'timeout' ? 'Could not connect (timed out). The host may be behind a strict firewall. Add Supabase to use servers instead.' : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Could not reach the matchmaking server. Check your internet.' : t === 'browser-incompatible' ? 'Your browser does not support WebRTC.' : 'Connection error: ' + (t || e);
}
