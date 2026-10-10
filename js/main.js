// ===== Game loop, race logic, rendering =====
function $(i) { return document.getElementById(i); }
const cv = $('cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() { DPR = Math.min(window.GFX_SCALE || 2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; }
addEventListener('resize', resize); resize();
const COLORS = ['#ff3b3b', '#ff8c1a', '#ffd60a', '#2ecc71', '#1ec8ff', '#3d6bff', '#a24dff', '#ff3fb4', '#f2f2f2', '#33363d'];
const CFG = Object.assign({ name: 'Driver', color: COLORS[Math.floor(Math.random() * 8)], track: 0, mode: 'tt', laps: 3, body: 'drift', livery: 'stripes', accent: '#ffffff', accent2: '#111111', rim: '#c9ccd2', finish: 'gloss', num: '7' }, JSON.parse(localStorage.getItem('md_cfg') || '{}'));
function saveCfg() { localStorage.setItem('md_cfg', JSON.stringify(CFG)); if (typeof ACCT !== 'undefined') ACCT.save(); }
const DEF_KEYS = { up: 'w', down: 's', left: 'a', right: 'd', hb: ' ', reset: 'r', cp: 'f', cam: 'c', mute: 'm' };
const DEF_GFX = { res: 'sharp', smoke: 1, skids: 1, weather: 1, vignette: 1, gates: 1, fps: 0 };
CFG.keys = Object.assign({}, DEF_KEYS, CFG.keys || {}); CFG.gfx = Object.assign({}, DEF_GFX, CFG.gfx || {});
const GFX_SCALES = { sharp: 2, balanced: 1.5, fast: 1, retro: 0.6 };
function applyGfx() { window.GFX_SCALE = GFX_SCALES[CFG.gfx.res] || 2; resize(); }
applyGfx();
const G = { state: 'menu', tr: null, me: null, rem: new Map(), cfg: null, mp: false, t0: 0, cdEnd: 0, res: new Map(), resList: null, firstFin: 0, final: false, rot: false, cam: { x: WORLD_W / 2, y: WORLD_H / 2, z: 0.5, a: 0 }, smoke: [], snow: [], acc: 0, last: 0, sendT: 0, hudT: 0, plist: [], attract: null, ai: 0 };
const KEYS = {};
function fmt(ms) { if (!ms) return '--'; const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ':' + s.toFixed(3).padStart(6, '0'); }
function pop(t, col) { const d = document.createElement('div'); d.className = 'pop'; d.style.color = col || '#fff'; d.textContent = t; $('pops').appendChild(d); setTimeout(() => d.remove(), 1400); }
function banner(t, small) { $('banner').textContent = t; $('banner').className = small ? 'small' : ''; }
function rec(tr) { return JSON.parse(localStorage.getItem('md_rec_' + tr) || '{}'); }
function setRec(tr, r) { localStorage.setItem('md_rec_' + tr, JSON.stringify(r)); }
function myId() { return G.mp ? NET.myId : 'me'; }

function startSession(cfg, grid, mp, rid) {
  if (SESS.blocked) return;
  if (cfg.mode === 'tt') { cfg = Object.assign({}, cfg, { laps: 0 }); mp = false; grid = null; }
  G.tt = cfg.mode === 'tt' ? { laps: 0, restarts: 0, cps: 0, start: 0 } : null; G.dist = 0;
  G.cfg = cfg; G.mp = mp; G.tr = buildTrack(cfg.track); G.rem.clear(); G.res.clear(); G.resList = null; G.final = false; G.firstFin = 0; G.smoke = []; G.flag = false; G.rid = rid || 0; for (const k in KEYS) KEYS[k] = false;
  grid = grid || [myId()];
  grid.forEach((id, slot) => {
    if (id === myId()) { G.me = newCar(slot, G.tr, id, CFG.name, CFG.color); Object.assign(G.me, carLook(CFG)); G.me.cpI = null; G.me.tw = TWEAKS; }
    else { const p = G.plist.find(q => q.id === id) || { name: 'Driver', color: '#888' }; const rc = newCar(slot, G.tr, id, p.name, p.color); Object.assign(rc, carLook(p)); rc.color = carLook(p).color; G.rem.set(id, { car: rc, tgt: null, raw: null }); }
  });
  G.ghost = null; G.ghostCar = null; G.curSplits = []; G.splitStart = null; G.recL = null; G.recStart = null;
  if (G.tt) { applySpawn(G.me); const pick = G.ghostPick; G.ghostPick = null; setGhost(pick ? pick.rep : localStorage.getItem('md_rep_' + cfg.track), pick); }
  G.cam.x = G.me.x; G.cam.y = G.me.y; G.cam.a = -G.me.a - Math.PI / 2;
  for (const s of ['menu', 'lobby', 'board']) $(s).classList.add('hidden');
  for (const s of ['hud', 'speedo', 'mini']) $(s).classList.remove('hidden');
  $('hLap').style.display = cfg.laps || G.tt ? '' : 'none'; $('hKeys').classList.toggle('hidden', !G.tt); $('hKeys').textContent = keyName(CFG.keys.reset) + ' restart lap · ' + keyName(CFG.keys.cp) + ' last checkpoint · ESC end session'; $('hTime').querySelector('small').textContent = G.tt ? 'LAP TIME' : 'TIME'; $('hPos').style.display = G.rem.size ? '' : 'none';
  G.state = 'countdown'; G.cdEnd = performance.now() + (cfg.laps || G.tt ? 3200 : 600); G.t0 = G.cdEnd; buildMini();
  sndInit();
}
function segOf(i) { const g = G.tr.gates; let s = 0; while (s < g.length && g[s].i <= i) s++; return s; }
function progress(c, i, now) {
  const n = G.tr.n, f = i / n, lf = c.prog / n, K = G.tr.gates.length;
  if (c.seg === undefined) c.seg = 0; if (!c.gp) c.gp = [];
  if (lf > 0.85 && f < 0.15) {
    if (c.lap < 0) { c.lap = 0; c.lapStart = now; c.ng = 0; c.seg = 0; c.gp = []; c.cpI = (i + 3) % n; }
    else if ((c.ng || 0) >= K) { const lt = now - c.lapStart; c.lap++; c.lapStart = now; c.lastLap = lt; if (!c.best || lt < c.best) c.best = lt; c.ng = 0; c.seg = 0; c.gp = []; c.cpI = (i + 3) % n; onLap(c, lt, now); }
    else if (c.lap >= 0) { const miss = (c.ng || 0) + 1; if ((c.seg || 0) > 0 && c === G.me && now - (c.missT || 0) > 1500) { c.missT = now; pop('LAP NOT COUNTED · MISSED CHECKPOINT ' + Math.min(K, miss), '#ff3b3b'); } c.ng = 0; c.seg = 0; c.gp = []; c.lapStart = now; c.cpI = (i + 3) % n; if (c === G.me) { G.curSplits = []; } }
  }
  c.prog = i;
}
function onLap(c, lt, now) {
  const rep = c === G.me ? encRep(G.recL) : null, sr = splitRef(); if (sr && sr.lap) showDelta(lt - sr.lap);
  let pb = false; if (!TRACKS[G.cfg.track].test) { const r = rec(G.cfg.track); if (!r.lap || lt < r.lap) { r.lap = lt; pb = true; setRec(G.cfg.track, r); }
  if (ACCT.lap(G.cfg.track, lt, c.score + c.cur, rep)) pb = true; }
  lapExtras(lt, rep, pb, sr); ACCT.stats.laps++; if (G.tt) G.tt.laps++;
  pop((G.cfg.laps && (c.lap >= G.cfg.laps || G.flag) ? 'FINAL LAP ' : 'LAP ') + fmt(lt) + (pb ? '  ★ PB' : ''), pb ? '#7dff9a' : '#fff');
  if (G.cfg.laps && !G.flag && c.lap === G.cfg.laps - 1) setTimeout(() => pop('FINAL LAP!', '#ffe14d'), 700);
  if (G.cfg.laps && (c.lap >= G.cfg.laps || G.flag)) finishMe(now);
}
function bankDrift(c) { if (c.cur > 0) { const p = Math.round(c.cur); c.score += p; c.cur = 0; c.combo = 1; c.comboT = 0; return p; } return 0; }
function finishMe(now) {
  const c = G.me; bankDrift(c); c.finished = Math.round(now - G.t0); G.flag = true; ACCT.stats.laps -= Math.max(0, c.lap); ACCT.addSession({ race: true, laps: c.lap, drift: c.score, dist: G.dist * 0.0000694 });
  const r = rec(G.cfg.track); if (!r.score || c.score > r.score) { r.score = c.score; setRec(G.cfg.track, r); }
  banner('FINISHED!'); setTimeout(() => { if (G.state === 'race') banner(''); }, 2000);
  if (!G.mp) { G.resList = [{ id: 'me', name: c.name, color: c.color, time: c.finished, score: c.score, laps: c.lap }]; G.final = true; setTimeout(showBoard, 1500); }
  else if (NET.host) hostFin('host', c.finished, c.score, c.lap, G.rid);
  else { netSend({ t: 'fin', time: c.finished, score: c.score, laps: c.lap, rid: G.rid }); setTimeout(showBoard, 1500); }
}
function hostFin(id, time, score, laps, rid) { if ((rid || 0) !== G.rid || G.res.has(id)) return; G.res.set(id, { time, score, laps: laps || 0 }); raiseFlag(); if (!G.firstFin) G.firstFin = performance.now(); hostRes(false); }
function hostRes(force) {
  const ids = ['host', ...G.rem.keys()]; const final = force || ids.every(id => G.res.has(id));
  const list = ids.map(id => { const p = id === 'host' ? { name: CFG.name, color: CFG.color } : G.rem.get(id).car; const r = G.res.get(id); return { id, name: p.name, color: p.color, time: r ? r.time : 0, laps: r ? r.laps : 0, score: r ? r.score : (id === 'host' ? G.me.score : G.rem.get(id).car.score) }; });
  netSend({ t: 'res', list, final, rid: G.rid }); applyRes(list, final);
}
function applyRes(list, final) { G.resList = list; G.final = final; if (final) NET.inRace = false; if (G.me.finished || final) showBoard(); }
function showBoard() {
  if (!G.resList) return; const drift = G.cfg.mode === 'drift', L = [...G.resList];
  L.sort((a, b) => drift ? b.score - a.score : (!!b.time - !!a.time) || ((b.laps || 0) - (a.laps || 0)) || (a.time || 1e12) - (b.time || 1e12)); const maxL = Math.max(0, ...L.map(p => p.time ? p.laps || 0 : 0));
  const r = rec(G.cfg.track);
  let h = `<h2>${G.final ? (drift ? '💨 DRIFT BATTLE RESULTS' : '🏁 RACE RESULTS') : 'RESULTS (waiting for others…)'}</h2><table>`;
  L.forEach((p, i) => { h += `<tr><td>${['🥇', '🥈', '🥉'][i] || (i + 1)}</td><td><i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${p.color}"></i> ${esc(p.name)}</td><td>${p.time ? fmt(p.time) + (!drift && p.laps && p.laps < maxL ? ' <span class="dim">+' + (maxL - p.laps) + ' lap' + (maxL - p.laps > 1 ? 's' : '') + '</span>' : '') : (G.final ? 'DNF' : 'racing…')}</td><td>${p.score.toLocaleString()} pts</td></tr>`; });
  h += `</table><p style="opacity:.7;text-align:center">Your best on ${G.tr.name}: lap ${fmt(r.lap)} • drift ${(r.score || 0).toLocaleString()} pts</p>`;
  if (!G.mp) h += `<button class="btn green" onclick="startSession(G.cfg,null,false)">Race again</button><button class="btn blue" onclick="toMenu()">Menu</button>`;
  else if (NET.host) h += `<button class="btn green" onclick="hostToLobby()" ${G.final ? '' : 'disabled id="bWait"'}>Back to lobby</button>${G.final ? '' : '<button class="btn orange" onclick="hostRes(true)">End race now</button>'}`;
  else h += `<p style="text-align:center">${G.final ? 'Waiting for the host to start the next race…' : ''}</p>`;
  $('board').innerHTML = h; $('board').classList.remove('hidden');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pack(c) { return [c.x | 0, c.y | 0, +c.a.toFixed(3), c.vx | 0, c.vy | 0, +c.steer.toFixed(2), (c.drift ? 1 : 0) | (c.brake ? 2 : 0) | (c.hb ? 4 : 0), c.lap, c.prog, Math.round(c.score + c.cur), c.finished | 0, G.rid, Math.round(performance.now())]; }
function applyState(id, s) {
  const r = G.rem.get(id); if (!r || (s[11] || 0) !== G.rid) return; r.raw = s; if (s[10] && !r.car.finished) raiseFlag(r.car.name); const c = r.car, now = performance.now();
  if (!r.tgt) { c.x = s[0]; c.y = s[1]; c.a = s[2]; }
  r.tgt = { x: s[0], y: s[1], a: s[2], vx: s[3], vy: s[4], t: now }; bufState(r, s, now); c.steer = s[5]; c.drift = !!(s[6] & 1); c.brake = !!(s[6] & 2); c.hb = !!(s[6] & 4); c.lap = s[7]; c.prog = s[8]; c.score = s[9]; c.finished = s[10];
}
function resetCar(c) { const nr = nearestFull(G.tr, c.x, c.y), p = G.tr.pts[nr.i]; c.x = p[0]; c.y = p[1]; c.a = G.tr.dirs[nr.i]; c.vx = c.vy = 0; c.hint = nr.i; c.cur = 0; c.drift = false; }
function inputs() { const k = KEYS, B = CFG.keys, T = typeof TOUCH !== 'undefined' ? TOUCH : {}; return { up: k[B.up] || k.arrowup || !!T.up, down: k[B.down] || k.arrowdown || !!T.down, left: k[B.left] || k.arrowleft || !!T.left, right: k[B.right] || k.arrowright || !!T.right, hb: k[B.hb] || !!T.hb }; }

const STEP = 1 / 120;
function tick(ts, bg) { try { tickInner(ts, bg); } catch (e) { reportErr(e); if (!bg) requestAnimationFrame(tick); } }
function tickInner(ts, bg) {
  if (!bg) requestAnimationFrame(tick);
  const now = performance.now(), dt = Math.min(bg ? 0.5 : 0.05, (ts - (G.last || ts)) / 1000); G.last = ts;
  if (G.state === 'menu' || G.state === 'lobby') { if (!bg) renderAttract(dt); return; }
  const me = G.me, racing = G.state === 'race';
  if (G.state === 'countdown') { const left = G.cdEnd - now; banner(left > 0 ? (G.cfg.laps || G.tt ? String(Math.ceil(left / 1000)) : '') : ''); if (left <= 0) { G.state = 'race'; if (G.tt) G.tt.start = now; if (G.cfg.laps || G.tt) { banner('GO!'); setTimeout(() => { if ($('banner').textContent === 'GO!') banner(''); }, 900); } } }
  G.acc += dt; let inp = inputs();
  if (!racing) inp = { hb: true }; else if (me.finished) inp = { down: me.vF > 30 };
  while (G.acc >= STEP) { G.acc -= STEP; me.px = me.x; me.py = me.y; me.pa = me.a; const ox = me.x, oy = me.y, nr = stepCar(me, inp, STEP, G.tr); if (racing && !me.finished) { const tn = performance.now(); gateCross(me, ox, oy, tn); progress(me, nr.i, tn); } }
  if (racing && !me.finished && me.lap >= 0) { if (G.recStart !== me.lapStart) { G.recStart = me.lapStart; G.recL = []; G.recK = -1; } const k = Math.floor((performance.now() - me.lapStart) / 100); if (k > G.recK) { G.recK = k; G.recL.push([Math.round(me.x), Math.round(me.y), Math.round(me.a * 100)]); } }
  // drift scoring
  if (racing && !me.finished) {
    G.dist += me.speed * dt;
    if (me.drift && me.speed > 250 && !me.off) { me.cur += Math.abs(me.slip) * me.speed * dt * 0.12 * me.combo; me.comboT += dt; me.idle = 0; if (me.comboT > 1.6 && me.combo < 5) { me.comboT = 0; me.combo++; pop('COMBO x' + me.combo, '#ff3b3b'); } }
    else if (me.cur > 0) { if (me.off) { pop('DRIFT FAILED', '#ff6060'); me.cur = 0; me.combo = 1; me.comboT = 0; } else { me.idle += dt; if (me.idle > 0.9) { const p = bankDrift(me); if (p > 20) pop('+' + p.toLocaleString() + (p > 3000 ? '  INSANE!' : p > 1200 ? '  GREAT DRIFT' : ''), '#ffe14d'); } } }
    const d = G.tr.dirs[me.hint], fwdTrack = me.vx * Math.cos(d) + me.vy * Math.sin(d); me.wrong = fwdTrack < -120 ? me.wrong + dt : 0;
  }
  // remote cars
  for (const [id, r] of G.rem) { if (!r.tgt) continue; const c = r.car; interpRemote(r, c, now);
    const dx = me.x - c.x, dy = me.y - c.y, dd = Math.hypot(dx, dy); if (dd < 44 && dd > 0.01 && racing && !c.finished && !me.finished) { const nx = dx / dd, ny = dy / dd; me.x += nx * (44 - dd); me.y += ny * (44 - dd); const rv = (me.vx - c.vx) * nx + (me.vy - c.vy) * ny; if (rv < 0) { me.vx -= rv * 1.3 * nx; me.vy -= rv * 1.3 * ny; } if (me.cur > 200) { pop('CONTACT! DRIFT LOST', '#ff6060'); me.cur = 0; me.combo = 1; } } }
  // network
  if (G.mp && now - G.sendT > NET.rate) { G.sendT = now; const s = pack(me); if (NET.host) { const list = [['host', ...s]]; for (const [id, r] of G.rem) if (r.raw) list.push([id, ...r.raw]); netSend({ t: 'all', list }); if (G.firstFin && !G.final && now - G.firstFin > 120000) hostRes(true); } else netSend({ t: 'st', s }); }
  if (bg) { sndUpdate(me, true); return; }
  effects(dt); render(dt, now); hud(now); sndUpdate(me, true);
}
// Browsers pause requestAnimationFrame in background tabs, which froze your car (and, for hosts, the whole room)
// for everyone else. A worker timer keeps physics + networking running while the tab is hidden.
(function () {
  const bgTick = () => { if (document.hidden && G.me && (G.state === 'race' || G.state === 'countdown' || G.state === 'over')) tick(performance.now(), true); };
  let w = null; try { w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33)'], { type: 'text/javascript' }))); w.onmessage = bgTick; } catch (e) { setInterval(bgTick, 50); }
  document.addEventListener('visibilitychange', () => { for (const k in KEYS) KEYS[k] = false; if (!document.hidden) G.last = 0; });
})();
function effects(dt) {
  const snow = G.tr.th.snow;
  for (const c of [G.me, ...[...G.rem.values()].map(r => r.car)]) {
    const sliding = (c.drift || c.hb || (c.brake && c.speed > 500)) && c.speed > 120;
    if (sliding) { const w = wheelPos(c); if (c.rwL && CFG.gfx.skids) { skidSeg(c.rwL, w[0], snow); skidSeg(c.rwR, w[1], snow); } c.rwL = w[0]; c.rwR = w[1];
      if (CFG.gfx.smoke && G.smoke.length < 450) for (const p of w) if (Math.random() < 0.8) G.smoke.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 40 - c.vx * 0.05, vy: (Math.random() - 0.5) * 40 - c.vy * 0.05, r: 8, life: 0, max: 0.9 + Math.random() * 0.8 }); }
    else c.rwL = c.rwR = null;
  }
  G.smoke = G.smoke.filter(p => (p.life += dt) < p.max); for (const p of G.smoke) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += 38 * dt; }
}

