// ===== Menus, lobby, input, network wiring =====
emitCfg = () => ({ track: CFG.track, laps: CFG.laps, mode: CFG.mode });
const MODES = { race: 'Race (fastest)', drift: 'Drift battle' };
function msg(id, t) { $(id).textContent = t || ''; }
function refreshMenu() {
  $('nameIn').value = CFG.name;
  document.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c === CFG.color));
  document.querySelectorAll('.tk').forEach(s => s.classList.toggle('on', +s.dataset.t === CFG.track));
  document.querySelectorAll('[data-mode]').forEach(s => s.classList.toggle('on', s.dataset.mode === CFG.mode));
  document.querySelectorAll('[data-l]').forEach(s => s.classList.toggle('on', +s.dataset.l === CFG.laps));
  const r = rec(CFG.track); $('records').textContent = `Your records on ${TRACKS[CFG.track].name}: best lap ${fmt(r.lap)} • best drift score ${(r.score || 0).toLocaleString()}`;
}
function buildMenu() {
  COLORS.forEach(c => { const s = document.createElement('div'); s.className = 'sw'; s.style.background = c; s.dataset.c = c; s.onclick = () => { CFG.color = c; saveCfg(); refreshMenu(); }; $('colors').appendChild(s); });
  TRACKS.forEach((t, i) => { const d = document.createElement('div'); d.className = 'tk'; d.dataset.t = i; const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'), tr = buildTrack(i, true), s = Math.min(180 / WORLD_W, 100 / WORLD_H);
    g.fillStyle = t.th.grass; g.fillRect(0, 0, 200, 120); g.translate(10, 10); g.scale(s, s); g.lineJoin = 'round'; pathTrack(g, tr); g.strokeStyle = t.th.night ? '#ff2fb0' : '#d8262f'; g.lineWidth = tr.w + 80; g.stroke(); g.strokeStyle = t.th.road; g.lineWidth = tr.w + 20; g.stroke();
    d.appendChild(c); d.appendChild(document.createTextNode(t.name)); d.onclick = () => { CFG.track = i; saveCfg(); refreshMenu(); }; $('tracks').appendChild(d); });
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { CFG.mode = b.dataset.mode; saveCfg(); refreshMenu(); });
  document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { CFG.laps = +b.dataset.l; saveCfg(); refreshMenu(); });
  $('nameIn').oninput = () => { CFG.name = $('nameIn').value.trim().slice(0, 14) || 'Driver'; saveCfg(); };
  $('bSolo').onclick = () => { msg('menuMsg'); G.plist = []; startSession(emitCfg(), null, false); };
  $('bHost').onclick = () => {
    if (!netAvailable()) return msg('menuMsg', 'Online play needs internet: the multiplayer library could not load.');
    msg('menuMsg', 'Creating room…'); $('bHost').disabled = true;
    netHost(CFG, e => { $('bHost').disabled = false; if (e) { netLeave(); return msg('menuMsg', netErrText(e)); } msg('menuMsg'); G.mp = true; G.state = 'lobby'; netLobby(); });
  };
  $('bJoin').onclick = () => {
    const code = $('codeIn').value.trim().toUpperCase(); if (code.length !== 5) return msg('menuMsg', 'Enter the 5-letter room code from your friend.');
    if (!netAvailable()) return msg('menuMsg', 'Online play needs internet: the multiplayer library could not load.');
    msg('menuMsg', 'Connecting to room ' + code + '…'); $('bJoin').disabled = true;
    netJoin(code, CFG, e => { $('bJoin').disabled = false; if (e) { netLeave(); return msg('menuMsg', netErrText(e)); } msg('menuMsg'); G.mp = true; G.state = 'lobby'; showLobby({ players: [], cfg: {} }); msg('lobbyMsg', 'Connected! Waiting for the host…'); });
  };
  $('bStart').onclick = () => { if (!NET.host) return; const grid = [...NET.players.keys()], cfg = emitCfg(); NET.inRace = true; G.plist = [...NET.players.values()]; netSend({ t: 'start', cfg, grid }); startSession(cfg, grid, true); };
  $('bLeave').onclick = toMenu;
  refreshMenu();
}
function showLobby(d) {
  if (d.players.length) G.plist = d.players; G.state = 'lobby';
  for (const s of ['hud', 'speedo', 'mini', 'board', 'driftBox', 'menu']) $(s).classList.add('hidden'); $('lobby').classList.remove('hidden'); banner('');
  $('roomCode').textContent = NET.code;
  $('plist').innerHTML = G.plist.map(p => `<li><i style="background:${p.color}"></i>${esc(p.name)}${p.id === 'host' ? ' 👑' : ''}${p.id === NET.myId ? ' (you)' : ''}</li>`).join('');
  const c = d.cfg && d.cfg.track !== undefined ? d.cfg : emitCfg();
  if (NET.host) {
    $('lobbyCfg').innerHTML = `<div class="row"><button class="opt" id="lcT">🗺 ${TRACKS[c.track].name} ▸</button><button class="opt" id="lcL">🔁 ${c.laps ? c.laps + ' laps' : 'Free roam'} ▸</button><button class="opt" id="lcM">${c.mode === 'drift' ? '💨' : '🏁'} ${MODES[c.mode]} ▸</button></div>`;
    $('lcT').onclick = () => { CFG.track = (CFG.track + 1) % TRACKS.length; saveCfg(); netLobby(); };
    $('lcL').onclick = () => { CFG.laps = { 1: 3, 3: 5, 5: 0, 0: 1 }[CFG.laps]; saveCfg(); netLobby(); };
    $('lcM').onclick = () => { CFG.mode = CFG.mode === 'race' ? 'drift' : 'race'; saveCfg(); netLobby(); };
    $('bStart').classList.remove('hidden'); $('bStart').textContent = G.plist.length > 1 ? `Start race (${G.plist.length} drivers)` : 'Start (waiting for friends…)';
    msg('lobbyMsg', G.plist.length > 1 ? '' : 'Share the code above. You can also start alone to test.');
    $('lobbyHint').innerHTML = 'Send this code to your friends. They open the game and press <b>Join friend</b>.';
  } else {
    $('lobbyCfg').textContent = c.track !== undefined ? `Track: ${TRACKS[c.track].name} • ${c.laps ? c.laps + ' laps' : 'Free roam'} • ${MODES[c.mode]}` : '';
    $('bStart').classList.add('hidden'); $('lobbyHint').textContent = 'You are in the room. The host starts the race.'; if (G.plist.length) msg('lobbyMsg', 'Waiting for the host to start…');
    if (c.track !== undefined && G.attract && G.attract.idx !== c.track) CFG.track = c.track;
  }
}
function addChat(m) { const d = document.createElement('div'); d.innerHTML = `<b>${esc(m.name)}:</b> ${esc(m.msg)}`; $('chatlog').appendChild(d); while ($('chatlog').children.length > 6) $('chatlog').firstChild.remove(); setTimeout(() => d.remove(), 8000); }
netOn('lobby', showLobby);
netOn('start', d => startSession(d.cfg, d.grid, true));
netOn('all', d => { if (G.state !== 'race' && G.state !== 'countdown') return; for (const row of d.list) if (row[0] !== NET.myId) applyState(row[0], row.slice(1)); });
netOn('st', d => { if (G.state === 'race' || G.state === 'countdown') applyState(d.id, d.s); });
netOn('fin', d => { if (G.state === 'race') hostFin(d.id, d.time, d.score); });
netOn('res', d => { if (!NET.host && G.me) applyRes(d.list, d.final); });
netOn('hostgone', () => { toMenu(); msg('menuMsg', 'The host left, so the room has closed.'); });
netOn('busy', d => { toMenu(); msg('menuMsg', d.msg); });
netOn('neterror', e => msg(G.state === 'lobby' ? 'lobbyMsg' : 'menuMsg', netErrText(e)));
netOn('left', id => { const r = G.rem.get(id); if (r && G.state !== 'lobby') { pop(r.car.name + ' left', '#aaa'); G.rem.delete(id); if (G.firstFin) hostRes(false); } });
netOn('chat', addChat);
netOn('joined', () => { });
function handleEsc() {
  if (G.state === 'race' || G.state === 'countdown') { if (!G.mp) toMenu(); else if (NET.host) { if (confirm('End the race for everyone and go back to the lobby?')) hostToLobby(); } else if (confirm('Leave the room?')) toMenu(); }
  else if (G.state === 'lobby') toMenu();
}
addEventListener('keydown', e => {
  sndInit();
  if (document.activeElement === $('chatIn')) { if (e.key === 'Enter') { const t = $('chatIn').value.trim(); if (t) { if (NET.host) { const m = { t: 'chat', name: CFG.name, msg: t }; netSend(m); addChat(m); } else netSend({ t: 'chat', msg: t }); } $('chatIn').value = ''; $('chatIn').classList.add('hidden'); $('chatIn').blur(); } else if (e.key === 'Escape') { $('chatIn').classList.add('hidden'); $('chatIn').blur(); } return; }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); KEYS[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (G.state === 'race' && G.me) {
    if (k === 'r' && !e.repeat) resetCar(G.me);
    if (k === 't' && G.mp) { e.preventDefault(); $('chatIn').classList.remove('hidden'); $('chatIn').focus(); }
  }
  if (k === 'c' && !e.repeat) { G.rot = !G.rot; pop(G.rot ? 'Chase camera' : 'Top-down camera'); }
  if (k === 'm' && !e.repeat) pop(sndMute() ? 'Sound off' : 'Sound on');
  if (k === 'escape') handleEsc();
});
addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
buildMenu(); requestAnimationFrame(tick);
