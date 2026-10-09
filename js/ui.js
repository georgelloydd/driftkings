// ===== Menus, lobby, input, network wiring =====
emitCfg = () => ({ track: CFG.track, laps: CFG.laps, mode: CFG.mode });
const MODES = { race: 'Race (fastest)', drift: 'Drift battle', tt: 'Race (fastest)' };
function msg(id, t) { if (id === 'joinMsg') id = { mp: 'joinMsg' }[TAB] || 'ttMsg'; $(id).textContent = t || ''; }
function refreshMenu() {
  if (CFG.mode !== 'race' && CFG.mode !== 'drift') CFG.mode = 'race'; // host-room mode; time trial has its own tab
  $('nameIn').value = CFG.name;
  document.querySelectorAll('.prow').forEach(r => { const f = r.dataset.f, v = CFG[f]; r.querySelectorAll('.sw').forEach(s => s.classList.toggle('on', s.dataset.c.toLowerCase() === String(v).toLowerCase())); const ci = r.querySelector('input[type=color]'), hi = r.querySelector('.hex'); ci.value = v; if (document.activeElement !== hi) { hi.value = v.toUpperCase(); hi.classList.remove('bad'); } });
  document.querySelectorAll('[data-fin]').forEach(s => s.classList.toggle('on', s.dataset.fin === CFG.finish)); if (document.activeElement !== $('numIn')) $('numIn').value = CFG.num;
  document.querySelectorAll('.lvt').forEach(s => { s.classList.toggle('on', s.dataset.lv === CFG.livery); drawCarPreview(s.querySelector('canvas'), Object.assign(carLook(CFG), { livery: s.dataset.lv }), -0.35); });
  document.querySelectorAll('.tk').forEach(s => s.classList.toggle('on', +s.dataset.t === CFG.track));
  document.querySelectorAll('[data-mode]').forEach(s => s.classList.toggle('on', s.dataset.mode === CFG.mode));
  document.querySelectorAll('[data-l]').forEach(s => s.classList.toggle('on', +s.dataset.l === CFG.laps));
  document.querySelectorAll('.ty').forEach(s => { s.classList.toggle('on', s.dataset.b === CFG.body); drawCarPreview(s.querySelector('canvas'), Object.assign(carLook(CFG), { body: s.dataset.b }), -0.35); });
  $('hostNet').textContent = netAvailable() ? 'Peer-to-peer: no server needed. Works best when everyone is on the same Wi-Fi.' : netNeedText();
  $('pubChk').disabled = !listOn(); $('pubRow').classList.toggle('dim', !listOn()); $('pubRow').title = listOn() ? '' : 'Needs Supabase set up (js/config.js)';
  const r = rec(CFG.track); $('records').textContent = `Your records on ${TRACKS[CFG.track].name}: best lap ${fmt(ACCT.bestLap(CFG.track) || r.lap)} • best drift score ${(r.score || 0).toLocaleString()}`;
  const t = carType(CFG.body); $('gDesc').textContent = t.name.toUpperCase() + ' · ' + t.desc;
  drawCarPreview($('gPrev'), carLook(CFG), -0.5);
  $('chip').querySelector('i').style.background = CFG.color; $('chip').querySelector('b').textContent = CFG.name; $('chip').querySelector('small').textContent = ACCT.reg ? ACCT.key.slice(0, 8) + '-····-····' : 'Guest · create account';
  refreshAcct();
}
let LBSEQ = 0, TAB = 'tt', LBT = 0, LBTimer = 0, KEYSHOWN = false;
function setTab(t) {
  TAB = t; document.querySelectorAll('.nv').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  document.querySelectorAll('#tabs > .tab').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + t));
  const slot = document.querySelector('#tab-' + t + ' .trackSlot'); if (slot) slot.appendChild($('tracks'));
  if (t === 'settings') { renderBinds(); renderGfx(); }
  clearInterval(LBTimer); if (t === 'lb') { LBT = CFG.track; loadLB(); LBTimer = setInterval(() => { if (G.state === 'menu' && TAB === 'lb') loadLB(); }, 5000); }
  if (t === 'acct') refreshAcct();
}
let LBPOLL = 0;
async function loadLB() {
  document.querySelectorAll('[data-lbt]').forEach(b => b.classList.toggle('on', +b.dataset.lbt === LBT));
  const my = ++LBSEQ, res = await LB.top(LBT); if (my !== LBSEQ) return; // ignore slow, out-of-date responses
  $('lbHead').innerHTML = res.live ? '<span class="live"></span> Live · global · fastest lap per driver' : (res.err ? '⚠ Leaderboard server unreachable · showing this device' : 'This device · fastest lap per account') + ` · ${TRACKS[LBT].name}`;
  const best = res.rows[0] ? res.rows[0].lap : 0;
  clearTimeout(LBPOLL); if (res.rows.some(x => x.pending)) LBPOLL = setTimeout(() => { if (TAB === 'lb' && G.state === 'menu') { LB.flush(); loadLB(); } }, 3000);
  $('lbTable').innerHTML = '<tr><th>POS</th><th>DRIVER</th><th>CAR</th><th>BEST LAP</th><th>GAP</th><th>SET</th><th></th></tr>' + (res.rows.length ? res.rows.map((x, i) => `<tr class="${x.pid === ACCT.pub ? 'me' : ''}"><td class="pos">${i + 1}</td><td><i style="background:${esc(x.color || '#888')}"></i>${esc(x.name)}${x.pending ? ' <small style="color:#ff9a2a">· uploading</small>' : ''}${x.failed ? ` <small style="color:#ff5a5a" title="${esc(x.failed)}">· not uploaded (hover for why)</small>` : ''}</td><td>${esc(carType(x.body).name)}</td><td>${fmt(x.lap)}</td><td>${i ? '+' + ((x.lap - best) / 1000).toFixed(3) : '—'}</td><td>${x.at ? new Date(x.at).toLocaleDateString() : ''}</td><td><button class="btn dark sm" data-ghost="${i}" title="Race this lap's ghost in Time trial">Ghost</button></td></tr>`).join('') : '<tr><td colspan="7" style="color:#8b8b93;padding:22px">No laps yet. Set one in Time trial.</td></tr>'); LBROWS = res.rows; $('lbTable').querySelectorAll('[data-ghost]').forEach(b => b.onclick = () => raceGhost(LBT, LBROWS[+b.dataset.ghost], b));
}
function refreshAcct() {
  if (!ACCT.key) return; $('regBox').classList.toggle('hidden', ACCT.reg); if (!ACCT.reg && document.activeElement !== $('regName') && !$('regName').value) $('regName').value = /^Driver\d*$/.test(CFG.name) ? '' : CFG.name; if (document.activeElement !== $('acctName')) $('acctName').value = CFG.name; $('keyOut').value = KEYSHOWN ? ACCT.key : ACCT.key.slice(0, 3) + '••••-••••-••••'; $('bReveal').textContent = KEYSHOWN ? 'Hide' : 'Show';
  $('keyHint').innerHTML = CLOUD ? 'This key is your login. Enter it on any device to get your profile back. Keep it secret.' : 'This key is your login on this device. To move to another device, copy your <b>backup code</b> and paste it there. Keep both secret.';
  $('onStatus').innerHTML = CLOUD ? (ONLINE_ERR ? '<b style="color:#ff6b6b">Error</b> · ' + esc(ONLINE_ERR) : 'Connected to ' + esc(ONLINE.SUPABASE_URL.replace(/^https?:\/\//, ''))) : 'Off · saving on this device only (no Supabase details in js/config.js).';
  const s = ACCT.stats, tb = TRACKS.map((t, i) => s.best[i] && s.best[i].lap ? `<div><small>${esc(t.name)}</small><b>${fmt(s.best[i].lap)}</b></div>` : '').join('');
  $('stats').innerHTML = `<div><small>SESSIONS</small><b>${s.sessions}</b></div><div><small>RACES</small><b>${s.races}</b></div><div><small>LAPS</small><b>${s.laps}</b></div><div><small>DRIFT POINTS</small><b>${Math.round(s.drift).toLocaleString()}</b></div><div><small>DISTANCE</small><b>${s.dist.toFixed(1)} km</b></div>` + tb;
}
function renderServers(list) {
  const box = $('servers');
  if (list === null) { $('srvMode').textContent = '· peer-to-peer'; box.innerHTML = '<p class="hint">' + (netAvailable() ? 'Ask the host for their 5-letter code and type it above. (With Supabase set up, open rooms also show here.)' : esc(netNeedText())) + '</p>'; return; }
  $('srvMode').textContent = '· ' + list.length + ' open';
  box.innerHTML = list.length ? list.map(v => `<div class="srv"><b>${esc(v.host)}</b><span>${esc((TRACKS[v.track] || {}).name || '')} · ${esc(String(v.mode || '').toUpperCase())}${v.laps ? ' · ' + v.laps + ' laps' : ''}</span><span>${v.players} driver${v.players === 1 ? '' : 's'}</span>${v.inRace ? '<em>RACING</em>' : `<button class="btn dark sm" data-code="${esc(v.code)}">Join</button>`}</div>`).join('') : '<p class="hint">No open rooms right now. Create one in Host Room and it will show up here.</p>';
  box.querySelectorAll('[data-code]').forEach(b => b.onclick = () => { if (G.state !== 'menu') return; $('codeIn').value = b.dataset.code; $('bJoin').click(); });
}
function buildMenu() {
  document.querySelectorAll('.nv').forEach(b => b.onclick = () => setTab(b.dataset.tab)); $('chip').onclick = () => setTab('acct');
  Object.assign(CFG, carLook(CFG));
  const PAINT = [['color', 'Body', COLORS], ['accent', 'Stripes', ['#ffffff', '#111111', '#ffd400', '#ff2a2a', '#00e0ff', '#ff7a00', '#7bff4a', '#c04bff']], ['accent2', 'Secondary', ['#111111', '#ffffff', '#ff2a2a', '#ffd400', '#2b6bff', '#c0c0c0', '#00b37a', '#ff4fa3']], ['rim', 'Wheels', ['#c9ccd2', '#1a1a1c', '#d4a838', '#ffffff', '#ff2a2a', '#3a7bff', '#7a7f88', '#e0b98a']]];
  for (const [f, label, sw] of PAINT) {
    const r = document.createElement('div'); r.className = 'prow'; r.dataset.f = f; r.innerHTML = `<b>${label}</b><div class="sws"></div><input type="color" title="Colour picker"><input class="hex" maxlength="7" spellcheck="false" title="Hex code, e.g. #FF2A2A">`;
    const set = v => { CFG[f] = v.toLowerCase(); saveCfg(); refreshMenu(); };
    sw.forEach(c => { const s = document.createElement('div'); s.className = 'sw'; s.style.background = c; s.dataset.c = c; s.title = c.toUpperCase(); s.onclick = () => set(c); r.querySelector('.sws').appendChild(s); });
    r.querySelector('input[type=color]').oninput = e => set(e.target.value);
    const hi = r.querySelector('.hex'); hi.oninput = () => { let v = hi.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + [...v.slice(1)].map(x => x + x).join(''); const ok = /^#[0-9a-f]{6}$/i.test(v); hi.classList.toggle('bad', !ok); if (ok) set(v); };
    hi.onblur = () => refreshMenu(); $('paints').appendChild(r);
  }
  FINISHES.forEach(([id, n]) => { const b = document.createElement('button'); b.className = 'opt'; b.dataset.fin = id; b.textContent = n; b.onclick = () => { CFG.finish = id; saveCfg(); refreshMenu(); }; $('finishes').appendChild(b); });
  $('numIn').oninput = () => { CFG.num = $('numIn').value.replace(/\D/g, '').slice(0, 2); saveCfg(); refreshMenu(); };
  CAR_TYPES.forEach(t => { const d = document.createElement('div'); d.className = 'ty'; d.dataset.b = t.id; const c = document.createElement('canvas'); c.width = 120; c.height = 70; d.appendChild(c); d.appendChild(document.createTextNode(t.name)); d.onclick = () => { CFG.body = t.id; saveCfg(); refreshMenu(); }; $('types').appendChild(d); });
  LIVERIES.forEach(l => { const d = document.createElement('div'); d.className = 'lvt'; d.dataset.lv = l.id; const c = document.createElement('canvas'); c.width = 110; c.height = 64; d.appendChild(c); d.appendChild(document.createTextNode(l.name)); d.onclick = () => { CFG.livery = l.id; saveCfg(); refreshMenu(); }; $('livs').appendChild(d); });
  TRACKS.forEach((t, i) => { if (t.test || t.hidden) return; const d = document.createElement('div'); d.className = 'tk'; d.dataset.t = i; const c = document.createElement('canvas'); c.width = 200; c.height = 120; const g = c.getContext('2d'), tr = buildTrack(i, true), s = Math.min(180 / tr.W, 100 / tr.H);
    g.fillStyle = '#0e0e10'; g.fillRect(0, 0, 200, 120); g.translate(10, 10); g.scale(s, s); g.lineJoin = 'round'; pathTrack(g, tr); g.strokeStyle = '#ff2a2a'; g.lineWidth = Math.max(tr.w + 80, 8 / s); g.shadowColor = '#ff2a2a'; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#1c1c20'; g.lineWidth = Math.max(tr.w + 10, 3 / s); g.stroke();
    const sp = document.createElement('span'); sp.textContent = t.name; d.appendChild(c); d.appendChild(sp); d.onclick = () => { CFG.track = i; saveCfg(); refreshMenu(); }; $('tracks').appendChild(d);
    const b = document.createElement('button'); b.className = 'opt'; b.dataset.lbt = i; b.textContent = t.name; b.onclick = () => { LBT = i; loadLB(); }; $('lbTracks').appendChild(b); });
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { CFG.mode = b.dataset.mode; saveCfg(); refreshMenu(); });
  document.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { CFG.laps = +b.dataset.l; saveCfg(); refreshMenu(); });
  $('nameIn').oninput = () => { CFG.name = $('nameIn').value.trim().slice(0, 14) || 'Driver'; saveCfg(); $('chip').querySelector('b').textContent = CFG.name; };
  $('bTest').onclick = async () => { $('onStatus').textContent = 'Testing…'; const r = await testOnline(); $('onStatus').innerHTML = `<b style="color:${r.ok ? '#7dff9a' : '#ff6b6b'}">${r.ok ? 'Working' : 'Not working'}</b> · ${esc(r.msg)}`; };
  $('bName').onclick = async () => {
    const v = $('acctName').value.trim().replace(/\s+/g, ' ');
    if (v.length < 2) return msg('nameMsg', 'Name needs at least 2 characters.');
    if (v === CFG.name) return msg('nameMsg', 'That is already your name.');
    CFG.name = v; saveCfg(); refreshMenu(); msg('nameMsg', 'Saving…');
    if (NET.on) { if (NET.host) { NET.players.get('host').name = v; netLobby(); } else netSend({ t: 'info', name: v }); }
    const r = await ACCT.rename(v); msg('nameMsg', r);
  };
  $('acctName').onkeydown = e => { if (e.key === 'Enter') $('bName').click(); e.stopPropagation(); };
  $('pubChk').checked = NET.public; $('pubChk').onchange = () => { NET.public = $('pubChk').checked; rtListServer(); };
  serversWatch(renderServers);
  $('bReveal').onclick = () => { KEYSHOWN = !KEYSHOWN; refreshAcct(); };
  const copy = (t, ok) => { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => msg('acctMsg', ok), () => { prompt('Copy this:', t); }); };
  $('bReg').onclick = async () => { try { const m = await ACCT.signUp($('regName').value); KEYSHOWN = true; saveCfg(); refreshMenu(); msg('acctMsg', m); } catch (e) { msg('regMsg', e.message); } };
  $('regName').onkeydown = e => { if (e.key === 'Enter') $('bReg').click(); e.stopPropagation(); };
  $('bCopyKey').onclick = () => copy(ACCT.key, 'Key copied. Keep it somewhere safe.');
  $('bBackup').onclick = () => copy(ACCT.backup(), 'Backup code copied. Paste it into Sign in on another device.');
  $('bSignIn').onclick = async () => { try { const m = await ACCT.restore($('keyIn').value); $('keyIn').value = ''; saveCfg(); refreshMenu(); msg('acctMsg', m); } catch (e) { msg('acctMsg', e.message); } };
  $('bNew').onclick = async () => { if (!confirm('Start a new account? Copy your current key or backup code first if you want to come back to it.')) return; await ACCT.create(); KEYSHOWN = true; refreshMenu(); msg('acctMsg', 'New account created. Copy your key now.'); };
  $('bSolo').onclick = () => { msg('joinMsg'); G.plist = []; startSession({ track: CFG.track, laps: 0, mode: 'tt' }, null, false); };
  $('bHost').onclick = () => {
    if (!ACCT.reg) { setTab('acct'); return msg('regMsg', 'Create an account first to host or join races.'); }
    if (!netAvailable()) return msg('hostMsg', netNeedText());
    msg('hostMsg', 'Creating room…'); $('bHost').disabled = true;
    netHost(CFG, e => { $('bHost').disabled = false; if (e) { netLeave(); return msg('hostMsg', netErrText(e)); } msg('hostMsg'); G.mp = true; G.state = 'lobby'; netLobby(); });
  };
  $('bJoin').onclick = () => {
    if (!ACCT.reg) { setTab('acct'); return msg('regMsg', 'Create an account first to host or join races.'); }
    const code = $('codeIn').value.trim().toUpperCase(); if (code.length !== 5) return msg('joinMsg', 'Enter the 5-letter room code from your friend.');
    if (!netAvailable()) return msg('joinMsg', netNeedText());
    msg('joinMsg', 'Connecting to room ' + code + '…'); $('bJoin').disabled = true;
    netJoin(code, CFG, e => { $('bJoin').disabled = false; if (e) { netLeave(); return msg('joinMsg', netErrText(e)); } msg('joinMsg'); G.mp = true; G.state = 'lobby'; showLobby({ players: [], cfg: {} }); msg('lobbyMsg', 'Connected! Waiting for the host…'); });
  };
  $('bStart').onclick = () => { if (!NET.host) return; const grid = shuffle([...NET.players.keys()]), cfg = emitCfg(), rid = Date.now() % 1e9; NET.inRace = true; G.plist = [...NET.players.values()]; netSend({ t: 'start', cfg, grid, rid }); startSession(cfg, grid, true, rid); };
  $('bLeave').onclick = toMenu;
  refreshMenu();
}
function showLobby(d) {
  if (d.players.length) G.plist = d.players; G.state = 'lobby';
  for (const s of ['hud', 'speedo', 'mini', 'board', 'driftBox', 'menu']) $(s).classList.add('hidden'); $('lobby').classList.remove('hidden'); banner('');
  $('roomCode').textContent = NET.code; $('lobbyHint').innerHTML = NET.host ? (NET.public ? (listOn() ? 'Your room shows in <b>Open rooms</b>. Or tell friends the code.' : 'Tell friends this code. They press <b>Join friend</b> (same Wi-Fi works best).') : 'Private room. Tell friends this code.') : 'You are in the room. The host starts the race.';
  $('plist').innerHTML = G.plist.map(p => `<li><i style="background:${p.color}"></i>${esc(p.name)} <span class="dim">· ${esc(carType(p.body).name)}</span>${p.id === 'host' ? ' 👑' : ''}${p.id === NET.myId ? ' (you)' : ''}</li>`).join('');
  const c = d.cfg && d.cfg.track !== undefined ? d.cfg : emitCfg();
  if (NET.host) {
    const tOpts = TRACKS.map((t, i) => t.test || t.hidden ? '' : `<option value="${i}"${i === c.track ? ' selected' : ''}>${esc(t.name)}</option>`).join('');
    $('lobbyCfg').innerHTML = `<b>Race settings</b> <span class="dim">· everyone sees changes straight away</span>
      <label>Track</label><select id="lcT">${tOpts}</select>
      <label>Mode</label><div class="row">${['race', 'drift'].map(m => `<button class="opt${c.mode === m ? ' on' : ''}" data-lm="${m}">${m === 'drift' ? '💨' : '🏁'} ${MODES[m]}</button>`).join('')}</div>
      <label>Laps</label><div class="row">${[1, 3, 5, 10, 0].map(l => `<button class="opt${c.laps === l ? ' on' : ''}" data-ll="${l}">${l ? l : 'Free roam'}</button>`).join('')}</div>`;
    $('lcT').onchange = () => { CFG.track = +$('lcT').value; saveCfg(); netLobby(); };
    $('lobbyCfg').querySelectorAll('[data-lm]').forEach(b => b.onclick = () => { CFG.mode = b.dataset.lm; saveCfg(); netLobby(); });
    $('lobbyCfg').querySelectorAll('[data-ll]').forEach(b => b.onclick = () => { CFG.laps = +b.dataset.ll; saveCfg(); netLobby(); });
    $('pubRow').classList.remove('hidden');
    $('bStart').classList.remove('hidden'); $('bStart').textContent = G.plist.length > 1 ? `Start race (${G.plist.length} drivers)` : 'Start (waiting for friends…)';
    msg('lobbyMsg', G.plist.length > 1 ? '' : 'Share the code above. You can also start alone to test.');
  } else {
    $('pubRow').classList.add('hidden'); $('lobbyCfg').innerHTML = c.track !== undefined ? '<b>Race settings</b> <span class="dim">· the host picks these</span><div class="ro">' + esc( `Track: ${TRACKS[c.track].name} • ${c.laps ? c.laps + ' laps' : 'Free roam'} • ${MODES[c.mode]}`) + '</div>' : '';
    $('bStart').classList.add('hidden'); $('lobbyHint').textContent = 'You are in the room. The host starts the race.'; if (G.plist.length) msg('lobbyMsg', 'Waiting for the host to start…');
    if (c.track !== undefined && G.attract && G.attract.idx !== c.track) CFG.track = c.track;
  }
}
netOn('lobby', showLobby);
netOn('start', d => startSession(d.cfg, d.grid, true, d.rid));
netOn('all', d => { if (G.state !== 'race' && G.state !== 'countdown') return; for (const row of d.list) if (row[0] !== NET.myId) applyState(row[0], row.slice(1)); });
netOn('st', d => { if (G.state === 'race' || G.state === 'countdown') applyState(d.id, d.s); });
netOn('fin', d => { if (G.state === 'race') hostFin(d.id, d.time, d.score, d.laps, d.rid); });
netOn('res', d => { if (!NET.host && G.me && (d.rid || 0) === G.rid) applyRes(d.list, d.final); });
netOn('hostgone', () => { toMenu(); msg('joinMsg', 'The host left, so the room has closed.'); });
netOn('busy', d => { toMenu(); msg('joinMsg', d.msg); });
netOn('neterror', e => msg(G.state === 'lobby' ? 'lobbyMsg' : 'joinMsg', netErrText(e)));
netOn('gone', d => { if (NET.host || !d || d.id === NET.myId) return; G.plist = (G.plist || []).filter(p => p.id !== d.id); const r = G.rem.get(d.id); if (r && G.state !== 'lobby') { pop(r.car.name + ' left', '#aaa'); G.rem.delete(d.id); } });
netOn('left', id => { const r = G.rem.get(id); if (r && G.state !== 'lobby') { pop(r.car.name + ' left', '#aaa'); G.rem.delete(id); if (G.firstFin) hostRes(false); } });
netOn('joined', () => { });
function handleEsc() {
  if (G.tt && G.state === 'race') endTT(); else if (G.state === 'over') toMenu(); else if (G.state === 'race' || G.state === 'countdown') { if (!G.mp) toMenu(); else if (NET.host) { if (confirm('End the race for everyone and go back to the lobby?')) hostToLobby(); } else if (confirm('Leave the room?')) toMenu(); }
  else if (G.state === 'lobby') toMenu();
}
addEventListener('keydown', e => {
  if (SESS.blocked) return;
  sndInit();
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.key.toLowerCase(), B = CFG.keys;
  if (BINDING) { e.preventDefault(); if (k !== 'escape') setBind(BINDING, k); BINDING = null; renderBinds(); return; }
  KEYS[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) || (k === B.hb && G.state !== 'menu')) e.preventDefault();
  if (G.state === 'race' && G.me) {
    if (k === B.reset && !e.repeat) { if (G.tt) ttRestart(); else resetCar(G.me); }
    if (k === B.cp && !e.repeat) { if (G.tt) ttCheckpoint(); else resetCar(G.me); }
  }
  if (k === B.cam && !e.repeat) { G.rot = !G.rot; pop(G.rot ? 'Chase camera' : 'Top-down camera'); }
  if (k === B.mute && !e.repeat) pop(sndMute() ? 'Sound off' : 'Sound on');
  if (k === 'escape') handleEsc();
});
addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
document.querySelectorAll('.nv').forEach(b => b.onclick = () => setTab(b.dataset.tab));
Promise.all([ACCT.load().catch(e => console.warn(e)), loadTracks()]).then(() => { buildMenu(); if (TEST_IDX >= 0) { CFG.track = TEST_IDX; startSession({ track: TEST_IDX, laps: 0, mode: 'tt' }, null, false); } if (typeof DEBUG_READY === 'function') DEBUG_READY(); }); requestAnimationFrame(tick);

