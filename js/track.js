// ===== Tracks: spline centreline, baked scenery canvas, nearest-point queries =====
let WORLD_W = 4400, WORLD_H = 3200; // per-track: def.world
function useWorld(tr) { WORLD_W = tr.W; WORLD_H = tr.H; }
// Barriers sit this far outside the track edge: room to run wide, only blocks big shortcuts. Per-track override: barrierGap.
const BARRIER_GAP = 230;
function barrierGap(tr) { return tr.def.barrierGap || BARRIER_GAP; }
const TRACKS = [
  { name: 'Sunset Circuit', width: 170, pts: [[0.12, 0.55], [0.14, 0.25], [0.3, 0.12], [0.5, 0.18], [0.62, 0.36], [0.76, 0.16], [0.9, 0.24], [0.9, 0.52], [0.76, 0.62], [0.88, 0.8], [0.7, 0.9], [0.5, 0.78], [0.36, 0.9], [0.18, 0.85]],
    th: { grass: '#4c8c3c', grass2: '#5a9c47', road: '#3a3c42', sand: '#d8c48f', tree: ['#2f6e2a', '#3f8a35'] } },
  { name: 'Neon Docks', width: 160, pts: [[0.1, 0.2], [0.35, 0.1], [0.52, 0.22], [0.42, 0.42], [0.6, 0.5], [0.72, 0.15], [0.9, 0.18], [0.92, 0.5], [0.8, 0.62], [0.9, 0.86], [0.6, 0.9], [0.48, 0.72], [0.3, 0.88], [0.1, 0.8], [0.18, 0.55], [0.08, 0.42]],
    th: { grass: '#2b3346', grass2: '#323b52', road: '#26272d', sand: '#4a5068', tree: ['#1f6f8b', '#2d8fb0'], night: true } },
  { name: 'Snowpeak Hairpins', width: 150, pts: [[0.1, 0.5], [0.12, 0.12], [0.3, 0.1], [0.32, 0.4], [0.45, 0.42], [0.47, 0.1], [0.68, 0.1], [0.7, 0.42], [0.9, 0.4], [0.9, 0.88], [0.62, 0.9], [0.6, 0.65], [0.42, 0.66], [0.4, 0.9], [0.14, 0.88]],
    th: { grass: '#dfe8ef', grass2: '#eef3f7', road: '#4a4d55', sand: '#b9c6d2', tree: ['#2c5a3f', '#3c7452'], snow: true } },
  // Real layout from GPS outline (bacinger/f1-circuits mc-1929), 12 px per metre (tuned so a clean lap is about 1:10, like an F1 pole lap), 64 control points
  { name: 'Monaco', width: 110, world: [10338, 13198], bakeScale: 0.5, pxm: 12, barrierGap: 48, runoff: 40, pts: [[0.6307,0.2305],[0.6314,0.2132],[0.6445,0.1941],[0.7717,0.0599],[0.782,0.0576],[0.8034,0.0661],[0.8123,0.1],[0.8455,0.1444],[0.8554,0.1497],[0.8692,0.1378],[0.8307,0.1015],[0.8269,0.0891],[0.8317,0.0801],[0.8988,0.0609],[0.9233,0.0633],[0.9235,0.1339],[0.8994,0.2353],[0.8621,0.2956],[0.7959,0.3562],[0.7399,0.3831],[0.6422,0.4195],[0.5989,0.4313],[0.4721,0.4514],[0.464,0.4707],[0.4547,0.4732],[0.4417,0.4749],[0.4193,0.4681],[0.1702,0.4959],[0.1522,0.5185],[0.1322,0.5632],[0.1289,0.6273],[0.167,0.6618],[0.1906,0.7642],[0.1861,0.7742],[0.1676,0.7828],[0.1672,0.7984],[0.1874,0.8408],[0.2139,0.874],[0.235,0.8907],[0.2765,0.907],[0.2859,0.9227],[0.2757,0.9326],[0.2215,0.9422],[0.1974,0.9411],[0.1858,0.9333],[0.1806,0.9102],[0.1354,0.8596],[0.0902,0.7394],[0.0786,0.6787],[0.0735,0.6014],[0.0785,0.5538],[0.0955,0.5042],[0.0945,0.4841],[0.1255,0.4728],[0.2308,0.4624],[0.3492,0.4358],[0.4147,0.4291],[0.5221,0.3924],[0.6407,0.3733],[0.6798,0.3481],[0.6901,0.3356],[0.6939,0.3087],[0.6757,0.268],[0.6368,0.2411]],
    th: { grass: '#8d8c86', grass2: '#a09e96', road: '#3b3d44', sand: '#b9b5aa', tree: ['#2f6e2a', '#3f8a35'], city: true } },
];
function crPoint(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return [0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]; }
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function buildTrack(idx, noBake) {
  const def = TRACKS[idx]; WORLD_W = def.world ? def.world[0] : 4400; WORLD_H = def.world ? def.world[1] : 3200;
  const cp = def.pts.map(p => [p[0] * WORLD_W, p[1] * WORLD_H]), raw = [];
  for (let i = 0; i < cp.length; i++) { const p0 = cp[(i - 1 + cp.length) % cp.length], p1 = cp[i], p2 = cp[(i + 1) % cp.length], p3 = cp[(i + 2) % cp.length]; for (let k = 0; k < 60; k++) raw.push(crPoint(p0, p1, p2, p3, k / 60)); }
  // resample to even spacing (~12px)
  let L = 0; const cum = [0]; for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L); }
  const N = Math.round(L / 12), pts = []; let j = 0;
  for (let k = 0; k < N; k++) { const d = k * L / N; while (cum[j + 1] < d) j++; const a = raw[j], b = raw[(j + 1) % raw.length], f = (d - cum[j]) / (cum[j + 1] - cum[j] || 1); pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
  const dirs = pts.map((p, i) => { const q = pts[(i + 1) % N], r = pts[(i - 1 + N) % N]; return Math.atan2(q[1] - r[1], q[0] - r[0]); });
  const tr = { idx, def, name: def.name, w: def.width, pts, dirs, n: N, len: L, th: def.th, W: WORLD_W, H: WORLD_H, bs: def.bakeScale || 1 };
  tr.canvas = noBake ? null : bakeTrack(tr); return tr;
}
function pathTrack(g, tr) { g.beginPath(); tr.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); }
function bakeTrack(tr) {
  const c = document.createElement('canvas'); c.width = Math.round(WORLD_W * tr.bs); c.height = Math.round(WORLD_H * tr.bs); const g = c.getContext('2d'), th = tr.th, R = rnd(tr.idx * 977 + 13); g.scale(tr.bs, tr.bs);
  g.fillStyle = th.grass; g.fillRect(0, 0, WORLD_W, WORLD_H);
  for (let i = 0; i < 2600; i++) { g.fillStyle = R() < 0.5 ? th.grass2 : 'rgba(0,0,0,.05)'; g.globalAlpha = 0.35; g.beginPath(); g.arc(R() * WORLD_W, R() * WORLD_H, 20 + R() * 90, 0, 7); g.fill(); }
  g.globalAlpha = 1; g.lineJoin = g.lineCap = 'round';
  // runoff, kerbs, road
  pathTrack(g, tr); g.strokeStyle = th.sand; g.lineWidth = tr.w + (tr.def.runoff || 110); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = tr.w + 34; g.stroke();
  g.strokeStyle = '#f2f2f2'; g.lineWidth = tr.w + 26; g.stroke();
  g.setLineDash([34, 34]); g.strokeStyle = th.night ? '#ff2fb0' : '#d8262f'; g.stroke(); g.setLineDash([]);
  g.strokeStyle = th.road; g.lineWidth = tr.w; g.stroke();
  // asphalt grain
  g.save(); pathTrack(g, tr); g.lineWidth = tr.w; g.strokeStyle = '#000'; g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < tr.n; i += 2) { const p = tr.pts[i]; for (let k = 0; k < 3; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.06)'; g.fillRect(p[0] + (R() - 0.5) * tr.w, p[1] + (R() - 0.5) * tr.w, 3, 3); } }
  g.restore();
  // edge lines + centre dashes
  pathTrack(g, tr); g.setLineDash([40, 50]); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.stroke(); g.setLineDash([]);
  // start / finish checker
  const p0 = tr.pts[0], a0 = tr.dirs[0], nx = -Math.sin(a0), ny = Math.cos(a0), sq = tr.w / 10;
  g.save(); g.translate(p0[0], p0[1]); g.rotate(a0); for (let r = 0; r < 2; r++) for (let k = 0; k < 10; k++) { g.fillStyle = (r + k) % 2 ? '#111' : '#fff'; g.fillRect(-sq + r * sq, -tr.w / 2 + k * sq, sq, sq); } g.restore();
  // grid boxes
  for (let s = 0; s < 8; s++) { const gp = gridSlot(tr, s); g.save(); g.translate(gp.x, gp.y); g.rotate(gp.a); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(34, -24); g.lineTo(40, -24); g.lineTo(40, 24); g.lineTo(34, 24); g.stroke(); g.restore(); }
  // grandstand near start
  { let side = 0; for (const sd of [1, -1]) { const cx = p0[0] + nx * (tr.w / 2 + 120) * sd, cy = p0[1] + ny * (tr.w / 2 + 120) * sd, fx = Math.cos(a0), fy = Math.sin(a0); let ok = true; for (const u of [-200, -100, 0, 100, 200]) for (const v of [-40, 0, 40]) if (nearestFull(tr, cx + fx * u + nx * v, cy + fy * u + ny * v).d < tr.w / 2 + 25) ok = false; if (ok) { side = sd; break; } } const gx = p0[0] + nx * (tr.w / 2 + 120) * side, gy = p0[1] + ny * (tr.w / 2 + 120) * side; if (side)  g.save(); g.translate(gx, gy); g.rotate(a0); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-190, -30, 400, 80); g.fillStyle = '#8a8f99'; g.fillRect(-200, -40, 400, 80); for (let i = 0; i < 260; i++) { g.fillStyle = ['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1', '#9b59b6', '#2ecc71'][Math.floor(R() * 6)]; g.beginPath(); g.arc(-190 + R() * 380, -30 + R() * 60, 4, 0, 7); g.fill(); } g.fillStyle = th.night ? '#ff2fb0' : '#d8262f'; g.fillRect(-200, -52, 400, 14); g.restore(); }
  // trees / props off-track
  let placed = 0;
  const dens = Math.max(1, WORLD_W * WORLD_H / (4400 * 3200));
  for (let tries = 0; tries < 6000 * dens && placed < 520 * dens; tries++) {
    const x = R() * WORLD_W, y = R() * WORLD_H; if (nearestFull(tr, x, y).d < tr.w / 2 + 130) continue; placed++;
    const r = 26 + R() * 30;
    if (th.city && R() < 0.8) { const bw = r * (1.6 + R() * 1.6), bh = r * (1.6 + R() * 2), an = R() * Math.PI; g.save(); g.translate(x, y); g.rotate(an); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-bw / 2 + 12, -bh / 2 + 14, bw, bh); g.fillStyle = ['#e9dcc4', '#d9b99b', '#f1ece2', '#c98f6a', '#e3c9a8'][Math.floor(R() * 5)]; g.fillRect(-bw / 2, -bh / 2, bw, bh); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-bw / 2, -bh / 2, bw, bh / 2); g.restore(); continue; }
    if (th.night && R() < 0.35) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x - r + 10, y - r + 10, r * 2, r * 2.4); g.fillStyle = ['#1c2233', '#232b40', '#2a2f45'][Math.floor(R() * 3)]; g.fillRect(x - r, y - r, r * 2, r * 2.4); g.fillStyle = ['#00e5ff', '#ff2fb0', '#ffe14d'][Math.floor(R() * 3)]; g.globalAlpha = 0.7; g.fillRect(x - r, y - r, r * 2, 4); g.globalAlpha = 1; continue; }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 12, y + 14, r, 0, 7); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); gr.addColorStop(0, th.tree[1]); gr.addColorStop(1, th.tree[0]); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    if (th.snow) { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, 7); g.fill(); }
  }
  // tyre stacks on outside of tight corners
  for (let i = 0; i < tr.n; i += 6) { const da = angDiff(tr.dirs[(i + 6) % tr.n], tr.dirs[i]); if (Math.abs(da) < 0.12) continue; const side = da > 0 ? -1 : 1, p = tr.pts[i], d = tr.w / 2 + 70; const x = p[0] + Math.cos(tr.dirs[i] + Math.PI / 2) * d * side, y = p[1] + Math.sin(tr.dirs[i] + Math.PI / 2) * d * side; if (nearestFull(tr, x, y).d < tr.w / 2 + 50) continue; g.fillStyle = '#16161a'; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); g.strokeStyle = (i / 6) % 2 ? '#fff' : (th.night ? '#00e5ff' : '#d8262f'); g.lineWidth = 4; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); }
  // far-out barriers (Armco + red/white blocks); skipped where they would cut into another part of the track
  const BO = tr.w / 2 + barrierGap(tr);
  for (const pass of [0, 1]) for (const side of [-1, 1]) {
    let open = false; g.lineCap = 'round'; g.lineWidth = pass ? 4 : 9; const sc = pass ? '#c9ced6' : 'rgba(0,0,0,.35)';
    for (let i = 0; i <= tr.n; i += 2) {
      const k = i % tr.n, p = tr.pts[k], d = tr.dirs[k], bx = p[0] - Math.sin(d) * BO * side, by = p[1] + Math.cos(d) * BO * side;
      const ok = nearestFull(tr, bx, by).d > BO - 14;
      if (ok) { if (!open) { g.beginPath(); g.moveTo(bx + (pass ? 0 : 5), by + (pass ? 0 : 6)); open = true; } else g.lineTo(bx + (pass ? 0 : 5), by + (pass ? 0 : 6)); }
      else if (open) { g.strokeStyle = sc; g.stroke(); open = false; }
      if (pass && ok && k % 24 === 0) { g.save(); g.translate(bx, by); g.rotate(d); g.fillStyle = (k / 24) % 2 ? '#fff' : (th.night ? '#00e5ff' : '#d8262f'); g.fillRect(-9, -5, 18, 10); g.restore(); }
    }
    if (open) { g.strokeStyle = sc; g.stroke(); }
  }
  return c;
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function nearestFull(tr, x, y) { let bi = 0, bd = 1e18; for (let i = 0; i < tr.n; i += 3) { const p = tr.pts[i], d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; bi = i; } } return refine(tr, x, y, bi, 4); }
function refine(tr, x, y, hint, win) { let bi = hint, bd = 1e18; for (let k = -win; k <= win; k++) { const i = (hint + k + tr.n) % tr.n, p = tr.pts[i], d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; bi = i; } } return { i: bi, d: Math.sqrt(bd) }; }
function nearest(tr, x, y, hint) { const r = refine(tr, x, y, hint, 30); return r.d > tr.w * 1.6 ? nearestFull(tr, x, y) : r; }
function gridSlot(tr, s) { const i = (tr.n - 6 - Math.floor(s / 2) * 7) % tr.n, p = tr.pts[i], a = tr.dirs[i], side = s % 2 ? 1 : -1, off = side * tr.w * 0.22; return { x: p[0] - Math.sin(a) * off, y: p[1] + Math.cos(a) * off, a, i }; }
