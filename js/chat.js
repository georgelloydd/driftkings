// ===== Global chat: press T anywhere. Everyone online shares one Supabase Realtime channel. =====
const CHAT = { ch: null, log: [], online: 0, last: 0, open: false };
function chatInit() {
  if (CHAT.ch || !CLOUD || typeof supabase === 'undefined') return;
  try {
    const ch = sbc().channel('md-global-chat', { config: { broadcast: { self: false }, presence: { key: 'c' + Math.random().toString(36).slice(2, 10) } } });
    ch.on('broadcast', { event: 'msg' }, ({ payload }) => chatRecv(payload));
    ch.on('presence', { event: 'sync' }, chatSync);
    ch.subscribe(st => { if (st === 'SUBSCRIBED') { CHAT.subbed = true; chatTrack(); chatHint(); } });
    CHAT.ch = ch;
  } catch (e) { console.warn('[chat]', e); }
}
function chatTrack() { if (!CHAT.ch || !CHAT.subbed) return; CHAT.tracked = ACCT.pub; CHAT.ch.track({ pub: ACCT.pub || '', sid: SESS.id, at: SESS.at }); }
function chatSync() {
  const metas = Object.values(CHAT.ch.presenceState()).flat(), pubs = new Set();
  for (const m of metas) {
    pubs.add(m.pub || m.sid);
    if (ACCT.pub && m.pub === ACCT.pub && m.sid !== SESS.id && (m.at > SESS.at || (m.at === SESS.at && m.sid > SESS.id))) sessKick('Your account just started playing in another tab or on another device. Only one game per account at a time.');
  }
  CHAT.online = pubs.size; chatHint();
}
function chatClean(p) {
  if (!p || typeof p.msg !== 'string' || typeof p.name !== 'string') return null;
  const msg = p.msg.replace(/\s+/g, ' ').trim().slice(0, 120); if (!msg) return null;
  return { name: p.name.trim().slice(0, 16) || 'Driver', msg, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888888', pid: String(p.pid || '').slice(0, 24), room: !!p.room, at: Date.now() };
}
function chatRecv(p) { const m = chatClean(p); if (m) chatLine(m); }
function chatPlace() { const menu = G.state === 'menu' || G.state === 'lobby'; $('chatlog').classList.toggle('menu', menu); $('chatIn').classList.toggle('menu', menu); }
function chatLine(m) {
  CHAT.log.push(m); if (CHAT.log.length > 60) CHAT.log.shift(); chatPlace();
  const d = document.createElement('div'); d.innerHTML = `${m.room ? '<em>ROOM</em> ' : ''}<b style="color:${m.color}">${esc(m.name)}:</b> ${esc(m.msg)}`;
  $('chatlog').appendChild(d); while ($('chatlog').children.length > 12) $('chatlog').firstChild.remove();
  setTimeout(() => d.classList.add('old'), 9000);
}
function chatHint() {
  const on = CLOUD && CHAT.ch; $('chatIn').placeholder = on ? `Global chat · ${CHAT.online || 1} online · Enter to send, Esc to close` : G.mp ? 'Room chat (Enter to send)' : 'Chat needs online mode (Supabase in js/config.js)';
  if ($('chatHint')) { $('chatHint').textContent = on ? `${CHAT.online || 1} online · T to chat` : ''; $('chatHint').classList.toggle('hidden', !on || !(G.state === 'menu' || G.state === 'lobby')); }
}
function chatOpen() {
  for (const k in KEYS) KEYS[k] = false; // don't leave the throttle stuck while typing
  chatInit(); chatHint(); chatPlace(); CHAT.open = true; $('chatlog').classList.add('open'); $('chatIn').classList.remove('hidden'); $('chatIn').focus();
}
function chatClose() { CHAT.open = false; $('chatlog').classList.remove('open'); $('chatIn').value = ''; $('chatIn').classList.add('hidden'); $('chatIn').blur(); }
function chatSend(t) {
  t = t.replace(/\s+/g, ' ').trim().slice(0, 120); if (!t) return;
  const now = Date.now(); if (now - CHAT.last < 900) { pop('Slow down a bit', '#ff9a2a'); return; } CHAT.last = now;
  if (CLOUD && CHAT.ch) { const m = { name: CFG.name, msg: t, color: CFG.color, pid: ACCT.pub }; CHAT.ch.send({ type: 'broadcast', event: 'msg', payload: m }); chatLine(chatClean(m)); }
  else if (G.mp) { if (NET.host) { const m = { t: 'chat', name: CFG.name, msg: t }; netSend(m); addChat(m); } else netSend({ t: 'chat', msg: t }); }
  else pop('Chat needs online mode', '#ff9a2a');
}
addEventListener('load', () => setTimeout(() => { chatInit(); chatHint(); }, 600));
setInterval(() => { if (CHAT.subbed && CHAT.tracked !== ACCT.pub) chatTrack(); if ($('chatHint')) chatHint(); }, 2000);
addEventListener('load', () => { if ($('chatHint')) $('chatHint').onclick = chatOpen; });