// ===== Endless time trial: R restarts the lap, F returns to the last checkpoint, ESC ends the session =====
function raceCheckpoint() {
  const c = G.me; if (c.cpI == null) return resetCar(c);
  const i = c.cpI, p = G.tr.pts[i]; c.x = p[0]; c.y = p[1]; c.a = G.tr.dirs[i]; c.vx = c.vy = 0; c.steer = 0; c.speed = 0; c.hint = i; c.prog = i;
  c.cur = 0; c.combo = 1; c.comboT = 0; c.drift = false; c.wrong = 0; c.rwL = c.rwR = null; pop('BACK TO CHECKPOINT', '#ffe14d');
}
function ttRestart() {
  const c = G.me, s = gridSlot(G.tr, 0); c.x = s.x; c.y = s.y; c.a = s.a; c.vx = c.vy = 0; c.steer = 0; c.speed = 0; c.lap = -1; c.cps = 0; c.lapStart = 0; c.cur = 0; c.combo = 1; c.comboT = 0; c.drift = false; c.wrong = 0;
  c.hint = s.i; c.prog = s.i; c.seg = 0; c.gp = []; c.ng = 0; c.cpI = null; c.rwL = c.rwR = null; applySpawn(c); G.tt.restarts++; pop('LAP RESTARTED', '#ff3b3b');
}
function ttCheckpoint() {
  const c = G.me; if (c.cpI == null) return ttRestart();
  const i = c.cpI, p = G.tr.pts[i]; c.x = p[0]; c.y = p[1]; c.a = G.tr.dirs[i]; c.vx = c.vy = 0; c.steer = 0; c.speed = 0; c.hint = i; c.prog = i; c.seg = c.seg || 0; c.ng = c.seg;
  c.cur = 0; c.combo = 1; c.comboT = 0; c.drift = false; c.wrong = 0; c.rwL = c.rwR = null; pop('BACK TO CHECKPOINT', '#ffe14d');
}
function endTT() {
  const c = G.me; bankDrift(c); G.state = 'over'; banner(''); const T = G.tt, driven = T.start ? performance.now() - T.start : 0, km = G.dist * 0.0000694;
  ACCT.addSession({ laps: 0, drift: c.score, dist: km });
  const ab = ACCT.bestLap(G.cfg.track);
  $('board').innerHTML = `<h2>⏱ TIME TRIAL · ${esc(G.tr.name)}</h2><div class="sum"><div><small>LAPS</small><b>${T.laps}</b></div><div><small>BEST LAP</small><b>${fmt(c.best)}</b></div><div><small>TIME DRIVEN</small><b>${fmt(driven)}</b></div><div><small>DRIFT POINTS</small><b>${c.score.toLocaleString()}</b></div><div><small>DISTANCE</small><b>${km.toFixed(2)} km</b></div><div><small>RESTARTS</small><b>${T.restarts}</b></div></div><p style="opacity:.7;text-align:center">Your all-time best here: ${fmt(ab)}</p><button class="btn primary" onclick="startSession(G.cfg,null,false)">Keep driving</button><button class="btn dark" onclick="toMenu();setTab('lb')">Leaderboards</button><button class="btn dark" onclick="toMenu()">Menu</button>`;
  $('board').classList.remove('hidden');
}

