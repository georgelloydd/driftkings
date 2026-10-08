// ===== Car types + liveries (cosmetic only: every car uses the same physics in car.js) =====
const CAR_TYPES = [
  { id: 'street', name: 'Street', l: 1, w: 1, desc: 'The original all-rounder' },
  { id: 'drift', name: 'Drift SR', l: 1, w: 1.04, desc: 'Wide arches, front lip, big angle' },
  { id: 'gt', name: 'GT Car', l: 1.08, w: 1.02, desc: 'Long nose and a big rear wing' },
  { id: 'f1', name: 'Formula', l: 1.14, w: 0.78, desc: 'Open wheels, front and rear wings' },
  { id: 'hatch', name: 'Hot Hatch', l: 0.86, w: 1, desc: 'Short body, long roof, roof spoiler' },
  { id: 'muscle', name: 'Muscle', l: 1.1, w: 1.06, desc: 'Hood scoop and twin stripes' },
  { id: 'rally', name: 'Rally', l: 0.96, w: 1, desc: 'Light pod, roof vent, mudflaps' },
  { id: 'kei', name: 'Kei Truck', l: 0.9, w: 0.94, desc: 'Tiny cab with a flat bed' },
];
const LIVERIES = [
  { id: 'clean', name: 'Clean' }, { id: 'stripe', name: 'Stripe' }, { id: 'racing', name: 'Racing' },
  { id: 'checker', name: 'Checker' }, { id: 'carbon', name: 'Carbon' }, { id: 'flame', name: 'Flame' }, { id: 'camo', name: 'Camo' },
];
function carType(id) { return CAR_TYPES.find(t => t.id === id) || CAR_TYPES[0]; }

function bodyPath(g, id, L, W) {
  const h = L / 2, w = W / 2; g.beginPath();
  if (id === 'gt') { g.moveTo(h, -w * 0.62); g.quadraticCurveTo(h + 2, 0, h, w * 0.62); g.lineTo(h * 0.55, w); g.lineTo(-h + 6, w); g.quadraticCurveTo(-h, w, -h, w - 6); g.lineTo(-h, -w + 6); g.quadraticCurveTo(-h, -w, -h + 6, -w); g.lineTo(h * 0.55, -w); g.closePath(); }
  else if (id === 'f1') { g.moveTo(h, -2.5); g.lineTo(h, 2.5); g.lineTo(h * 0.25, w * 0.42); g.lineTo(-h * 0.2, w * 0.8); g.lineTo(-h * 0.75, w * 0.8); g.lineTo(-h * 0.85, w * 0.4); g.lineTo(-h * 0.85, -w * 0.4); g.lineTo(-h * 0.75, -w * 0.8); g.lineTo(-h * 0.2, -w * 0.8); g.lineTo(h * 0.25, -w * 0.42); g.closePath(); }
  else if (id === 'kei') { g.roundRect(-h, -w, L, W, 4); }
  else if (id === 'hatch') { g.roundRect(-h, -w, L, W, [10, 4, 4, 10]); }
  else if (id === 'drift') { g.roundRect(-h, -w, L, W, 6); }
  else g.roundRect(-h, -w, L, W, id === 'muscle' ? 7 : 9);
}

function drawLivery(g, lv, col, L, W, id) {
  const h = L / 2, w = W / 2, dark = shadeHex(col, 0.35), light = shadeHex(col, 1.55);
  if (lv === 'stripe') { g.fillStyle = light; g.fillRect(-h, -3, L, 6); }
  else if (lv === 'racing') { g.fillStyle = '#f4f4f4'; g.fillRect(-h, -6, L, 4); g.fillRect(-h, 2, L, 4); }
  else if (lv === 'checker') { const s = 5; for (let x = -h + L * 0.15; x < -h + L * 0.4; x += s) for (let y = -w; y < w; y += s) { g.fillStyle = ((Math.round((x + h) / s) + Math.round((y + w) / s)) % 2) ? '#111' : '#f4f4f4'; g.fillRect(x, y, s, s); } }
  else if (lv === 'carbon') { g.fillStyle = 'rgba(15,15,18,.78)'; g.fillRect(-h, -w, L, W); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (let x = -h - W; x < h; x += 3) { g.beginPath(); g.moveTo(x, -w); g.lineTo(x + W, w); g.stroke(); } g.fillStyle = col; g.fillRect(-h, -w, L, 2.5); g.fillRect(-h, w - 2.5, L, 2.5); }
  else if (lv === 'flame') { for (const [c, k] of [['#ff7a00', 1], ['#ffd60a', 0.6]]) { g.fillStyle = c; g.beginPath(); g.moveTo(h, -w * k); for (let i = 0; i <= 6; i++) { const y = -w * k + (2 * w * k) * i / 6; g.lineTo(h - L * (i % 2 ? 0.55 : 0.3) * k, y); } g.lineTo(h, w * k); g.closePath(); g.fill(); } }
  else if (lv === 'camo') { const r = rnd(7); for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? dark : shadeHex(col, 0.7); g.beginPath(); g.ellipse(-h + r() * L, -w + r() * W, 4 + r() * 6, 3 + r() * 4, r() * 3, 0, 7); g.fill(); } }
}