// ===== Settings: keybinds + graphics =====
let BINDING = null;
const BIND_ACTIONS = [['up', 'Throttle'], ['down', 'Brake / reverse'], ['left', 'Steer left'], ['right', 'Steer right'], ['hb', 'Handbrake'], ['reset', 'Reset (time trial: restart lap)'], ['cp', 'Back to last checkpoint'], ['cam', 'Switch camera'], ['mute', 'Mute sound']];
function keyName(k) { if (!k) return '?'; if (k === ' ') return 'SPACE'; const A = { arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→' }; return A[k] || k.toUpperCase(); }
function setBind(a, k) { for (const x in CFG.keys) if (x !== a && CFG.keys[x] === k) CFG.keys[x] = CFG.keys[a]; CFG.keys[a] = k; saveCfg(); keysHint(); }
function renderBinds() {
  $('binds').innerHTML = BIND_ACTIONS.map(([a, l]) => `<div class="bind"><span>${l}</span><button class="opt kb${BINDING === a ? ' wait' : ''}" data-a="${a}">${BINDING === a ? 'PRESS A KEY…' : esc(keyName(CFG.keys[a]))}</button></div>`).join('');
  $('binds').querySelectorAll('[data-a]').forEach(b => b.onclick = () => { BINDING = b.dataset.a; b.blur(); renderBinds(); });
}
const GFX_OPTS = [['res', 'Resolution', [['sharp', 'Sharp'], ['balanced', 'Balanced'], ['fast', 'Fast'], ['retro', 'Retro']]], ['gates', 'Checkpoint gates', [[1, 'On'], [0, 'Off']]], ['smoke', 'Tyre smoke', [[1, 'On'], [0, 'Off']]], ['skids', 'Skid marks', [[1, 'On'], [0, 'Off']]], ['weather', 'Weather (snow)', [[1, 'On'], [0, 'Off']]], ['vignette', 'Vignette', [[1, 'On'], [0, 'Off']]], ['fps', 'FPS counter', [[0, 'Off'], [1, 'On']]]];
function renderGfx() {
  $('gfx').innerHTML = GFX_OPTS.map(([k, l, o]) => `<div class="bind"><span>${l}</span><div class="row">${o.map(([v, n]) => `<button class="opt${CFG.gfx[k] == v ? ' on' : ''}" data-g="${k}" data-v="${v}">${n}</button>`).join('')}</div></div>`).join('');
  $('gfx').querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const v = b.dataset.v; CFG.gfx[b.dataset.g] = isNaN(+v) ? v : +v; applyGfx(); saveCfg(); renderGfx(); });
}
function keysHint() {
  const B = CFG.keys, n = k => esc(keyName(k));
  $('keysP').innerHTML = `${n(B.up)}/↑ throttle · ${n(B.down)}/↓ brake · ${n(B.left)} ${n(B.right)}/← → steer · ${n(B.hb)} handbrake · ${n(B.reset)} reset · ${n(B.cp)} checkpoint · ${n(B.cam)} camera · ${n(B.mute)} mute · ESC menu`;
  $('ttHint').innerHTML = `Endless laps until you quit. <b>${n(B.reset)}</b> restarts the lap · <b>${n(B.cp)}</b> back to last checkpoint · <b>ESC</b> ends the session. Drive through the numbered gates in order; the next one glows yellow.`;
}
$('bBindReset').onclick = () => { CFG.keys = Object.assign({}, DEF_KEYS); BINDING = null; saveCfg(); renderBinds(); keysHint(); };
$('bGfxReset').onclick = () => { CFG.gfx = Object.assign({}, DEF_GFX); applyGfx(); saveCfg(); renderGfx(); };
keysHint();