// Chequered flag: the first finisher ends the race for everyone else at their next crossing of the line (so lapped cars finish too).
function raiseFlag(name) { if (G.flag || !G.cfg || !G.cfg.laps || !G.me) return; G.flag = true; if (!G.me.finished) { pop('🏁 CHEQUERED FLAG' + (name ? ' · ' + name + ' WON' : ''), '#fff'); setTimeout(() => pop('FINISH THIS LAP TO END YOUR RACE', '#ffe14d'), 900); } }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- time trial spawn point (set per track in the dev track builder) ----------
function applySpawn(c) {
  const sp = trackDef(G.cfg.track).spawn; if (!sp || !finPt(sp.p)) return false;
  const x = sp.p[0] * G.tr.W, y = sp.p[1] * G.tr.H, r = nearestFull(G.tr, x, y);
  c.x = x; c.y = y; c.a = G.tr.dirs[r.i]; c.vx = c.vy = 0; c.hint = r.i; c.prog = r.i; c.seg = 0; c.gp = []; c.ng = 0; return true;
}
// ---------- ghosts ----------
function setGhost(rep, pick) {
  const L = decRep(rep); G.ghost = L; G.ghostCar = null; if (!L) return;
  const gc = newCar(0, G.tr, 'ghost', pick ? pick.name + ' (ghost)' : 'PB ghost', (pick && pick.color) || CFG.color);
  Object.assign(gc, carLook(pick ? { name: pick.name, color: pick.color || '#888888', body: pick.body } : CFG)); gc.finished = 1; gc.own = !pick; G.ghostCar = gc;
}
function ghostCars() {
  const gc = G.ghostCar, L = G.ghost, me = G.me; if (!gc || !L || G.state !== 'race' || !me || me.lap < 0 || me.finished) return [];
  const k = (performance.now() - me.lapStart) / 100, i = Math.floor(k); if (i < 0 || i >= L.length - 1) return [];
  const f = k - i, P = L[Math.max(0, i - 1)], A = L[i], B = L[i + 1], Q = L[Math.min(L.length - 1, i + 2)], f2 = f * f, f3 = f2 * f;
  const cr = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (3 * p1 - p0 - 3 * p2 + p3) * f3);
  const cd = (p0, p1, p2, p3) => 0.5 * ((p2 - p0) + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * f + 3 * (3 * p1 - p0 - 3 * p2 + p3) * f2);
  const a1 = A[2], a0 = a1 + angDiff(P[2], a1), a2 = a1 + angDiff(B[2], a1), a3 = a2 + angDiff(Q[2], B[2]);
  const far = Math.hypot(B[0] - A[0], B[1] - A[1]) > 300 || Math.hypot(P[0] - A[0], P[1] - A[1]) > 300 || Math.hypot(Q[0] - B[0], Q[1] - B[1]) > 300;
  if (far) { gc.x = A[0] + (B[0] - A[0]) * f; gc.y = A[1] + (B[1] - A[1]) * f; gc.a = a1 + (a2 - a1) * f; gc.vx = (B[0] - A[0]) * 10; gc.vy = (B[1] - A[1]) * 10; }
  else { gc.x = cr(P[0], A[0], B[0], Q[0]); gc.y = cr(P[1], A[1], B[1], Q[1]); gc.a = cr(a0, a1, a2, a3); gc.vx = cd(P[0], A[0], B[0], Q[0]) * 10; gc.vy = cd(P[1], A[1], B[1], Q[1]) * 10; }
  gc.speed = Math.hypot(gc.vx, gc.vy); return [gc];
}
// ---------- checkpoint deltas against your best lap ----------
function splitRef() { try { const r = JSON.parse(localStorage.getItem('md_split_' + G.cfg.track) || 'null'); return r && r.n === G.tr.n && r.k === G.tr.gates.length && Array.isArray(r.s) ? r : null; } catch (e) { return null; } }
function splitAt(j, t) { if (G.splitStart !== G.me.lapStart) { G.splitStart = G.me.lapStart; G.curSplits = []; } G.curSplits[j] = t; const r = splitRef(); if (r && r.s[j]) showDelta(t - r.s[j]); }
function showDelta(d) {
  let el = $('hDelta'); if (!el) { el = document.createElement('div'); el.id = 'hDelta'; el.style.cssText = 'position:fixed;top:78px;left:50%;transform:translateX(-50%);font-size:32px;font-weight:900;font-style:italic;font-variant-numeric:tabular-nums;text-shadow:0 3px 10px rgba(0,0,0,.85);pointer-events:none;z-index:30;transition:opacity .4s;opacity:0'; document.body.appendChild(el); }
  const r = Math.round(d); el.textContent = r === 0 ? '=0.000' : (r > 0 ? '+' : '-') + (Math.abs(r) / 1000).toFixed(3);
  el.style.color = r === 0 ? '#ffd400' : r > 0 ? '#ff3b3b' : '#3bff6b'; el.style.opacity = 1; clearTimeout(showDelta.t); showDelta.t = setTimeout(() => { el.style.opacity = 0; }, 2600);
}
function lapExtras(lt, rep, pb, sr) {
  const K = G.tr.gates.length, S = G.curSplits || [];
  if (S.length === K && S.every(x => x > 0) && (!sr || lt < sr.lap)) { try { localStorage.setItem('md_split_' + G.cfg.track, JSON.stringify({ lap: Math.round(lt), s: S.map(Math.round), n: G.tr.n, k: K })); } catch (e) { } }
  G.curSplits = []; G.splitStart = G.me.lapStart;
  if (pb && rep) { try { localStorage.setItem('md_rep_' + G.cfg.track, rep); } catch (e) { } if (G.tt && (!G.ghostCar || G.ghostCar.own)) setGhost(rep, null); }
}

