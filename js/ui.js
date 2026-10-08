// ===== Menus, lobby, input, network wiring =====
emitCfg = () => ({ track: CFG.track, laps: CFG.laps, mode: CFG.mode });
const MODES = { race: 'Race (fastest)', drift: 'Drift battle', tt: 'Race (fastest)' };
function msg(id, t) { $(id).textContent = t || ''; }
function refreshMenu() {
  if (CFG.mode !== 'tt' && CFG.mode !== 'race' && CFG.mode !== 'drift') CFG.mode = 'tt';
  $('nameIn').value = CFG.name;
  document.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c === CFG.color));
  document.querySelectorAll('.tk').forEach(s => s.classList.toggle('on', +s.dataset.t === CFG.track));
  document.querySelectorAll('[data-mode]').forEach(s => s.classList.toggle('on', s.dataset.mode === CFG.mode));
  document.querySelectorAll('[data-l]').forEach(s => s.classList.toggle('on', +s.dataset.l === CFG.laps));
  document.querySelectorAll('.ty').forEach(s => { s.classList.toggle('on', s.dataset.b === CFG.body); drawCarPreview(s.querySelector('canvas'), s.dataset.b, CFG.color, CFG.livery, -0.35); });
  document.querySelectorAll('[data-lv]').forEach(s => s.classList.toggle('on', s.dataset.lv === CFG.livery));
  const tt = CFG.mode === 'tt';
  $('lapRow').classList.toggle('hidden', tt); $('ttHint').classList.toggle('hidden', !tt); $('joinRow').classList.toggle('hidden', tt); $('bHost').classList.toggle('hidden', tt);
  $('bSolo').textContent = tt ? '▶ Start time trial' : '▶ Play solo';
  const r = rec(CFG.track); $('records').textContent = `Your records on ${TRACKS[CFG.track].name}: best lap ${fmt(ACCT.bestLap(CFG.track) || r.lap)} • best drift score ${(r.score || 0).toLocaleString()}`;
  const t = carType(CFG.body); $('gDesc').textContent = t.name.toUpperCase() + ' · ' + t.desc;
  drawCarPreview($('gPrev'), CFG.body, CFG.color, CFG.livery, -0.5);
  $('chip').querySelector('i').style.background = CFG.color; $('chip').querySelector('b').textContent = CFG.name; $('chip').querySelector('small').textContent = ACCT.key.slice(0, 8) + '-····-····';
  refreshAcct();
}
let TAB = 'play', LBT = 0, LBTimer = 0, KEYSHOWN = false;
function setTab(t) {
  TAB = t; document.querySelectorAll('.nv').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  for (const x of ['play', 'garage', 'lb', 'acct']) $('tab-' + x).classList.toggle('hidden', x !== t);
  clearInterval(LBTimer); if (t === 'lb') { LBT = CFG.track; loadLB(); LBTimer = setInterval(() => { if (G.state === 'menu' && TAB === 'lb') loadLB(); }, 5000); }
  if (t === 'acct') refreshAcct();
}
async function loadLB() {
  document.querySelectorAll('[data-lbt]').forEach(b => b.classList.toggle('on', +b.dataset.lbt === LBT));
  const res = await LB.top(LBT);
  $('lbHead').innerHTML = res.live ? '<span class="live"></span> Live · global · fastest lap per driver' : (res.err ? '⚠ Leaderboard server unreachable · showing this device' : 'This device · fastest lap per account') + ` · ${TRACKS[LBT].name}`;
  const best = res.rows[0] ? res.rows[0].lap : 0;
  $('lbTable').innerHTML = '<tr><th>POS</th><th>DRIVER</th><th>CAR</th><th>BEST LAP</th><th>GAP</th><th>SET</th></tr>' + (res.rows.length ? res.rows.map((x, i) => `<tr class="${x.pid === ACCT.pub ? 'me' : ''}"><td class="pos">${i + 1}</td><td><i style="background:${esc(x.color || '#888')}"></i>${esc(x.name)}</td><td>${esc(carType(x.body).name)}</td><td>${fmt(x.lap)}</td><td>${i ? '+' + ((x.lap - best) / 1000).toFixed(2) : '—'}</td><td>${x.at ? new Date(x.at).toLocaleDateString() : ''}</td></tr>`).join('') : '<tr><td colspan="6" style="color:#8b8b93;padding:22px">No laps yet. Set one in Time trial.</td></tr>');
}
function refreshAcct() {
  if (!ACCT.key) return; $('keyOut').value = KEYSHOWN ? ACCT.key : ACCT.key.slice(0, 3) + '••••-••••-••••'; $('bReveal').textContent = KEYSHOWN ? 'Hide' : 'Show';
  $('keyHint').innerHTML = CLOUD ? 'This key is your login. Enter it on any device to get your profile back. Keep it secret.' : 'This key is your login on this device. To move to another device, copy your <b>backup code</b> and paste it there. Keep both secret.';
  $('onStatus').innerHTML = CLOUD ? (ONLINE_ERR ? '<b style="color:#ff6b6b">Error</b> · ' + esc(ONLINE_ERR) : 'Connected to ' + esc(ONLINE.SUPABASE_URL.replace(/^https?:\/\//, ''))) : 'Off · saving on this device only (no Supabase details in js/config.js).';
  const s = ACCT.stats, tb = TRACKS.map((t, i) => s.best[i] && s.best[i].lap ? `<div><small>${esc(t.name)}</small><b>${fmt(s.best[i].lap)}</b></div>` : '').join('');
  $('stats').innerHTML = `<div><small>SESSIONS</small><b>${s.sessions}</b></div><div><small>RACES</small><b>${s.races}</b></div><div><small>LAPS</small><b>${s.laps}</b></div><div><small>DRIFT POINTS</small><b>${Math.round(s.drift).toLocaleString()}</b></div><div><small>DISTANCE</small><b>${s.dist.toFixed(1)} km</b></div>` + tb;
}
function buildMenu() {
  document.querySelectorAll('.nv').forEach(b => b.onclick = () => setTab(b.dataset.tab)); $('chip').onclick = () => setTab('acct');
  COLORS.forEach(c => { const s = document.createElement('div'); s.className = 'sw'; s.style.background = c; s.dataset.c = c; s.onclick = () => { CFG.color = c; saveCfg(); refreshMenu(); }; $('colors').appendChild(s); });
  CAR_TYPES.forEach(t => { const d = document.createElement('div'); d.className = 'ty'; d.dataset.b = t.id; const c = document.createElement('canvas'); c.width = 120; c.height = 70; d.appendChild(c); d.appendChild(document.createTextNode(t.name)); d.onclick = () => { CFG.body = t.id; saveCfg(); refreshMenu(); }; $('types').appendChild(d); });
  LIVERIES.forEach(l => { const b = document.createElement('button'); b.className = 'opt'; b.dataset.lv = l.id; b.textContent = l.name; b.onclick = () => { CFG.livery = l.id; saveCfg(); refreshMenu(); }; $('livs').appendChild(b); });
  TRACKS.forEach((t, i) => { const d = document.createElement('div'); d.className = 'tk'; d.dataset.t = i; const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'), tr = buildTrack(i, true), s = Math.min(180 / WORLD_W, 100 / WORLD_H);
    g.fillStyle = '#0e0e10'; g.fillRect(0, 0, 200, 120); g.translate(10, 10); g.scale(s, s); g.lineJoin = 'round'; pathTrack(g, tr); g.strokeStyle = '#ff2a2a'; g.lineWidth = tr.w + 80; g.shadowColor = '#ff2a2a'; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#1c1c20'; g.lineWidth = tr.w + 10; g.stroke();
    const sp = document.createElement('span'); sp.textContent = t.name; d.appendChild(c); d.appendChild(sp); d.onclick = () => { CFG.track = i; saveCfg(); refreshMenu(); }; $('tracks').appendChild(d);
    const b = document.createElement('button'); b.className = 'opt'; b.dataset.lbt = i; b.textContent = t.name; b.onclick = () => { LBT = i; loadLB(); }; $('lbTracks').appendChild(b); });
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { CFG.mode = b.dataset.mode; saveCfg(); refreshMenu(); });
  document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { CFG.laps = +b.dataset.l; saveCfg(); refreshMenu(); });
  $('nameIn').oninput = () => { CFG.name = $('nameIn').value.trim().slice(0, 14) || 'Driver'; saveCfg(); $('chip').querySelector('b').textContent = CFG.name; };
  $('bTest').onclick = async () => { $('onStatus').textContent = 'Testing…'; const r = await testOnline(); $('onStatus').innerHTML = `<b style="color:${r.ok ? '#7dff9a' : '#ff6b6b'}">${r.ok ? 'Working' : 'Not working'}</b> · ${esc(r.msg)}`; };
  $('bReveal').onclick = () => { KEYSHOWN = !KEYSHOWN; refreshAcct(); };
  const copy = (t, ok) => { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => msg('acctMsg', ok), () => { prompt('Copy this:', t); }); };
  $('bCopyKey').onclick = () => copy(ACCT.key, 'Key copied. Keep it somewhere safe.');
  $('bBackup').onclick = () => copy(ACCT.backup(), 'Backup code copied. Paste it into Sign in on another device.');
  $('bSignIn').onclick = async () => { try { const m = await ACCT.restore($('keyIn').value); $('keyIn').value = ''; saveCfg(); refreshMenu(); msg('acctMsg', m); } catch (e) { msg('acctMsg', e.message); } };
  $('bNew').onclick = async () => { if (!confirm('Start a new account? Copy your current key or backup code first if you want to come back to it.')) return; await ACCT.create(); KEYSHOWN = true; refreshMenu(); msg('acctMsg', 'New account created. Copy your key now.'); };
  $('bSolo').onclick = () => { msg('menuMsg'); G.plist = []; startSession(emitCfg(), null, false); };
  $('bHost').onclick = () => {
    if (!netAvailable()) return msg('menuMsg', 'Online play needs internet: the multiplayer library could not load.');
    if (CFG.mode === 'tt') { CFG.mode = 'race'; saveCfg(); }
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
  $('plist').innerHTML = G.plist.map(p => `<li><i style="background:${p.color}"></i>${esc(p.name)} <span class="dim">· ${esc(carType(p.body).name)}</span>${p.id === 'host' ? ' 👑' : ''}${p.id === NET.myId ? ' (you)' : ''}</li>`).join('');
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
  if (G.tt && G.state === 'race') endTT(); else if (G.state === 'over') toMenu(); else if (G.state === 'race' || G.state === 'countdown') { if (!G.mp) toMenu(); else if (NET.host) { if (confirm('End the race for everyone and go back to the lobby?')) hostToLobby(); } else if (confirm('Leave the room?')) toMenu(); }
  else if (G.state === 'lobby') toMenu();
}
addEventListener('keydown', e => {
  sndInit();
  if (document.activeElement === $('chatIn')) { if (e.key === 'Enter') { const t = $('chatIn').value.trim(); if (t) { if (NET.host) { const m = { t: 'chat', name: CFG.name, msg: t }; netSend(m); addChat(m); } else netSend({ t: 'chat', msg: t }); } $('chatIn').value = ''; $('chatIn').classList.add('hidden'); $('chatIn').blur(); } else if (e.key === 'Escape') { $('chatIn').classList.add('hidden'); $('chatIn').blur(); } return; }
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(); KEYS[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  if (G.state === 'race' && G.me) {
    if (k === 'r' && !e.repeat) { if (G.tt) ttRestart(); else resetCar(G.me); }
    if (k === 'f' && !e.repeat) { if (G.tt) ttCheckpoint(); else resetCar(G.me); }
    if (k === 't' && G.mp) { e.preventDefault(); $('chatIn').classList.remove('hidden'); $('chatIn').focus(); }
  }
  if (k === 'c' && !e.repeat) { G.rot = !G.rot; pop(G.rot ? 'Chase camera' : 'Top-down camera'); }
  if (k === 'm' && !e.repeat) pop(sndMute() ? 'Sound off' : 'Sound on');
  if (k === 'escape') handleEsc();
});
addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
ACCT.load().catch(e => console.warn(e)).then(() => { buildMenu(); if (typeof DEBUG_READY === 'function') DEBUG_READY(); }); requestAnimationFrame(tick);