// Published tracks (tracks.json in the repo, written by /build) replace the built-in list; ?test=1 adds the builder's test track
let TEST_IDX = -1;
async function loadTracks() {
  try { const r = await fetch('tracks.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) { const j = await r.json(); const L = (j.tracks || []).filter(t => t && Array.isArray(t.pts) && t.pts.length >= 4); if (L.length) TRACKS.splice(0, TRACKS.length, ...L); } } catch (e) { }
  if (new URLSearchParams(location.search).has('test')) { try { const hp = new URLSearchParams(location.hash.slice(1)).get('track'); const d = hp ? JSON.parse(decodeURIComponent(escape(atob(hp)))) : JSON.parse(localStorage.getItem('md_test_track') || 'null'); if (d && Array.isArray(d.pts) && d.pts.length >= 4) { d.test = true; d.name = (d.name || 'Track') + ' (test)'; TRACKS.push(d); TEST_IDX = TRACKS.length - 1; } } catch (e) { } }
  if (!(CFG.track >= 0 && CFG.track < TRACKS.length) || ((TRACKS[CFG.track].test || TRACKS[CFG.track].hidden) && CFG.track !== TEST_IDX)) CFG.track = Math.max(0, TRACKS.findIndex(t => !t.hidden && !t.test));
  G.attract = null;
}

// ---------- race a leaderboard ghost in time trial ----------
let LBROWS = [];
async function raceGhost(tr, row, btn) {
  if (G.state !== 'menu' || !row) return; let rep = null; if (btn) btn.textContent = '…';
  if (CLOUD) { try { const r = await sb('GET', `laps?track=eq.${tr}&pid=eq.${encodeURIComponent(row.pid)}&select=replay,lap_ms`); if (r && r[0] && r[0].lap_ms === row.lap) rep = r[0].replay; } catch (e) { } }
  if (!decRep(rep) && row.pid === ACCT.pub) rep = localStorage.getItem('md_rep_' + tr);
  if (btn) btn.textContent = 'Ghost';
  if (!decRep(rep)) return alert('There is no ghost for this lap yet. Ghosts are saved with new personal bests from now on.');
  G.ghostPick = { rep, name: row.name, color: row.color, body: row.body }; CFG.track = tr; G.plist = []; startSession({ track: tr, laps: 0, mode: 'tt' }, null, false);
}

// ===== custom dropdowns: replaces the browser's native <select> look, keeps the real select underneath =====
(function () {
  const P = HTMLSelectElement.prototype, dV = Object.getOwnPropertyDescriptor(P, 'value'), dI = Object.getOwnPropertyDescriptor(P, 'selectedIndex');
  let open = null;
  const close = () => { if (!open) return; open.w.classList.remove('open'); open.list.remove(); open = null; };
  const pick = (s, i) => { if (i < 0 || i >= s.options.length || s.options[i].disabled) return; if (s.selectedIndex !== i) { dI.set.call(s, i); s._csUpd(); s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true })); } };
  function enh(s) {
    if (s.dataset.cs || s.multiple || s.size > 1 || !s.parentNode) return; s.dataset.cs = '1';
    const w = document.createElement('div'); w.className = 'csel'; const b = document.createElement('button'); b.type = 'button'; b.className = 'csel-btn';
    if (s.id) w.dataset.for = s.id; s.parentNode.insertBefore(w, s); w.appendChild(s); w.appendChild(b); s.tabIndex = -1;
    const upd = () => { const o = s.options[s.selectedIndex]; b.textContent = o ? o.textContent : ''; b.disabled = s.disabled; w.classList.toggle('dis', s.disabled); w.classList.toggle('hidden', s.classList.contains('hidden')); w.style.display = s.style.display === 'none' ? 'none' : ''; };
    s._csUpd = upd; upd();
    Object.defineProperty(s, 'value', { configurable: true, get() { return dV.get.call(this); }, set(v) { dV.set.call(this, v); upd(); } });
    Object.defineProperty(s, 'selectedIndex', { configurable: true, get() { return dI.get.call(this); }, set(v) { dI.set.call(this, v); upd(); } });
    s.addEventListener('change', upd);
    new MutationObserver(upd).observe(s, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected', 'class', 'style'] });
    b.addEventListener('keydown', e => { const k = e.key; if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); let i = s.selectedIndex; do { i += k === 'ArrowDown' ? 1 : -1; } while (i >= 0 && i < s.options.length && s.options[i].disabled); pick(s, i); if (open) { close(); b.click(); } } });
    b.addEventListener('click', e => {
      e.stopPropagation(); if (open && open.s === s) return close(); close(); if (s.disabled) return;
      const list = document.createElement('div'); list.className = 'csel-list';
      [...s.options].forEach((o, i) => { if (o.hidden) return; const it = document.createElement('div'); it.className = 'csel-opt' + (i === s.selectedIndex ? ' sel' : '') + (o.disabled ? ' dis' : ''); it.textContent = o.textContent;
        it.addEventListener('mousedown', ev => { ev.preventDefault(); ev.stopPropagation(); if (o.disabled) return; pick(s, i); close(); b.focus(); }); list.appendChild(it); });
      document.body.appendChild(list); const r = b.getBoundingClientRect(), below = innerHeight - r.bottom - 10, above = r.top - 10, h = Math.min(list.scrollHeight, 320);
      list.style.minWidth = r.width + 'px'; list.style.left = Math.max(6, Math.min(r.left, innerWidth - list.offsetWidth - 6)) + 'px';
      if (below < h && above > below) { list.style.bottom = (innerHeight - r.top + 4) + 'px'; list.style.maxHeight = Math.min(320, above) + 'px'; } else { list.style.top = (r.bottom + 4) + 'px'; list.style.maxHeight = Math.max(100, Math.min(320, below)) + 'px'; }
      const cur = list.querySelector('.sel'); if (cur) cur.scrollIntoView({ block: 'nearest' });
      w.classList.add('open'); open = { s, w, list };
    });
  }
  document.addEventListener('mousedown', e => { if (open && !open.list.contains(e.target) && !open.w.contains(e.target)) close(); }, true);
  document.addEventListener('scroll', e => { if (open && !open.list.contains(e.target)) close(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { close(); e.stopPropagation(); e.preventDefault(); } }, true);
  addEventListener('resize', close);
  const scan = n => { if (n.tagName === 'SELECT') enh(n); else if (n.querySelectorAll) n.querySelectorAll('select').forEach(enh); };
  const go = () => { scan(document.body); new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n); }).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  window.cselRefresh = () => document.querySelectorAll('select').forEach(s => s._csUpd && s._csUpd());
})();
