// ===== Rendering, HUD, minimap, menu background =====
function worldToScreen(cam, x, y) { let dx = (x - cam.x) * cam.z, dy = (y - cam.y) * cam.z; if (G.rot && G.state !== 'menu' && G.state !== 'lobby') { const c = Math.cos(cam.a), s = Math.sin(cam.a); [dx, dy] = [dx * c - dy * s, dx * s + dy * c]; } return [VW / 2 + dx, VH / 2 + dy]; }
function drawWorld(tr, cam, cars, rot) {
  const th = tr.th, night = !!th.night;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = shadeHex(th.grass, 0.55); ctx.fillRect(0, 0, VW, VH);
  ctx.save(); ctx.translate(VW / 2, VH / 2); if (rot) ctx.rotate(cam.a); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  const hd = Math.hypot(VW, VH) / 2 / cam.z + 20, sx = Math.max(0, cam.x - hd), sy = Math.max(0, cam.y - hd), sw = Math.min(tr.W || WORLD_W, cam.x + hd) - sx, sh = Math.min(tr.H || WORLD_H, cam.y + hd) - sy, bs = tr.bs || 1;
  if (sw > 0 && sh > 0) { ctx.drawImage(tr.canvas, sx * bs, sy * bs, sw * bs, sh * bs, sx, sy, sw, sh); if (bs < 0.99) drawRoadLive(ctx, tr, sx, sy, sx + sw, sy + sh); if (night) { ctx.fillStyle = 'rgba(4,6,22,.55)'; ctx.fillRect(sx, sy, sw, sh); } }
  drawWalls(ctx, tr);
  if (CFG.gfx.gates && G.state !== 'menu' && G.state !== 'lobby') drawGates(tr);
  for (const p of G.smoke) { const a = (1 - p.life / p.max) * 0.32; ctx.fillStyle = night ? `rgba(170,180,230,${a})` : `rgba(238,238,242,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  for (const c of cars) { if (c.finished && (G.state === 'race' || G.state === 'countdown' || G.state === 'over')) { ctx.globalAlpha = 0.35; drawCar(ctx, c, night); ctx.globalAlpha = 1; } else drawCar(ctx, c, night); }
  ctx.restore();
  ctx.font = '700 13px Segoe UI, system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const c of cars) { if (!c.name || c === G.me) continue; const [x, y] = worldToScreen(cam, c.x, c.y); const w = ctx.measureText(c.name).width + 14; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 52, w, 20, 8); ctx.fill(); ctx.fillStyle = c.color; ctx.fillRect(x - w / 2 + 4, y - 35, w - 8, 2); ctx.fillStyle = '#fff'; ctx.fillText(c.name, x, y - 37); }
  if (th.snow && CFG.gfx.weather) { if (!G.snow.length) for (let i = 0; i < 140; i++) G.snow.push([Math.random() * 2000, Math.random() * 1200, 1 + Math.random() * 2.5]); ctx.fillStyle = 'rgba(255,255,255,.85)'; for (const f of G.snow) { f[1] += f[2] * 0.9; f[0] += Math.sin(f[1] * 0.01) * 0.6; if (f[1] > VH) { f[1] = -5; f[0] = Math.random() * VW; } ctx.beginPath(); ctx.arc(f[0] % VW, f[1], f[2], 0, 7); ctx.fill(); } }
  if (CFG.gfx.vignette) { const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.45, VW / 2, VH / 2, Math.hypot(VW, VH) * 0.6); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.4)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH); }
}
function render(dt) {
  const me = G.me, cam = G.cam, base = Math.min(VW, VH) / 820, zt = base * (1.08 - Math.min(1, me.speed / CAR.MAXS) * 0.32), k = Math.min(1, dt * 6);
  cam.z += (zt - cam.z) * Math.min(1, dt * 2); cam.x += (me.x + me.vx * 0.3 - cam.x) * k; cam.y += (me.y + me.vy * 0.3 - cam.y) * k;
  if (G.rot) cam.a += angDiff(-me.a - Math.PI / 2, cam.a) * Math.min(1, dt * 4);
  drawWorld(G.tr, cam, [...[...G.rem.values()].map(r => r.car), me], G.rot);
  drawMini();
  if (CFG.gfx.fps) { G.fps = (G.fps || 60) * 0.94 + (1 / Math.max(dt, 1e-3)) * 0.06; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '700 12px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(Math.round(G.fps) + ' FPS', 14, VH - 14); }
}
function drawGates(tr) {
  const me = G.me, live = me && me.lap >= 0, nx = me ? (me.seg + 1) % 8 : -1, t = performance.now() / 1000, hw = tr.w / 2;
  ctx.save(); ctx.lineCap = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 18px Segoe UI, system-ui, sans-serif';
  for (const g of tr.gates) {
    const p = tr.pts[g.i], a = tr.dirs[g.i], px = -Math.sin(a), py = Math.cos(a), next = live && g.s === nx, done = live && g.s <= me.seg;
    const col = next ? '#ffd400' : done ? '#3ddc84' : '#ff2a2a', al = next ? 0.8 + 0.2 * Math.sin(t * 7) : done ? 0.5 : 0.8;
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
  const me = G.me, d = $('driftBox');
  if (me.cur > 0) { d.classList.remove('hidden'); $('dPts').textContent = Math.round(me.cur).toLocaleString(); $('dCombo').textContent = 'x' + me.combo + (me.off ? ' ⚠' : ''); } else d.classList.add('hidden');
  if (now - G.hudT < 90) return; G.hudT = now;
  $('spd').textContent = Math.round(me.speed * 0.25);
  const L = G.cfg.laps; $('hLap').querySelector('b').textContent = G.tt ? (G.tt.laps + 1) + ' / ∞' : Math.min(L, Math.max(1, me.lap + 1)) + '/' + L;
  const t = G.tt ? (G.state === 'race' && me.lap >= 0 ? now - me.lapStart : 0) : me.finished || (G.state === 'race' ? now - G.t0 : 0); $('hTime').querySelector('b').textContent = fmt(t) === '--' ? '0:00.000' : fmt(t);
  $('hBest').querySelector('b').textContent = fmt(me.best); $('hScore').querySelector('b').textContent = me.score.toLocaleString();
  if (G.rem.size) { const all = [me, ...[...G.rem.values()].map(r => r.car)], m = posOf(me); $('hPos').querySelector('b').textContent = (1 + all.filter(c => c !== me && posOf(c) > m).length) + '/' + all.length; }
  const b = $('banner'); if (me.wrong > 1) banner('⚠ WRONG WAY', true); else if (b.textContent === '⚠ WRONG WAY') banner('');
}
let MINI = null;
function buildMini() { const c = document.createElement('canvas'); c.width = 220; c.height = 160; const g = c.getContext('2d'), s = Math.min(200 / (G.tr.W || WORLD_W), 140 / (G.tr.H || WORLD_H)); g.translate(10, 10); g.scale(s, s); g.lineJoin = 'round'; pathTrack(g, G.tr); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = Math.max(G.tr.w + 60, 7 / s); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(G.tr.w * 0.55, 3 / s); g.stroke(); MINI = { c, s }; }
function drawMini() {
  const m = $('mini').getContext('2d'); m.clearRect(0, 0, 220, 160); m.drawImage(MINI.c, 0, 0);
  const p0 = G.tr.pts[0]; m.fillStyle = '#fff'; m.fillRect(10 + p0[0] * MINI.s - 3, 10 + p0[1] * MINI.s - 3, 6, 6);
  if (CFG.gfx.gates && G.tr.gates) { const nx = G.me.seg + 1; for (const g of G.tr.gates) { const p = G.tr.pts[g.i]; m.fillStyle = g.s === nx && G.me.lap >= 0 ? '#ffd400' : 'rgba(255,42,42,.9)'; m.beginPath(); m.arc(10 + p[0] * MINI.s, 10 + p[1] * MINI.s, 3.2, 0, 7); m.fill(); } }
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
