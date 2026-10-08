// ===== Peer-to-peer multiplayer (PeerJS / WebRTC). Works on static hosting like GitHub Pages. =====
const PREFIX = 'driftkings-v1-';
const NET = { on: false, host: false, peer: null, conns: new Map(), hc: null, code: '', myId: '', players: new Map(), handlers: {}, inRace: false };
function netOn(ev, fn) { NET.handlers[ev] = fn; }
function emit(ev, d) { const f = NET.handlers[ev]; if (f) f(d); }
function netAvailable() { return typeof Peer !== 'undefined'; }
function randCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
function netHost(me, cb) {
  NET.code = randCode(); NET.host = true; NET.myId = 'host';
  const peer = new Peer(PREFIX + NET.code); NET.peer = peer;
  peer.on('open', () => { NET.on = true; NET.players.clear(); NET.players.set('host', { id: 'host', name: me.name, color: me.color }); cb(null); });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); netHost(me, cb); } else cb(e); });
  peer.on('connection', c => {
    c.on('data', d => hostData(c, d));
    c.on('close', () => { NET.conns.delete(c.peer); NET.players.delete(c.peer); emit('left', c.peer); netLobby(); });
  });
}
function hostData(c, d) {
  if (d.t === 'hello') {
    if (NET.inRace) { c.send({ t: 'busy', msg: 'A race is in progress. Try again when it finishes.' }); setTimeout(() => c.close(), 500); return; }
    if (NET.players.size >= 8) { c.send({ t: 'busy', msg: 'Room is full (8 players).' }); setTimeout(() => c.close(), 500); return; }
    NET.conns.set(c.peer, c); NET.players.set(c.peer, { id: c.peer, name: String(d.name || 'Driver').slice(0, 14), color: d.color });
    c.send({ t: 'welcome', id: c.peer }); emit('joined', c.peer); netLobby();
  } else if (d.t === 'st') { const p = NET.players.get(c.peer); if (p) { p.s = d.s; emit('st', { id: c.peer, s: d.s }); } }
  else if (d.t === 'fin') { emit('fin', { id: c.peer, time: d.time, score: d.score }); }
  else if (d.t === 'chat') { const p = NET.players.get(c.peer); const m = { t: 'chat', name: p ? p.name : '?', msg: String(d.msg).slice(0, 80) }; netSend(m); emit('chat', m); }
}
function netJoin(code, me, cb) {
  NET.host = false; NET.code = code.toUpperCase().trim(); let done = false;
  const finish = e => { if (!done) { done = true; cb(e); } };
  const peer = new Peer(); NET.peer = peer;
  peer.on('open', id => {
    NET.myId = id; const c = peer.connect(PREFIX + NET.code, { reliable: true, serialization: 'json' }); NET.hc = c;
    const to = setTimeout(() => finish({ type: 'timeout' }), 12000);
    c.on('open', () => { clearTimeout(to); c.send({ t: 'hello', name: me.name, color: me.color }); NET.on = true; finish(null); });
    c.on('data', d => emit(d.t, d));
    c.on('close', () => { if (NET.on) emit('hostgone'); NET.on = false; });
  });
  peer.on('error', e => { if (!done) finish(e); else if (e.type !== 'peer-unavailable') emit('neterror', e); });
}
function netSend(m) { if (!NET.on) return; if (NET.host) { for (const c of NET.conns.values()) if (c.open) c.send(m); } else if (NET.hc && NET.hc.open) NET.hc.send(m); }
function netLobby() { if (!NET.host) return; const m = { t: 'lobby', players: [...NET.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color })), cfg: emitCfg() }; netSend(m); emit('lobby', m); }
let emitCfg = () => ({});
function netLeave() { NET.on = false; try { if (NET.peer) NET.peer.destroy(); } catch (e) { } NET.peer = null; NET.hc = null; NET.conns.clear(); NET.players.clear(); NET.inRace = false; }
function netErrText(e) { const t = e && e.type; return t === 'peer-unavailable' ? 'Room not found. Check the code.' : t === 'timeout' ? 'Could not connect (timed out). The host may be behind a strict firewall.' : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Could not reach the matchmaking server. Check your internet.' : t === 'browser-incompatible' ? 'Your browser does not support WebRTC.' : 'Connection error: ' + (t || e); }
