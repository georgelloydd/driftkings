// ===== Car types + liveries (cosmetic only: every car uses the same physics in car.js) =====
const CAR_TYPES = [
  { id: 'street', name: 'Street', l: 1, w: 1, desc: 'Clean coupe with a ducktail lip', cab: [0.2, -0.24], gw: 0.8, nose: 0.2, lights: 'slim' },
  { id: 'drift', name: 'Drift SR', l: 1, w: 1.06, desc: 'Bolt-on arches, canards, swan-neck wing', cab: [0.18, -0.24], gw: 0.76, nose: 0.15, lights: 'slim', arch: 2.5 },
  { id: 'gt', name: 'GT Car', l: 1.1, w: 1.04, desc: 'Long nose, splitter, huge rear wing', cab: [0.06, -0.3], gw: 0.72, nose: 0.3, lights: 'slim' },
  { id: 'f1', name: 'Formula', l: 1.16, w: 0.8, desc: 'Open wheels, halo, front and rear wings' },
  { id: 'hatch', name: 'Hot Hatch', l: 0.86, w: 1, desc: 'Short and boxy with a roof spoiler', cab: [0.2, -0.42], gw: 0.82, nose: 0.1, lights: 'round' },
  { id: 'muscle', name: 'Muscle', l: 1.1, w: 1.06, desc: 'Long bonnet, cowl scoop, wide hips', cab: [-0.02, -0.3], gw: 0.76, nose: 0.05, lights: 'round', arch: 1.5 },
  { id: 'rally', name: 'Rally', l: 0.96, w: 1, desc: 'Light pod, roof vent, mudflaps', cab: [0.18, -0.28], gw: 0.8, nose: 0.15, lights: 'round' },
  { id: 'kei', name: 'Kei Truck', l: 0.9, w: 0.94, desc: 'Tiny cab with a flat bed', cab: [0.46, 0.14], gw: 0.86, nose: 0.02, lights: 'round' },
];
const LIVERIES = [
  { id: 'clean', name: 'Clean' }, { id: 'stripes', name: 'Twin stripes' }, { id: 'centre', name: 'Centre stripe' }, { id: 'side', name: 'Side stripes' },
  { id: 'split', name: 'Two-tone' }, { id: 'fade', name: 'Fade' }, { id: 'carbon', name: 'Carbon' }, { id: 'checker', name: 'Checker' },
  { id: 'flame', name: 'Flames' }, { id: 'camo', name: 'Camo' }, { id: 'chevron', name: 'Chevrons' }, { id: 'number', name: 'Race number' },
];
const FINISHES = [['gloss', 'Gloss'], ['matte', 'Matte'], ['metal', 'Metallic'], ['pearl', 'Pearl']];
const LOOK_DEF = { color: '#ff3b3b', accent: '#ffffff', accent2: '#111111', rim: '#c9ccd2', finish: 'gloss', num: '7', livery: 'stripes', body: 'drift' };
const OLD_LV = { stripe: 'centre', racing: 'stripes' };
const isHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
function carType(id) { return CAR_TYPES.find(t => t.id === id) || CAR_TYPES[0]; }
// Sanitised cosmetic settings (also used for other players' cars received over the network)
function carLook(o) {
  o = o || {}; const lv = OLD_LV[o.livery] || o.livery;
  return { body: carType(o.body).id, color: isHex(o.color) ? o.color : LOOK_DEF.color, accent: isHex(o.accent) ? o.accent : LOOK_DEF.accent, accent2: isHex(o.accent2) ? o.accent2 : LOOK_DEF.accent2,
    rim: isHex(o.rim) ? o.rim : LOOK_DEF.rim, finish: FINISHES.some(f => f[0] === o.finish) ? o.finish : 'gloss', num: String(o.num === undefined ? LOOK_DEF.num : o.num).replace(/\D/g, '').slice(0, 2), livery: LIVERIES.some(l => l.id === lv) ? lv : 'clean' };
}
function mixHex(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

let CARBON_C = null;
function carbonPattern(g) {
  if (!CARBON_C) {
    const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.fillStyle = '#0f0f11'; x.fillRect(0, 0, 8, 8);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const horiz = ((i + j) % 4) < 2, gr = horiz ? x.createLinearGradient(0, j * 2, 0, j * 2 + 2) : x.createLinearGradient(i * 2, 0, i * 2 + 2, 0); gr.addColorStop(0, '#2c2d32'); gr.addColorStop(0.5, '#1b1c20'); gr.addColorStop(1, '#0c0c0e'); x.fillStyle = gr; x.fillRect(i * 2, j * 2, 2, 2); }
    CARBON_C = c;
  }
  return g.createPattern(CARBON_C, 'repeat');
}