// ===== Smooth remote cars: snapshot interpolation =====
// Each update carries the sender's clock. We line updates up on a steady timeline and draw other cars a
// little in the past, sliding smoothly between real positions, instead of guessing ahead and snapping back.
// Late or bunched-up packets (the main cause of jitter) no longer make cars stutter or freeze.
function bufState(r, s, now) {
  const st = typeof s[12] === 'number' ? s[12] : now, off = now - st;
  r.off = (r.off == null || off < r.off) ? off : r.off + Math.min(0.3, (off - r.off) * 0.01); // best-case delay, slowly follows clock drift
  r.jit = Math.max(off - r.off, (r.jit || 0) * 0.985); // how late packets have recently been
  const T = st + r.off, B = r.buf || (r.buf = []), L = B[B.length - 1];
  if (L && T <= L.t) return;
  B.push({ t: T, x: s[0], y: s[1], a: s[2], vx: s[3], vy: s[4] });
  while (B.length > 40) B.shift();
}
function interpRemote(r, c, now) {
  const B = r.buf; if (!B || !B.length) return;
  const delay = Math.max(95, Math.min(260, NET.rate * 1.6 + (r.jit || 0) + 10)), rt = now - delay, L = B[B.length - 1];
  let x, y, a, vx, vy;
  if (rt >= L.t) { const e = Math.min(0.2, (rt - L.t) / 1000); x = L.x + L.vx * e; y = L.y + L.vy * e; a = L.a; vx = L.vx; vy = L.vy; }
  else if (rt <= B[0].t) ({ x, y, a, vx, vy } = B[0]);
  else {
    let i = B.length - 1; while (i > 0 && B[i - 1].t > rt) i--;
    const p = B[i - 1], q = B[i], f = (rt - p.t) / Math.max(1, q.t - p.t);
    if (Math.hypot(q.x - p.x, q.y - p.y) > 400) ({ x, y, a, vx, vy } = f < 0.5 ? p : q);
    else { const s = Math.max(1, q.t - p.t) / 1000, f2 = f * f, f3 = f2 * f, h00 = 2 * f3 - 3 * f2 + 1, h10 = f3 - 2 * f2 + f, h01 = 3 * f2 - 2 * f3, h11 = f3 - f2; x = h00 * p.x + h10 * s * p.vx + h01 * q.x + h11 * s * q.vx; y = h00 * p.y + h10 * s * p.vy + h01 * q.y + h11 * s * q.vy; a = p.a + angDiff(q.a, p.a) * f; vx = p.vx + (q.vx - p.vx) * f; vy = p.vy + (q.vy - p.vy) * f; }
  }
  while (B.length > 2 && B[1].t < rt - 500) B.shift();
  c.x = x; c.y = y; c.a = a; c.vx = vx; c.vy = vy; c.speed = Math.hypot(vx, vy); c.slip = Math.abs(angDiff(Math.atan2(vy, vx), a));
}

