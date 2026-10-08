// ===== Game loop, race logic, rendering =====
function $(i) { return document.getElementById(i); }
const cv = $('cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; }
addEventListener('resize', resize); resize();
const COLORS = ['#ff3b3b', '#ff8c1a', '#ffd60a', '#2ecc71', '#1ec8ff', '#3d6bff', '#a24dff', '#ff3fb4', '#f2f2f2', '#33363d'];
const CFG = Object.assign({ name: 'Driver' + Math.floor(Math.random() * 900 + 100), color: COLORS[Math.floor(Math.random() * 8)], track: 0, mode: 'race', laps: 3 }, JSON.parse(localStorage.getItem('dk_cfg') || '{}'));
function saveCfg() { localStorage.setItem('dk_cfg', JSON.stringify(CFG)); }
const G = { state: 'menu', tr: null, me: null, rem: new Map(), cfg: null, mp: false, t0: 0, cdEnd: 0, res: new Map(), resList: null, firstFin: 0, final: false, rot: false, cam: { x: WORLD_W / 2, y: WORLD_H / 2, z: 0.5, a: 0 }, smoke: [], snow: [], acc: 0, last: 0, sendT: 0, hudT: 0, plist: [], attract: null, ai: 0 };
const KEYS = {};
function fmt(ms) { if (!ms) return '--'; const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return m + ':' + s.toFixed(2).padStart(5, '0'); }
function pop(t, col) { const d = document.createElement('div'); d.className = 'pop'; d.style.color = col || '#fff'; d.textContent = t; $('pops').appendChild(d); setTimeout(() => d.remove(), 1400); }
function banner(t, small) { $('banner').textContent = t; $('banner').className = small ? 'small' : ''; }
function rec(tr) { return JSON.parse(localStorage.getItem('dk_rec_' + tr) || '{}'); }
function setRec(tr, r) { localStorage.setItem('dk_rec_' + tr, JSON.stringify(r)); }
function myId() { return G.mp ? NET.myId : 'me'; }

function startSession(cfg, grid, mp) {
  G.cfg = cfg; G.mp = mp; G.tr = buildTrack(cfg.track); G.rem.clear(); G.res.clear(); G.resList = null; G.final = false; G.firstFin = 0; G.smoke = [];
  grid = grid || [myId()];
  grid.forEach((id, slot) => {
    if (id === myId()) G.me = newCar(slot, G.tr, id, CFG.name, CFG.color);
    else { const p = G.plist.find(q => q.id === id) || { name: 'Driver', color: '#888' }; G.rem.set(id, { car: newCar(slot, G.tr, id, p.name, p.color), tgt: null, raw: null }); }
  });
  G.cam.x = G.me.x; G.cam.y = G.me.y; G.cam.a = -G.me.a - Math.PI / 2;
  for (const s of ['menu', 'lobby', 'board']) $(s).classList.add('hidden');
  for (const s of ['hud', 'speedo', 'mini']) $(s).classList.remove('hidden');
  $('hLap').style.display = cfg.laps ? '' : 'none'; $('hPos').style.display = G.rem.size ? '' : 'none';
  G.state = 'countdown'; G.cdEnd = performance.now() + (cfg.laps ? 3200 : 600); G.t0 = G.cdEnd; buildMini();
  sndInit();
}
function progress(c, i, now) {
  const n = G.tr.n, f = i / n, lf = c.prog / n;
  if (f > 0.2 && f < 0.3) c.cps |= 1; if (f > 0.45 && f < 0.55) c.cps |= 2; if (f > 0.7 && f < 0.8) c.cps |= 4;
  if (lf > 0.85 && f < 0.15) {
    if (c.lap < 0) { c.lap = 0; c.lapStart = now; c.cps = 0; }
    else if (c.cps === 7) { const lt = now - c.lapStart; c.lap++; c.lapStart = now; c.lastLap = lt; if (!c.best || lt < c.best) c.best = lt; c.cps = 0; onLap(c, lt, now); }
  }
  c.prog = i;
}
function onLap(c, lt, now) {
  const r = rec(G.cfg.track); let pb = false; if (!r.lap || lt < r.lap) { r.lap = lt; pb = true; setRec(G.cfg.track, r); }
  pop((G.cfg.laps && c.lap >= G.cfg.laps ? 'FINAL LAP ' : 'LAP ') + fmt(lt) + (pb ? '  ★ PB' : ''), pb ? '#7dff9a' : '#fff');
  if (G.cfg.laps && c.lap === G.cfg.laps - 1) setTimeout(() => pop('FINAL LAP!', '#ffe14d'), 700);
  if (G.cfg.laps && c.lap >= G.cfg.laps) finishMe(now);
}
function bankDrift(c) { if (c.cur > 0) { const p = Math.round(c.cur); c.score += p; c.cur = 0; c.combo = 1; c.comboT = 0; return p; } return 0; }
function finishMe(now) {
  const c = G.me; bankDrift(c); c.finished = Math.round(now - G.t0);
  const r = rec(G.cfg.track); if (!r.score || c.score > r.score) { r.score = c.score; setRec(G.cfg.track, r); }
  banner('FINISHED!'); setTimeout(() => { if (G.state === 'race') banner(''); }, 2000);
  if (!G.mp) { G.resList = [{ id: 'me', name: c.name, color: c.color, time: c.finished, score: c.score }]; G.final = true; setTimeout(showBoard, 1500); }
  else if (NET.host) hostFin('host', c.finished, c.score);
  else { netSend({ t: 'fin', time: c.finished, score: c.score }); setTimeout(showBoard, 1500); }
}
function hostFin(id, time, score) { G.res.set(id, { time, score }); if (!G.firstFin) G.firstFin = performance.now(); hostRes(false); }
function hostRes(force) {
  const ids = ['host', ...G.rem.keys()]; const final = force || ids.every(id => G.res.has(id));
  const list = ids.map(id => { const p = id === 'host' ? { name: CFG.name, color: CFG.color } : G.rem.get(id).car; const r = G.res.get(id); return { id, name: p.name, color: p.color, time: r ? r.time : 0, score: r ? r.score : (id === 'host' ? G.me.score : G.rem.get(id).car.score) }; });
  netSend({ t: 'res', list, final }); applyRes(list, final);
}
function applyRes(list, final) { G.resList = list; G.final = final; if (final) NET.inRace = false; if (G.me.finished || final) showBoard(); }
function showBoard() {
  if (!G.resList) return; const drift = G.cfg.mode === 'drift', L = [...G.resList];
  L.sort((a, b) => drift ? b.score - a.score : (a.time || 1e12) - (b.time || 1e12));
  const r = rec(G.cfg.track);
  let h = `<h2>${G.final ? (drift ? '💨 DRIFT BATTLE RESULTS' : '🏁 RACE RESULTS') : 'RESULTS (waiting for others…)'}</h2><table>`;
  L.forEach((p, i) => { h += `<tr><td>${['🥇', '🥈', '🥉'][i] || (i + 1)}</td><td><i style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${p.color}"></i> ${esc(p.name)}</td><td>${p.time ? fmt(p.time) : (G.final ? 'DNF' : 'racing…')}</td><td>${p.score.toLocaleString()} pts</td></tr>`; });
  h += `</table><p style="opacity:.7;text-align:center">Your best on ${G.tr.name}: lap ${fmt(r.lap)} • drift ${(r.score || 0).toLocaleString()} pts</p>`;
  if (!G.mp) h += `<button class="btn green" onclick="startSession(G.cfg,null,false)">Race again</button><button class="btn blue" onclick="toMenu()">Menu</button>`;
  else if (NET.host) h += `<button class="btn green" onclick="hostToLobby()" ${G.final ? '' : 'disabled id="bWait"'}>Back to lobby</button>${G.final ? '' : '<button class="btn orange" onclick="hostRes(true)">End race now</button>'}`;
  else h += `<p style="text-align:center">${G.final ? 'Waiting for the host to start the next race…' : ''}</p>`;
  $('board').innerHTML = h; $('board').classList.remove('hidden');
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pack(c) { return [c.x | 0, c.y | 0, +c.a.toFixed(3), c.vx | 0, c.vy | 0, +c.steer.toFixed(2), (c.drift ? 1 : 0) | (c.brake ? 2 : 0) | (c.hb ? 4 : 0), c.lap, c.prog, Math.round(c.score + c.cur), c.finished | 0]; }
function applyState(id, s) {
  const r = G.rem.get(id); if (!r) return; r.raw = s; const c = r.car, now = performance.now();
  if (!r.tgt) { c.x = s[0]; c.y = s[1]; c.a = s[2]; }
  r.tgt = { x: s[0], y: s[1], a: s[2], vx: s[3], vy: s[4], t: now }; c.steer = s[5]; c.drift = !!(s[6] & 1); c.brake = !!(s[6] & 2); c.hb = !!(s[6] & 4); c.lap = s[7]; c.prog = s[8]; c.score = s[9]; c.finished = s[10];
}
function resetCar(c) { const nr = nearestFull(G.tr, c.x, c.y), p = G.tr.pts[nr.i]; c.x = p[0]; c.y = p[1]; c.a = G.tr.dirs[nr.i]; c.vx = c.vy = 0; c.hint = nr.i; c.cur = 0; c.drift = false; }
function inputs() { const k = KEYS; return { up: k.w || k.arrowup, down: k.s || k.arrowdown, left: k.a || k.arrowleft, right: k.d || k.arrowright, hb: k[' '] }; }

const STEP = 1 / 120;
function tick(ts) {
  requestAnimationFrame(tick);
  const now = performance.now(), dt = Math.min(0.05, (ts - (G.last || ts)) / 1000); G.last = ts;
  if (G.state === 'menu' || G.state === 'lobby') { renderAttract(dt); return; }
  const me = G.me, racing = G.state === 'race';
  if (G.state === 'countdown') { const left = G.cdEnd - now; banner(left > 0 ? (G.cfg.laps ? String(Math.ceil(left / 1000)) : '') : ''); if (left <= 0) { G.state = 'race'; if (G.cfg.laps) { banner('GO!'); setTimeout(() => { if ($('banner').textContent === 'GO!') banner(''); }, 900); } } }
  G.acc += dt; let inp = inputs();
  if (!racing) inp = { hb: true }; else if (me.finished) inp = { down: me.vF > 30 };
  while (G.acc >= STEP) { G.acc -= STEP; const nr = stepCar(me, inp, STEP, G.tr); if (racing && !me.finished) progress(me, nr.i, performance.now()); }
  // drift scoring
  if (racing && !me.finished) {
    if (me.drift && me.speed > 250 && !me.off) { me.cur += Math.abs(me.slip) * me.speed * dt * 0.12 * me.combo; me.comboT += dt; me.idle = 0; if (me.comboT > 1.6 && me.combo < 5) { me.comboT = 0; me.combo++; pop('COMBO x' + me.combo, '#ff5fd0'); } }
    else if (me.cur > 0) { if (me.off) { pop('DRIFT FAILED', '#ff6060'); me.cur = 0; me.combo = 1; me.comboT = 0; } else { me.idle += dt; if (me.idle > 0.9) { const p = bankDrift(me); if (p > 20) pop('+' + p.toLocaleString() + (p > 3000 ? '  INSANE!' : p > 1200 ? '  GREAT DRIFT' : ''), '#ffe14d'); } } }
    const d = G.tr.dirs[me.hint], fwdTrack = me.vx * Math.cos(d) + me.vy * Math.sin(d); me.wrong = fwdTrack < -120 ? me.wrong + dt : 0;
  }
  // remote cars
  for (const [id, r] of G.rem) { if (!r.tgt) continue; const c = r.car, age = Math.min(0.25, (now - r.tgt.t) / 1000), px = r.tgt.x + r.tgt.vx * age, py = r.tgt.y + r.tgt.vy * age, k = Math.min(1, dt * 14);
    if (Math.hypot(px - c.x, py - c.y) > 400) { c.x = px; c.y = py; } else { c.x += (px - c.x) * k; c.y += (py - c.y) * k; } c.a += angDiff(r.tgt.a, c.a) * k; c.vx = r.tgt.vx; c.vy = r.tgt.vy; c.speed = Math.hypot(c.vx, c.vy); c.slip = Math.abs(angDiff(Math.atan2(c.vy, c.vx), c.a));
    const dx = me.x - c.x, dy = me.y - c.y, dd = Math.hypot(dx, dy); if (dd < 44 && dd > 0.01 && racing) { const nx = dx / dd, ny = dy / dd; me.x += nx * (44 - dd); me.y += ny * (44 - dd); const rv = (me.vx - c.vx) * nx + (me.vy - c.vy) * ny; if (rv < 0) { me.vx -= rv * 1.3 * nx; me.vy -= rv * 1.3 * ny; } if (me.cur > 200) { pop('CONTACT! DRIFT LOST', '#ff6060'); me.cur = 0; me.combo = 1; } } }
  // network
  if (G.mp && now - G.sendT > 66) { G.sendT = now; const s = pack(me); if (NET.host) { const list = [['host', ...s]]; for (const [id, r] of G.rem) if (r.raw) list.push([id, ...r.raw]); netSend({ t: 'all', list }); if (G.firstFin && !G.final && now - G.firstFin > 30000) hostRes(true); } else netSend({ t: 'st', s }); }
  effects(dt); render(dt, now); hud(now); sndUpdate(me, true);
}
function effects(dt) {
  const tg = G.tr.canvas.getContext('2d'), snow = G.tr.th.snow;
  for (const c of [G.me, ...[...G.rem.values()].map(r => r.car)]) {
    const sliding = (c.drift || c.hb || (c.brake && c.speed > 500)) && c.speed > 120;
    if (sliding) { const w = wheelPos(c); if (c.rwL) { tg.strokeStyle = snow ? 'rgba(110,120,135,.35)' : 'rgba(15,15,18,.32)'; tg.lineWidth = 7; tg.lineCap = 'round'; tg.beginPath(); tg.moveTo(c.rwL[0], c.rwL[1]); tg.lineTo(w[0][0], w[0][1]); tg.moveTo(c.rwR[0], c.rwR[1]); tg.lineTo(w[1][0], w[1][1]); tg.stroke(); } c.rwL = w[0]; c.rwR = w[1];
      if (G.smoke.length < 450) for (const p of w) if (Math.random() < 0.8) G.smoke.push({ x: p[0], y: p[1], vx: (Math.random() - 0.5) * 40 - c.vx * 0.05, vy: (Math.random() - 0.5) * 40 - c.vy * 0.05, r: 8, life: 0, max: 0.9 + Math.random() * 0.8 }); }
    else c.rwL = c.rwR = null;
  }
  G.smoke = G.smoke.filter(p => (p.life += dt) < p.max); for (const p of G.smoke) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += 38 * dt; }
}