// Top-down outline for closed cars: tapered nose, rounded corners, optional wheel-arch flares
function bodyPath(g, t, L, W) {
  const h = L / 2, w = W / 2, wf = w * (1 - t.nose * 0.35), wr = w * 0.93;
  g.beginPath(); g.moveTo(h, -wf * 0.5);
  g.quadraticCurveTo(h + 1.5, 0, h, wf * 0.5); g.quadraticCurveTo(h - 0.5, wf, h - L * 0.13, w);
  g.lineTo(-h + L * 0.09, w); g.quadraticCurveTo(-h, wr, -h, wr * 0.62); g.lineTo(-h, -wr * 0.62);
  g.quadraticCurveTo(-h, -wr, -h + L * 0.09, -w); g.lineTo(h - L * 0.13, -w); g.quadraticCurveTo(h - 0.5, -wf, h, -wf * 0.5); g.closePath();
}
function f1Path(g, L, W) {
  const h = L / 2, w = W / 2; g.beginPath(); g.moveTo(h - 1, -2.2); g.lineTo(h - 1, 2.2); g.lineTo(L * 0.12, w * 0.32); g.lineTo(L * 0.02, w * 0.82); g.quadraticCurveTo(-L * 0.18, w * 0.95, -L * 0.3, w * 0.62);
  g.lineTo(-h + 4, w * 0.3); g.lineTo(-h + 4, -w * 0.3); g.lineTo(-L * 0.3, -w * 0.62); g.quadraticCurveTo(-L * 0.18, -w * 0.95, L * 0.02, -w * 0.82); g.lineTo(L * 0.12, -w * 0.32); g.closePath();
}