function drawCar(g, c, night) {
  const t = carType(c.body), id = t.id, L = CAR.L * t.l, W = CAR.W * t.w, h = L / 2, w = W / 2, col = c.color || '#ff3b3b', lv = c.livery || 'clean';
  g.save(); g.translate(c.x, c.y); g.rotate(c.a);
  if (night) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(h, 0, 4, h + 170, 0, 230); gr.addColorStop(0, 'rgba(255,240,200,.2)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(h * 0.9, -w * 0.7); g.lineTo(h + 250, -110); g.lineTo(h + 250, 110); g.lineTo(h * 0.9, w * 0.7); g.fill(); g.restore(); }
  // shadow
  g.fillStyle = 'rgba(0,0,0,.38)'; g.save(); g.translate(5, 7); bodyPath(g, id, L, W); g.fill(); g.restore();
  // wheels
  g.fillStyle = '#121214'; const ow = id === 'f1' ? 8 : id === 'drift' ? 2 : 0, tw = id === 'f1' ? 16 : 14, th = id === 'f1' ? 11 : 10;
  for (const sx of [-1, 1]) { g.fillRect(-L * 0.4, sx * (w + ow) - th / 2, tw, th); g.save(); g.translate(L * 0.3, sx * (w + ow)); g.rotate((c.steer || 0) * 0.5); g.fillRect(-tw / 2, -th / 2, tw, th); g.restore(); }
  if (id === 'f1') { g.fillStyle = '#1a1a1d'; g.fillRect(h - 6, -w - 10, 6, W + 20); g.fillStyle = col; g.fillRect(h - 5, -w - 9, 4, W + 18); g.fillStyle = '#1a1a1d'; g.fillRect(-h - 2, -w * 0.95, 7, W * 1.9); }
  // body
  const bg = g.createLinearGradient(0, -w, 0, w); bg.addColorStop(0, shadeHex(col, 0.62)); bg.addColorStop(0.45, shadeHex(col, 1.18)); bg.addColorStop(0.55, shadeHex(col, 1.18)); bg.addColorStop(1, shadeHex(col, 0.62));
  bodyPath(g, id, L, W); g.fillStyle = bg; g.fill();
  g.save(); bodyPath(g, id, L, W); g.clip(); drawLivery(g, id === 'muscle' && lv === 'clean' ? 'racing' : lv, col, L, W, id);
  if (id === 'kei') { g.fillStyle = shadeHex(col, 0.75); g.fillRect(-h, -w, L * 0.6, W); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.strokeRect(-h + 3, -w + 3, L * 0.6 - 6, W - 6); g.beginPath(); g.moveTo(-h + 3 + L * 0.2, -w + 3); g.lineTo(-h + 3 + L * 0.2, w - 3); g.moveTo(-h + 3 + L * 0.4, -w + 3); g.lineTo(-h + 3 + L * 0.4, w - 3); g.stroke(); }
  g.restore();
  bodyPath(g, id, L, W); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.stroke();
  // cabin / glass
  const glass = (x0, x1, y0, y1) => { const wg = g.createLinearGradient(x0, 0, x1, 0); wg.addColorStop(0, '#0d1420'); wg.addColorStop(1, '#4a6a8a'); g.fillStyle = wg; g.beginPath(); g.moveTo(x0, -y0); g.lineTo(x1, -y1); g.lineTo(x1, y1); g.lineTo(x0, y0); g.closePath(); g.fill(); };
  if (id === 'f1') { g.fillStyle = '#0d1420'; g.beginPath(); g.ellipse(-L * 0.05, 0, L * 0.11, w * 0.32, 0, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 2.5; g.beginPath(); g.arc(-L * 0.02, 0, w * 0.4, -1.2, 1.2); g.stroke(); g.fillStyle = '#ffd60a'; g.beginPath(); g.arc(-L * 0.08, 0, 3.2, 0, 7); g.fill(); }
  else if (id === 'kei') { glass(h - L * 0.1, h - L * 0.2, w * 0.82, w * 0.72); g.fillStyle = shadeHex(col, 1.3); g.fillRect(h - L * 0.4, -w * 0.78, L * 0.2, W * 0.78); }
  else if (id === 'hatch') { glass(L * 0.12, L * 0.28, w * 0.76, w * 0.6); g.fillStyle = shadeHex(col, 1.3); g.beginPath(); g.roundRect(-h + 4, -w * 0.72, L * 0.62, W * 0.72, 4); g.fill(); g.fillStyle = '#132030'; g.fillRect(-h + 2, -w * 0.62, 4, W * 0.62); g.fillStyle = shadeHex(col, 0.45); g.fillRect(-h - 2, -w * 0.85, 5, W * 0.85); }
  else { const cx = id === 'muscle' ? -L * 0.12 : id === 'gt' ? -L * 0.08 : 0; glass(cx + L * 0.06, cx + L * 0.24, w * 0.76, w * 0.6); g.fillStyle = shadeHex(col, 1.3); g.beginPath(); g.roundRect(cx - L * 0.2, -w * 0.72, L * 0.26, W * 0.72, 4); g.fill(); g.fillStyle = '#132030'; g.fillRect(cx - L * 0.32, -w * 0.66, L * 0.1, W * 0.66); }
  // type extras
  if (id === 'gt' || id === 'drift' || id === 'street') { g.fillStyle = id === 'gt' ? '#18181b' : shadeHex(col, 0.45); const ww = id === 'gt' ? 8 : 6; g.fillRect(-h - (id === 'gt' ? 5 : 3), -w + (id === 'gt' ? -2 : 1), ww, W + (id === 'gt' ? 4 : -2)); }
  if (id === 'drift') { g.fillStyle = '#18181b'; g.fillRect(h - 2, -w + 2, 4, W - 4); g.fillStyle = shadeHex(col, 0.55); for (const sx of [-1, 1]) { g.fillRect(-L * 0.42, sx * w - (sx > 0 ? 3 : 0), 15, 3); g.fillRect(L * 0.23, sx * w - (sx > 0 ? 3 : 0), 15, 3); } }
  if (id === 'muscle') { g.fillStyle = '#18181b'; g.beginPath(); g.roundRect(L * 0.2, -4, L * 0.16, 8, 2); g.fill(); g.fillStyle = '#555'; g.fillRect(L * 0.33, -3, 2, 6); }
  if (id === 'rally') { g.fillStyle = '#18181b'; g.fillRect(h - 4, -w * 0.7, 5, W * 0.7); g.fillStyle = '#fff6c8'; for (let i = -1.5; i <= 1.5; i++) { g.beginPath(); g.arc(h - 1.5, i * W * 0.2, 2.6, 0, 7); g.fill(); } g.fillStyle = '#18181b'; g.fillRect(-L * 0.12, -3, 6, 6); g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(L * 0.02, w * 0.55, 5, 0, 7); g.fill(); g.fillStyle = '#111'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', L * 0.02, w * 0.55 + 0.5); g.fillStyle = '#c21d1d'; for (const sx of [-1, 1]) g.fillRect(-L * 0.32, sx * (w + 1) - 1.5, 3, 3); }
  // lights
  if (id !== 'f1') { g.fillStyle = '#fff6c8'; g.fillRect(h - 4, -w + 3, 4, 6); g.fillRect(h - 4, w - 9, 4, 6); }
  g.fillStyle = c.brake ? '#ff2a2a' : '#8a1010'; g.fillRect(-h, -w + 3, 3, 6); g.fillRect(-h, w - 9, 3, 6);
  if (c.brake) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(-h, 0, 0, -h, 0, 40); rg.addColorStop(0, 'rgba(255,40,40,.5)'); rg.addColorStop(1, 'rgba(255,40,40,0)'); g.fillStyle = rg; g.fillRect(-h - 40, -40, 50, 80); g.restore(); }
  g.restore();
}
// Garage preview canvas
function drawCarPreview(cv, body, color, livery, ang) {
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  const s = Math.min(cv.width / 90, cv.height / 60); g.translate(cv.width / 2, cv.height / 2); g.scale(s, s);
  drawCar(g, { x: 0, y: 0, a: ang === undefined ? -0.5 : ang, steer: 0.4, color, body, livery }, false); g.setTransform(1, 0, 0, 1, 0, 0);
}
