// ===== Rendering, HUD, minimap, menu background =====
function worldToScreen(cam, x, y) { let dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z; if (G.rot && G.state !== 'menu' && G.state !== 'lobby') { const c = Math.cos(cam.a), s = Math.sin(cam.a); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; } return [VW / 2 + dx, VH / 2 + dy]; }
function drawWorld(tr, cam, cars, rot) {
  const th = tr.th, night = !!th.night;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = shadeHex(th.grass, 0.55); ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(VW / 2, VH / 2); if (rot) ctx.rotate(cam.a); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const hd = Math.hypot(VW, VH) / 2 / cam.z + 20, sx = Math.max(0, cam.x - hd), sy = Math.max(0, cam.y - hd), sw = Math.min(tr.W || WORLD_W, cam.x + hd) - sx, sh = Math.min(tr.H || WORLD_H, cam.y + hd) - sy, bs = tr.bs || 1;
  if (sw > 0 && sh > 0) { ctx.drawImage(tr.canvas, sx * bs, sy * bs, sw * bs, sh * bs, sx, sy, sw, sh); if (bs < 0.99) drawRoadLive(ctx, tr, sx, sy, sx + sw, sy + sh); drawSkids(tr, sx, sy, sw, sh); if (night) { ctx.fillStyle = 'rgba(4,6,22,.55)'; ctx.fillRect(sx, sy, sw, sh); } }
  const inGame = G.state !== 'menu' && G.state !== 'lobby', tT = inGame ? (G.tunT || 0) : 0;
  drawWalls(ctx, tr);
  if (tT > 0.01 && sw > 0) { ctx.fillStyle = `rgba(2,3,12,${0.58 * tT})`; ctx.fillRect(sx, sy, sw, sh); }
  drawTunnelFloor(ctx, tr);
  if (CFG.gfx.gates && G.state !== 'menu' && G.state !== 'lobby') drawGates(tr);
  if (G.smoke.length) { const sp = puffSprite(night); for (const p of G.smoke) { if (p.x + p.r < sx || p.y + p.r < sy || p.x - p.r > sx + sw || p.y - p.r > sy + sh) continue; ctx.globalAlpha = (1 - p.life / p.max) * 0.55; ctx.drawImage(sp, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); } ctx.globalAlpha = 1; }
  const dc = c => { if (c.finished && (G.state === 'race' || G.state === 'countdown' || G.state === 'over')) { drawFaded(c); } else drawCar(ctx, c, night); };
  const hi = []; for (const c of cars) { if (carLayer(tr, c) === 1) hi.push(c); else dc(c); }
  drawTunnelRoof(ctx, tr, 0.9 - 0.75 * tT); drawBridges(ctx, tr); hi.forEach(dc);
  ctx.restore();
  ctx.font = '700 13px Segoe UI, system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const c of cars) { if (!c.name || c === G.me) continue; const [x, y] = worldToScreen(cam, c.x, c.y); const w = ctx.measureText(c.name).width + 14; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 52, w, 20, 8); ctx.fill(); ctx.fillStyle = c.color; ctx.fillRect(x - w / 2 + 4, y - 35, w - 8, 2); ctx.fillStyle = '#fff'; ctx.fillText(c.name, x, y - 37); }
  if (th.snow && CFG.gfx.weather) { if (!G.snow.length) for (let i = 0; i < 140; i++) G.snow.push([Math.random() * 2000, Math.random() * 1200, 1 + Math.random() * 2.5]); ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const f of G.snow) { f[1] += f[2] * 0.9; f[0] += Math.sin(f[1] * 0.01) * 0.6; if (f[1] > VH) { f[1] = -5; f[0] = Math.random() * VW; } ctx.beginPath(); ctx.arc(f[0] % VW, f[1], f[2], 0, 7); ctx.fill(); } }
  if (CFG.gfx.vignette) { let vg = G.vg; if (!vg || G.vgK !== VW + 'x' + VH) { vg = G.vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.45, VW / 2, VH / 2, Math.hypot(VW, VH) * 0.6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); G.vgK = VW + 'x' + VH; } ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH); }
}
function render(dt) {
  const me = G.me, rx = me.x, ry = me.y, ra = me.a, al = Math.max(0, Math.min(1, G.acc / STEP));
  if (me.px != null && Math.hypot(me.x - me.px, me.y - me.py) < 120) { me.x = me.px + (rx - me.px) * al; me.y = me.py + (ry - me.py) * al; me.a = me.pa + angDiff(ra, me.pa) * al; }
  try { renderInner(dt, me); } finally { me.x = rx; me.y = ry; me.a = ra; }
}
function renderInner(dt, me) {
  const cam = G.cam, base = Math.min(VW, VH) / 820, zt = base * (1.08 - Math.min(1, me.speed / CAR.MAXS) * 0.32) * (1 + 0.4 * (G.tunT = (G.tunT || 0) + ((me.layer === -1 ? 1 : 0) - (G.tunT || 0)) * Math.min(1, dt * 3))), k = 1 - Math.exp(-dt * 6);
  cam.z += (zt - cam.z) * (1 - Math.exp(-dt * 2)); cam.x += (me.x + me.vx * 0.3 - cam.x) * k; cam.y += (me.y + me.vy * 0.3 - cam.y) * k;
  if (G.rot) cam.a += angDiff(-me.a - Math.PI / 2, cam.a) * (1 - Math.exp(-dt * 4));
  drawWorld(G.tr, cam, [...ghostCars(), ...[...G.rem.values()].map(r => r.car), me], G.rot);
  drawMini();
  if (CFG.gfx.fps) { G.fps = (G.fps || 60) * 0.94 + (1 / Math.max(dt, 1e-3)) * 0.06; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '700 12px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(Math.round(G.fps) + ' FPS', 14, VH - 14); }
}
function drawGates(tr) {
  const me = G.me, live = me && me.lap >= 0, nx = me ? nextGate(me) + 1 : -1, t = performance.now() / 1000, hw = tr.w / 2;
  ctx.save(); ctx.lineCap = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 18px Segoe UI, system-ui, sans-serif';
  for (const g of tr.gates) {
    const p = tr.pts[g.i], a = tr.dirs[g.i], px = -Math.sin(a), py = Math.cos(a), next = live && g.s === nx, done = live && !!(me.gp && me.gp[g.s - 1]);
    const col = next ? '#ffd400' : done ? '#6b6b73' : '#ff2a2a', al = next ? 0.8 + 0.2 * Math.sin(t * 7) : done ? 0.35 : 0.8;
    ctx.globalAlpha = al * 0.6; ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.setLineDash([22, 16]);
    ctx.beginPath(); ctx.moveTo(p[0] - px * hw, p[1] - py * hw); ctx.lineTo(p[0] + px * hw, p[1] + py * hw); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = al;
    for (const sd of [-1, 1]) {
      const x = p[0] + px * (hw + 18) * sd, y = p[1] + py * (hw + 18) * sd;
      if (next) { ctx.fillStyle = 'rgba(255,212,0,.25)'; ctx.beginPath(); ctx.arc(x, y, 26 + 4 * Math.sin(t * 7), 0, 7); ctx.fill(); }
      ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#0b0b0d'; ctx.fillText(g.s, x, y + 1);
    }
  }
  ctx.restore();
}
function posOf(c) { const n = G.tr.n; if (G.cfg.mode === 'drift') return c.score + c.cur; return c.finished ? 1e9 - c.finished : (c.lap < 0 ? c.prog - n : c.lap * n + c.prog); }
function hud(now) {
  const T = (e, v) => { v = String(v); if (e._t !== v) { e._t = v; e.textContent = v; } };
  const me = G.me, d = $('driftBox');
  if (me.cur > 0) { d.classList.remove('hidden'); T($('dPts'), Math.round(me.cur).toLocaleString()); T($('dCombo'), 'x' + me.combo + (me.off ? ' ⚠' : '')); } else d.classList.add('hidden');
  if (now - G.hudT < 90) return; G.hudT = now;
  T($('spd'), Math.round(me.speed * 0.25));
  const L = G.cfg.laps; T($('hLap').querySelector('b'), G.tt ? (G.tt.laps + 1) + ' / ∞' : Math.min(L, Math.max(1, me.lap + 1)) + '/' + L);
  const t = G.tt ? (G.state === 'race' && me.lap >= 0 ? now - me.lapStart : 0) : me.finished || (G.state === 'race' ? now - G.t0 : 0); T($('hTime').querySelector('b'), fmt(t) === '--' ? '0:00.000' : fmt(t));
  T($('hBest').querySelector('b'), fmt(me.best)); T($('hScore').querySelector('b'), me.score.toLocaleString());
  if (G.rem.size) { const all = [me, ...[...G.rem.values()].map(r => r.car)], m = posOf(me); T($('hPos').querySelector('b'), (1 + all.filter(c => c !== me && posOf(c) > m).length) + '/' + all.length); }
  const b = $('banner'); if (me.wrong > 1) banner('⚠ WRONG WAY', true); else if (b.textContent === '⚠ WRONG WAY') banner('');
}
let MINI = null;
function buildMini() { const c = document.createElement('canvas'); c.width = 220; c.height = 160; const g = c.getContext('2d'), s = Math.min(200 / (G.tr.W || WORLD_W), 140 / (G.tr.H || WORLD_H)); g.translate(10, 10); g.scale(s, s); g.lineJoin = 'round'; pathTrack(g, G.tr); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(G.tr.w + 60, 7 / s); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(G.tr.w * 0.55, 3 / s); g.stroke(); MINI = { c, s }; }
function drawMini() {
  const m = $('mini').getContext('2d'); m.clearRect(0, 0, 220, 160); m.drawImage(MINI.c, 0, 0);
  const p0 = G.tr.pts[0]; m.fillStyle = '#fff'; m.fillRect(10 + p0[0] * MINI.s - 3, 10 + p0[1] * MINI.s - 3, 6, 6);
  if (CFG.gfx.gates && G.tr.gates) { const nx = nextGate(G.me) + 1, gp = G.me.gp || []; for (const g of G.tr.gates) { const p = G.tr.pts[g.i]; m.fillStyle = G.me.lap >= 0 && gp[g.s - 1] ? 'rgba(120,120,128,.55)' : g.s === nx && G.me.lap >= 0 ? '#ffd400' : 'rgba(255,42,42,.9)'; m.beginPath(); m.arc(10 + p[0] * MINI.s, 10 + p[1] * MINI.s, 3.2, 0, 7); m.fill(); } }
  for (const c of [...[...G.rem.values()].map(r => r.car), G.me]) { m.fillStyle = c.color; m.strokeStyle = c === G.me ? '#fff' : '#000'; m.lineWidth = 2; m.beginPath(); m.arc(10 + c.x * MINI.s, 10 + c.y * MINI.s, c === G.me ? 6 : 5, 0, 7); m.fill(); m.stroke(); }
}
function renderAttract(dt) {
  if (!G.attract || G.attract.idx !== CFG.track) { G.attract = { idx: CFG.track, tr: buildTrack(CFG.track), i: 0 }; }
  const A = G.attract, tr = A.tr; A.i = (A.i + dt * 38) % tr.n; const i = Math.floor(A.i), p = tr.pts[i], d = tr.dirs[i], d2 = tr.dirs[(i + 25) % tr.n], turn = angDiff(d2, d);
  const car = { x: p[0], y: p[1], a: d + Math.max(-0.7, Math.min(0.7, turn * 2.2)), steer: -Math.sign(turn) * 0.8, brake: false, ...carLook(CFG) };
  const cam = { x: p[0], y: p[1], z: Math.min(VW, VH) / 1100, a: 0 };
  drawWorld(tr, cam, [car], false);
}
function toMenu() {
  if (G.mp) netLeave(); G.mp = false; G.state = 'menu'; G.snow = [];
  for (const s of ['hud', 'speedo', 'mini', 'board', 'driftBox', 'lobby', 'hKeys']) $(s).classList.add('hidden'); $('menu').classList.remove('hidden'); banner(''); if (window.refreshMenu) refreshMenu(); sndUpdate({ speed: 0 }, false);
}
function hostToLobby() { NET.inRace = false; G.state = 'lobby'; netLobby(); }

// ---------- skid marks live in small 512px tiles, so drifting never re-uploads the whole track image ----------
const SKT = 512;
function skidSeg(a, b, snow) {
  const tr = G.tr; if (!tr || !a || !b) return; const S = tr.skid || (tr.skid = new Map()), ks = Math.min(1, tr.bs || 1);
  const x0 = Math.floor((Math.min(a[0], b[0]) - 5) / SKT), x1 = Math.floor((Math.max(a[0], b[0]) + 5) / SKT), y0 = Math.floor((Math.min(a[1], b[1]) - 5) / SKT), y1 = Math.floor((Math.max(a[1], b[1]) + 5) / SKT);
  for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
    const key = tx + ',' + ty; let t = S.get(key);
    if (!t) { const c = document.createElement('canvas'); c.width = c.height = Math.ceil(SKT * ks); const g = c.getContext('2d'); g.scale(ks, ks); g.translate(-tx * SKT, -ty * SKT); g.lineCap = 'round'; g.lineWidth = 7; t = { c, g, tx, ty }; S.set(key, t); }
    t.g.strokeStyle = snow ? 'rgba(110,120,135,.35)' : 'rgba(15,15,18,.32)'; t.g.beginPath(); t.g.moveTo(a[0], a[1]); t.g.lineTo(b[0], b[1]); t.g.stroke();
  }
}
function drawSkids(tr, sx, sy, sw, sh) {
  const S = tr.skid; if (!S || !S.size) return;
  for (let tx = Math.floor(sx / SKT); tx <= Math.floor((sx + sw) / SKT); tx++) for (let ty = Math.floor(sy / SKT); ty <= Math.floor((sy + sh) / SKT); ty++) { const t = S.get(tx + ',' + ty); if (t) ctx.drawImage(t.c, tx * SKT, ty * SKT, SKT, SKT); }
}
// ---------- ghost / finished cars: drawn once into a sprite, then stamped with transparency ----------
const FADED = new Map();
function drawFaded(c) {
  const key = [c.body, c.color, c.livery, c.num, c.name].join('|'); let s = FADED.get(key);
  if (!s) { const K = 3, c2 = document.createElement('canvas'); c2.width = 200 * K; c2.height = 120 * K; const g = c2.getContext('2d'); g.scale(K, K); g.translate(100, 60);
    drawCar(g, Object.assign({}, c, { x: 0, y: 0, a: 0, steer: 0, brake: false, hb: false, drift: false, thr: false }), false); s = c2; if (FADED.size > 30) FADED.clear(); FADED.set(key, s); }
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.a); ctx.globalAlpha = 0.38; ctx.drawImage(s, -100, -60, 200, 120); ctx.restore();
}

// soft smoke puff, drawn once
const PUFF = {};
function puffSprite(night) {
  const k = night ? 'n' : 'd'; if (PUFF[k]) return PUFF[k];
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32), col = night ? '170,180,230' : '238,238,242';
  gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.55, `rgba(${col},.75)`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return PUFF[k] = c;
}