function drawLivery(g, k, L, W, t) {
  const h = L / 2, w = W / 2, A = k.accent, B = k.accent2, lv = k.livery;
  const band = (y0, y1, x0 = -h - 2, x1 = h + 2, edge = true) => { g.fillStyle = A; g.fillRect(x0, y0, x1 - x0, y1 - y0); if (edge) { g.fillStyle = B; g.fillRect(x0, y0 - 0.9, x1 - x0, 0.9); g.fillRect(x0, y1, x1 - x0, 0.9); } };
  if (lv === 'stripes') { const sw = W * 0.12, gap = W * 0.05; band(-gap - sw, -gap); band(gap, gap + sw); }
  else if (lv === 'centre') { band(-W * 0.12, W * 0.12); }
  else if (lv === 'side') { for (const s of [-1, 1]) { g.fillStyle = A; g.beginPath(); g.moveTo(h - L * 0.18, s * (w - 2.2)); g.lineTo(-h + 2, s * (w - 2.2)); g.lineTo(-h + 2, s * (w - 6.5)); g.lineTo(h - L * 0.3, s * (w - 4)); g.closePath(); g.fill(); g.strokeStyle = B; g.lineWidth = 0.9; g.stroke(); } }
  else if (lv === 'split') { g.fillStyle = A; g.beginPath(); g.moveTo(L * 0.02, -w - 2); g.lineTo(-L * 0.1, w + 2); g.lineTo(-h - 2, w + 2); g.lineTo(-h - 2, -w - 2); g.closePath(); g.fill(); g.strokeStyle = B; g.lineWidth = 1.4; g.beginPath(); g.moveTo(L * 0.02, -w - 2); g.lineTo(-L * 0.1, w + 2); g.stroke(); }
  else if (lv === 'fade') {
    const gr = g.createLinearGradient(L * 0.15, 0, -h, 0); gr.addColorStop(0, rgba(A, 0)); gr.addColorStop(0.55, rgba(A, 0.9)); gr.addColorStop(1, A); g.fillStyle = gr; g.fillRect(-h - 2, -w - 2, L + 4, W + 4);
    g.fillStyle = B; for (let x = L * 0.2; x > -L * 0.12; x -= 3.2) { const r = 1.15 * (1 - (x - L * 0.2) / (-L * 0.32)) + 0.15; for (let y = -w + 1.6; y < w; y += 3.2) { g.beginPath(); g.arc(x, y + ((x * 10 | 0) % 2) * 1.6, Math.max(0.2, 1.3 - r), 0, 7); g.fill(); } }
  }
  else if (lv === 'carbon') {
    const [cf, cr] = t.cab || [0.2, -0.24], pat = carbonPattern(g);
    g.fillStyle = pat; g.fillRect(L * cf + 1, -w - 2, h - L * cf + 2, W + 4); // bonnet
    g.fillRect(L * cr - 1, -w * (t.gw || 0.8), L * (cf - cr) + 2, W * (t.gw || 0.8)); // roof
    g.fillRect(-h - 2, -w - 2, 4.5, W + 4); // rear diffuser
    g.fillStyle = A; g.fillRect(L * cf + 1, -w - 2, 1, W + 4);
  }
  else if (lv === 'checker') { const s = 3.6; for (let x = -h - 2, i = 0; x < L * 0.05; x += s, i++) for (let y = -w - 2, j = 0; y < w + 2; y += s, j++) { const fade = (x + h) / (L * 0.55); if (((i * 7 + j * 13) % 10) / 10 < fade * 1.25 - 0.25) continue; g.fillStyle = (i + j) % 2 ? A : B; g.fillRect(x, y, s, s); } }
  else if (lv === 'flame') {
    for (const [c, k2] of [[A, 1], [B, 0.62]]) { g.fillStyle = c; g.beginPath(); g.moveTo(h + 2, -w * k2 - 1); const tongues = 4; for (let i = 0; i < tongues; i++) { const y0 = -w * k2 + (2 * w * k2) * i / tongues, y1 = -w * k2 + (2 * w * k2) * (i + 0.5) / tongues, y2 = -w * k2 + (2 * w * k2) * (i + 1) / tongues, len = L * (i % 2 ? 0.42 : 0.62) * k2; g.quadraticCurveTo(h - len * 0.4, y0, h - len, y1 - 1.5); g.quadraticCurveTo(h - len * 0.45, y1 + 1, h - L * 0.12 * k2, y2); } g.lineTo(h + 2, w * k2 + 1); g.closePath(); g.fill(); }
  }
  else if (lv === 'camo') { const r = rnd(11); for (let i = 0; i < 16; i++) { g.fillStyle = [A, B, shadeHex(k.color, 0.55)][i % 3]; const x = -h + r() * L, y = -w + r() * W; g.beginPath(); for (let a = 0; a < 6; a++) { const rr = 2.5 + r() * 4.5, an = a / 6 * 6.283; g.lineTo(x + Math.cos(an) * rr * 1.5, y + Math.sin(an) * rr); } g.closePath(); g.fill(); } }
  else if (lv === 'chevron') { g.lineJoin = 'miter'; for (let i = 0; i < 3; i++) { const x = h - 5 - i * 6.5; g.beginPath(); g.moveTo(x - 6, -w * 0.62); g.lineTo(x, 0); g.lineTo(x - 6, w * 0.62); g.strokeStyle = B; g.lineWidth = 4.2; g.stroke(); g.strokeStyle = A; g.lineWidth = 2.6; g.stroke(); } }
  if (lv === 'number' || (t.id === 'rally' && lv !== 'carbon')) {
    const n = k.num || '7', spots = lv === 'number' ? [[-L * 0.04, 0, w * 0.5]] : []; if (t.id === 'rally' || lv === 'number') for (const s of [-1, 1]) spots.push([-L * 0.02, s * (w - 4.2), 3.6]);
    for (const [x, y, r] of spots) { g.fillStyle = A; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = B; g.lineWidth = 0.8; g.stroke(); g.save(); g.translate(x, y); g.rotate(Math.PI / 2); g.fillStyle = B; g.font = `900 ${r * 1.25}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 0, r * 0.08); g.restore(); }
  }
}

// Finish = shading laid over paint + livery so stripes get the same sheen
function finishShade(g, k, L, W) {
  const h = L / 2, w = W / 2, f = k.finish, gr = g.createLinearGradient(0, -w, 0, w);
  if (f === 'matte') { gr.addColorStop(0, 'rgba(0,0,0,.34)'); gr.addColorStop(0.3, 'rgba(0,0,0,.04)'); gr.addColorStop(0.7, 'rgba(0,0,0,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.4)'); }
  else if (f === 'metal') { gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(0.22, 'rgba(255,255,255,.08)'); gr.addColorStop(0.38, 'rgba(255,255,255,.34)'); gr.addColorStop(0.5, 'rgba(0,0,0,.05)'); gr.addColorStop(0.64, 'rgba(255,255,255,.2)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); }
  else if (f === 'pearl') { gr.addColorStop(0, 'rgba(0,0,0,.4)'); gr.addColorStop(0.35, rgba(mixHex(k.color, '#ffffff', 0.6), 0.32)); gr.addColorStop(0.5, rgba(mixHex(k.accent, '#ffffff', 0.4), 0.22)); gr.addColorStop(0.65, rgba(mixHex(k.color, '#ffffff', 0.6), 0.3)); gr.addColorStop(1, 'rgba(0,0,0,.45)'); }
  else { gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(0.28, 'rgba(255,255,255,.04)'); gr.addColorStop(0.42, 'rgba(255,255,255,.22)'); gr.addColorStop(0.58, 'rgba(255,255,255,.04)'); gr.addColorStop(1, 'rgba(0,0,0,.5)'); }
  g.fillStyle = gr; g.fillRect(-h - 3, -w - 3, L + 6, W + 6);
  const lg = g.createLinearGradient(h, 0, -h, 0); lg.addColorStop(0, 'rgba(255,255,255,.06)'); lg.addColorStop(1, 'rgba(0,0,0,.14)'); g.fillStyle = lg; g.fillRect(-h - 3, -w - 3, L + 6, W + 6);
  if (f === 'gloss' || f === 'pearl') { g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.ellipse(L * 0.08, -w * 0.38, L * 0.32, w * 0.09, -0.05, 0, 7); g.fill(); }
}

function glassGrad(g, x0, x1) { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#0a0f18'); gr.addColorStop(0.6, '#1d2c40'); gr.addColorStop(1, '#4d6886'); return gr; }
function tyre(g, x, y, tw, th, k, rot, open) {
  g.save(); g.translate(x, y); g.rotate(rot || 0); g.fillStyle = '#121214'; g.beginPath(); g.roundRect(-tw / 2, -th / 2, tw, th, 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = -tw / 2 + 1.5; i < tw / 2; i += 2.4) g.fillRect(i, -th / 2, 1, th);
  g.fillStyle = k.rim; if (open) { g.beginPath(); g.roundRect(-tw * 0.3, -th * 0.32, tw * 0.6, th * 0.64, 1.5); g.fill(); g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(0, 0, th * 0.16, 0, 7); g.fill(); } else g.fillRect(-tw * 0.3, -0.7, tw * 0.6, 1.4);
  g.restore();
}

function drawCar(g, c, night) {
  const k = carLook(c), t = carType(k.body), id = t.id, L = CAR.L * t.l, W = CAR.W * t.w, h = L / 2, w = W / 2, col = k.color;
  g.save(); g.translate(c.x, c.y); g.rotate(c.a);
  if (night) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(h, 0, 4, h + 170, 0, 230); gr.addColorStop(0, 'rgba(255,240,200,.2)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(h * 0.9, -w * 0.7); g.lineTo(h + 250, -110); g.lineTo(h + 250, 110); g.lineTo(h * 0.9, w * 0.7); g.fill(); g.restore(); }
  const path = () => id === 'f1' ? f1Path(g, L, W) : bodyPath(g, t, L, W), st = (c.steer || 0) * 0.5;
  // soft shadow
  for (const [o, a, sc] of [[7, 0.16, 1.1], [5, 0.26, 1]]) { g.save(); g.translate(o * 0.7, o); g.scale(sc, sc); g.fillStyle = `rgba(0,0,0,${a})`; path(); g.fill(); if (id === 'f1') g.fillRect(-h, -w - 4, L, W + 8); g.restore(); }
  if (id === 'f1') {
    const fw = 13, fh = 9, oy = w + 3.5;
    for (const s of [-1, 1]) { g.fillStyle = '#222'; g.fillRect(L * 0.3, s * w * 0.3 - 0.6, 3, s * (oy - w * 0.3)); g.fillRect(-L * 0.32, s * w * 0.5 - 0.6, 3, s * (oy - w * 0.5)); }
    tyre(g, -L * 0.32, -oy, fw + 2, fh + 1, k, 0, true); tyre(g, -L * 0.32, oy, fw + 2, fh + 1, k, 0, true); tyre(g, L * 0.31, -oy, fw, fh, k, st, true); tyre(g, L * 0.31, oy, fw, fh, k, st, true);
    path(); g.fillStyle = col; g.fill(); g.save(); path(); g.clip(); drawLivery(g, k, L, W, t); finishShade(g, k, L, W); g.restore();
    path(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.stroke();
    // front wing + rear wing
    g.fillStyle = '#18181b'; g.beginPath(); g.roundRect(h - 5, -w - 9, 5, W + 18, 1.5); g.fill(); g.fillStyle = k.accent; g.fillRect(h - 4, -w - 8, 3, W + 16); g.fillStyle = k.accent2; g.fillRect(h - 5, -w - 9, 5, 2.5); g.fillRect(h - 5, w + 6.5, 5, 2.5);
    g.fillStyle = '#18181b'; g.beginPath(); g.roundRect(-h - 1, -w * 0.95, 7, W * 1.9, 1.5); g.fill(); g.fillStyle = k.accent; g.fillRect(-h, -w * 0.9, 5, W * 1.8); g.fillStyle = k.accent2; g.fillRect(-h - 1, -w * 0.95, 7, 2); g.fillRect(-h - 1, w * 0.95 - 2, 7, 2);
    // cockpit, helmet, halo
    g.fillStyle = '#0b0b0d'; g.beginPath(); g.ellipse(-L * 0.04, 0, L * 0.12, w * 0.26, 0, 0, 7); g.fill();
    const hg = g.createRadialGradient(-L * 0.07, -1.2, 0.5, -L * 0.06, 0, 4.2); hg.addColorStop(0, mixHex(k.accent2, '#ffffff', 0.5)); hg.addColorStop(1, k.accent2); g.fillStyle = hg; g.beginPath(); g.arc(-L * 0.06, 0, 4, 0, 7); g.fill(); g.fillStyle = 'rgba(20,30,50,.85)'; g.fillRect(-L * 0.06 + 1.5, -2.6, 2, 5.2);
    g.strokeStyle = '#1b1b1e'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(L * 0.07, 0); g.quadraticCurveTo(-L * 0.02, -w * 0.42, -L * 0.12, -w * 0.3); g.moveTo(L * 0.07, 0); g.quadraticCurveTo(-L * 0.02, w * 0.42, -L * 0.12, w * 0.3); g.stroke();
    g.fillStyle = c.brake ? '#ff2a2a' : '#7a0d0d'; g.fillRect(-h - 2, -1.5, 2, 3);
  } else {
    // tyres (peek out from under the body), fender flares
    const tw = 12, th = 7, ty = w - 2.6 + (t.arch || 0) * 0.6;
    tyre(g, -L * 0.3, -ty, tw, th, k); tyre(g, -L * 0.3, ty, tw, th, k); tyre(g, L * 0.3, -ty, tw, th, k, st); tyre(g, L * 0.3, ty, tw, th, k, st);
    if (t.arch) { g.fillStyle = shadeHex(col, 0.7); for (const x of [-L * 0.3, L * 0.3]) for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x, s * (w - 0.5), 8.5, 1.4 + t.arch, 0, 0, 7); g.fill(); } }
    path(); g.fillStyle = col; g.fill();
    g.save(); path(); g.clip(); drawLivery(g, k, L, W, t);
    if (id === 'kei') { const bx = -h + 2, bl = L * 0.58; g.fillStyle = shadeHex(col, 0.42); g.fillRect(bx + 1.5, -w + 2.2, bl - 3, W - 4.4); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { const x = bx + 1.5 + (bl - 3) * i / 5; g.beginPath(); g.moveTo(x, -w + 2.6); g.lineTo(x, w - 2.6); g.stroke(); } g.fillStyle = shadeHex(col, 0.85); g.fillRect(bx + bl - 2, -w, 2.2, W); }
    finishShade(g, k, L, W); g.restore();
    path(); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.1; g.stroke(); g.save(); g.translate(-0.4, -0.4); path(); g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 0.7; g.stroke(); g.restore();
    // glass: windscreen, roof edge, rear window, side windows
    const cf = L * t.cab[0], cr = L * t.cab[1], gw = w * t.gw, rf = cf - L * 0.12, rr = id === 'kei' ? cr : cr + L * 0.09;
    g.fillStyle = glassGrad(g, rf, cf); g.beginPath(); g.moveTo(cf, -gw * 0.96); g.quadraticCurveTo(cf + 2.2, 0, cf, gw * 0.96); g.lineTo(rf, gw * 0.84); g.lineTo(rf, -gw * 0.84); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(cf - 1, -gw * 0.6); g.lineTo(cf - 3.5, -gw * 0.25); g.lineTo(rf + 4, -gw * 0.15); g.lineTo(rf + 1.5, -gw * 0.5); g.closePath(); g.fill();
    if (id !== 'kei') { g.fillStyle = glassGrad(g, cr, rr); g.beginPath(); g.moveTo(rr, -gw * 0.84); g.lineTo(rr, gw * 0.84); g.lineTo(cr, gw * 0.72); g.quadraticCurveTo(cr - 1.5, 0, cr, -gw * 0.72); g.closePath(); g.fill(); g.fillStyle = '#0d131c'; g.fillRect(rr, -gw * 0.96, rf - rr, 1.6); g.fillRect(rr, gw * 0.96 - 1.6, rf - rr, 1.6); }
    else { g.fillStyle = '#0d131c'; g.fillRect(cr, -gw * 0.96, rf - cr, 1.6); g.fillRect(cr, gw * 0.96 - 1.6, rf - cr, 1.6); }
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.7; g.beginPath(); g.roundRect(rr, -gw * 0.96, rf - rr, gw * 1.92, 2); g.stroke();
    // mirrors
    g.fillStyle = shadeHex(col, 0.8); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cf - 1.5, s * (w + 1.2), 1.6, 2.3, 0, 0, 7); g.fill(); g.fillStyle = '#15161a'; g.fillRect(cf - 2.4, s * (w + 1.2) - 0.6, 1.4, 1.2); g.fillStyle = shadeHex(col, 0.8); }
    // type extras
    const dark = '#16171a';
    if (id === 'street') { g.fillStyle = shadeHex(col, 0.55); g.beginPath(); g.roundRect(-h - 1, -w * 0.82, 3, W * 0.82, 1); g.fill(); }
    if (id === 'drift' || id === 'gt') { const ww = id === 'gt' ? 7 : 5, wy = id === 'gt' ? w + 2 : w + 0.5; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-h - 1, -wy + 1, ww, wy * 2); g.fillStyle = dark; g.beginPath(); g.roundRect(-h - 3, -wy, ww, wy * 2, 1.5); g.fill(); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(-h - 2, -wy + 1, ww - 2, 1); g.fillStyle = k.accent; g.fillRect(-h - 3.5, -wy - 0.5, ww + 1, 2.2); g.fillRect(-h - 3.5, wy - 1.7, ww + 1, 2.2); g.fillStyle = dark; for (const s of [-1, 1]) g.fillRect(-h + ww - 1, s * w * 0.5 - 0.7, 4, 1.4); }
    if (id === 'drift') { g.fillStyle = dark; g.fillRect(h - 1.5, -w * 0.82, 2.5, W * 0.82); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(h - 4, s * w); g.lineTo(h - 9, s * (w + 2)); g.lineTo(h - 10, s * w); g.closePath(); g.fill(); } }
    if (id === 'gt') { g.fillStyle = dark; g.fillRect(h - 1, -w * 0.75, 3, W * 0.75); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) g.fillRect(L * 0.24 - i * 2.2, s * (w - 4) - 0.5, 1.2, s * 3); }
    if (id === 'hatch') { g.fillStyle = shadeHex(col, 0.5); g.beginPath(); g.roundRect(-h + 1, -gw, 3.5, gw * 2, 1.2); g.fill(); g.fillStyle = dark; g.fillRect(h - 1.5, -w * 0.5, 2, w); }
    if (id === 'muscle') { g.fillStyle = dark; g.beginPath(); g.roundRect(L * 0.16, -3.6, L * 0.18, 7.2, 2); g.fill(); g.fillStyle = '#3a3b40'; g.fillRect(L * 0.3, -2.6, 1.6, 5.2); g.fillStyle = shadeHex(col, 0.5); g.fillRect(-h - 0.5, -w * 0.7, 2, W * 0.7); for (const s of [-1, 1]) { g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(-h + 1, s * w * 0.55, 1.1, 0, 7); g.fill(); } }
    if (id === 'rally') { g.fillStyle = dark; g.beginPath(); g.roundRect(h - 5, -w * 0.62, 4, W * 0.62, 1.2); g.fill(); g.fillStyle = '#fff6c8'; for (let i = -1.5; i <= 1.5; i++) { g.beginPath(); g.arc(h - 3, i * W * 0.15, 1.9, 0, 7); g.fill(); } g.fillStyle = dark; g.beginPath(); g.roundRect(cr + L * 0.12, -2.5, 5, 5, 1); g.fill(); g.fillStyle = '#c21d1d'; for (const s of [-1, 1]) g.fillRect(-L * 0.36, s * (w + 0.4) - 1.6, 2.2, 3.2); }
    // lights
    if (t.lights === 'round') { for (const s of [-1, 1]) { g.fillStyle = '#1a1b1f'; g.beginPath(); g.arc(h - 3, s * (w - 4), 2.8, 0, 7); g.fill(); g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(h - 3, s * (w - 4), 1.9, 0, 7); g.fill(); } }
    else { for (const s of [-1, 1]) { g.fillStyle = '#1a1b1f'; g.beginPath(); g.moveTo(h - 1, s * (w * 0.5)); g.lineTo(h - L * 0.13, s * (w - 0.8)); g.lineTo(h - L * 0.16, s * (w - 3)); g.lineTo(h - 2.5, s * (w * 0.42)); g.closePath(); g.fill(); g.strokeStyle = '#fff3c4'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(h - 1.8, s * (w * 0.5)); g.lineTo(h - L * 0.13, s * (w - 1.4)); g.stroke(); } }
    g.fillStyle = c.brake ? '#ff3030' : '#8c1212'; for (const s of [-1, 1]) { g.beginPath(); g.roundRect(-h - 0.3, s > 0 ? w - 7.5 : -w + 1.5, 2, 6, 0.8); g.fill(); }
    if (id === 'gt' || id === 'street') g.fillRect(-h - 0.3, -w + 7.5, 1.2, W - 15);
  }
  if (c.brake) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(-h, 0, 0, -h, 0, 40); rg.addColorStop(0, 'rgba(255,40,40,.5)'); rg.addColorStop(1, 'rgba(255,40,40,0)'); g.fillStyle = rg; g.fillRect(-h - 40, -40, 50, 80); g.restore(); }
  g.restore();
}
// Garage preview canvas: drawCarPreview(canvas, look, angle) (old form (canvas, body, color, livery, angle) still works)
function drawCarPreview(cv, a, b, c2, d) {
  const look = a && typeof a === 'object' ? a : { body: a, color: b, livery: c2 }, ang = a && typeof a === 'object' ? b : d;
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  const s = Math.min(cv.width / 84, cv.height / 54); g.translate(cv.width / 2, cv.height / 2); g.scale(s, s);
  drawCar(g, Object.assign({ x: 0, y: 0, a: ang === undefined ? -0.5 : ang, steer: 0.4 }, look), false); g.setTransform(1, 0, 0, 1, 0, 0);
}
