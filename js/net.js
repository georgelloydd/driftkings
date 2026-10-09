// ===== Multiplayer: peer-to-peer (PeerJS / WebRTC), like Drift Kings =====
// No game server needed: works straight from GitHub Pages. Best when everyone is on the same Wi-Fi.
// PeerJS's free public server only introduces players; the host's browser relays the race.
// If Supabase is set up (js/config.js), open rooms also show in the Open rooms list (just a list, no game traffic).
const PREFIX = 'minidrifters-v1-';
const NET = { on: false, host: false, peer: null, conns: new Map(), hc: null, code: '', myId: '', players: new Map(), handlers: {}, inRace: false, rate: 50, public: true };
function netOn(ev, fn) { NET.handlers[ev] = fn; }
function emit(ev, d) { const f = NET.handlers[ev]; if (f) f(d); }
function netMode() { return typeof Peer !== 'undefined' ? 'p2p' : 'none'; }
function netAvailable() { return netMode() !== 'none'; }
function netNeedText() { return 'Multiplayer needs internet to load (PeerJS could not load). Check your connection and reload.'; }
function listOn() { return typeof CLOUD !== 'undefined' && CLOUD && typeof supabase !== 'undefined'; }
function randCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
function meInfo(me) { return Object.assign({ name: me.name }, carLook(me)); }

function netHost(me, cb) {
  NET.code = randCode(); NET.host = true; NET.myId = 'host';
  const peer = new Peer(PREFIX + NET.code); NET.peer = peer; let opened = false;
  peer.on('open', () => { opened = true; NET.on = true; NET.players.clear(); NET.conns.clear(); NET.players.set('host', Object.assign({ id: 'host' }, meInfo(me))); cb(null); });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); netHost(me, cb); } else if (!opened) cb(e); else if (e.type !== 'peer-unavailable') emit('neterror', e); });
  peer.on('disconnected', () => { try { if (NET.on && NET.peer === peer) peer.reconnect(); } catch (e) { } });
  peer.on('connection', c => {
    c.on('data', d => hostData(c, d));
    c.on('close', () => { if (!NET.host || NET.peer !== peer) return; NET.conns.delete(c.peer); if (NET.players.delete(c.peer)) { emit('left', c.peer); netLobby(); } });
  });
}
function netJoin(code, me, cb) {
  NET.host = false; NET.code = code.toUpperCase().trim(); let done = false;
  const finish = e => { if (!done) { done = true; cb(e); } };
  const peer = new Peer(); NET.peer = peer;
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
function netSend(m) { if (!NET.on) return; if (NET.host) { for (const c of NET.conns.values()) if (c.open) try { c.send(m); } catch (e) { } } else if (NET.hc && NET.hc.open) NET.hc.send(m); }
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
function serversWatch(cb) { SRVCB = cb; if (!listOn()) return cb(null); try { srvChannel().then(() => cb(srvList())); } catch (e) { cb(null); } }
async function rtListServer() {
  if (!listOn() || !NET.host || !NET.on) return; try { await srvChannel(); if (!NET.on || !NET.host) return;
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
  const t = e && e.type;
  return t === 'peer-unavailable' ? 'Room not found. Check the code, or the host may have left.' : t === 'timeout' ? 'Could not connect (timed out). Make sure you are on the same Wi-Fi as the host. Some school or work Wi-Fi blocks peer-to-peer: try a phone hotspot.' : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Could not reach the matchmaking server. Check your internet.' : t === 'browser-incompatible' ? 'Your browser does not support WebRTC.' : 'Connection error: ' + (t || e);
}