// Forced checkpoints: the NEXT gate only counts if the car actually drives through its line
// (between the track edges, going the right way). Cutting the track or going round a gate on the run-off doesn't count.
function gateCross(c, ox, oy, now) {
  // any gate, either direction; each gate counts once per lap (c.gp = gates passed this lap)
  if (c.lap < 0) return; const g = G.tr.gates, K = g.length; if (!c.gp) c.gp = [];
  for (let k = 0; k < K; k++) {
    if (c.gp[k]) continue;
    const q = g[k], p = G.tr.pts[q.i], a = G.tr.dirs[q.i], fx = Math.cos(a), fy = Math.sin(a);
    const s0 = (ox - p[0]) * fx + (oy - p[1]) * fy, s1 = (c.x - p[0]) * fx + (c.y - p[1]) * fy;
    if (!((s0 < 0 && s1 >= 0) || (s0 > 0 && s1 <= 0))) continue;
    const t = s0 / (s0 - s1), lx = ox + (c.x - ox) * t - p[0], ly = oy + (c.y - oy) * t - p[1], lat = -lx * fy + ly * fx;
    if (Math.abs(lat) > G.tr.w / 2 + 8) continue;
    c.gp[k] = true; c.seg = c.gp.filter(Boolean).length; c.ng = c.seg; c.cpI = (q.i + 3) % G.tr.n;
    if (c === G.me) { if (G.tt) G.tt.cps++; pop('CHECKPOINT ' + c.seg + ' / ' + K, '#ffd400'); splitAt(k, now - c.lapStart); }
  }
}
// index of the first gate not yet passed this lap (the one highlighted yellow)
function nextGate(c) { const K = G.tr.gates.length, gp = (c && c.gp) || []; for (let k = 0; k < K; k++) if (!gp[k]) return k; return -1; }
