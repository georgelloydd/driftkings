// ===== Car physics + drawing =====
const CAR = { MAXS: 980, ENGINE: 1050, BRAKE: 1600, REV: 520, STEER: 2.9, L: 58, W: 28 };
// handling multipliers the admin can set per player from the dev site's Troll tab
const TW_DEF = { maxs: 1, engine: 1, brake: 1, rev: 1, steer: 1, grip: 1, drift: 1, dmom: 1, hb: 1, off: 1, inv: 0 };
let TWEAKS = Object.assign({}, TW_DEF);
function shadeHex(hex, f) { let r, g, b; if (hex[0] === '#') { const n = parseInt(hex.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; } else[r, g, b] = hex.match(/\d+/g).map(Number); const m = v => Math.max(0, Math.min(255, Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f))); return `rgb(${m(r)},${m(g)},${m(b)})`; }
function newCar(slot, tr, id, name, color) {
  const g = gridSlot(tr, slot);
  return { id, name, color, x: g.x, y: g.y, a: g.a, vx: 0, vy: 0, steer: 0, speed: 0, drift: false, slip: 0, hint: g.i, prog: g.i, lap: -1, cps: 0, off: false, brake: false, hb: false,
    finished: 0, lapStart: 0, best: 0, lastLap: 0, score: 0, cur: 0, combo: 1, comboT: 0, idle: 0, wrong: 0, rwL: null, rwR: null };
}
function stepCar(c, inp, dt, tr) {
  const T = c.tw || TW_DEF, fx = Math.cos(c.a), fy = Math.sin(c.a), rx = -fy, ry = fx;
  let vF = c.vx * fx + c.vy * fy, vR = c.vx * rx + c.vy * ry;
  const nr = nearest(tr, c.x, c.y, c.hint); c.hint = nr.i;
  const edge = tr.w / 2 + 14; c.off = nr.d > edge; const sand = c.off && nr.d < tr.w / 2 + 60;
  if (inp.up) vF += CAR.ENGINE * T.engine * dt * Math.max(0, 1 - vF / (CAR.MAXS * T.maxs));
  if (inp.down) { if (vF > 20) vF -= CAR.BRAKE * T.brake * dt; else vF = Math.max(-CAR.REV * T.rev * 0.55, vF - CAR.REV * T.rev * dt); }
  if (!inp.up && !inp.down) vF *= 1 - 0.55 * dt;
  vF *= 1 - 0.12 * dt;
  if (c.off) vF *= Math.max(0, 1 - (sand ? 1.1 : 2.3) * T.off * dt);
  const speed = Math.hypot(vF, vR);
  c.slip = Math.atan2(vR, Math.max(40, Math.abs(vF))); const as = Math.abs(c.slip);
  if (!c.drift && as > 0.27 && speed > 220) c.drift = true;
  if (c.drift && (as < 0.09 || speed < 140)) c.drift = false;
  let grip = inp.hb ? 0.9 * T.hb : c.drift ? (as > 1.15 ? 6.5 : 2.3) * T.drift : 8.5 * T.grip; if (c.off) grip *= 0.7;
  const nvR = vR * Math.exp(-grip * dt);
  if (vF > 0 && c.drift && !inp.hb) vF += Math.abs(vR - nvR) * 0.34 * T.dmom; // drift momentum kept going forwards
  vR = nvR; if (inp.hb) vF *= 1 - 0.8 * dt;
  const target = ((inp.left ? -1 : 0) + (inp.right ? 1 : 0)) * (T.inv ? -1 : 1); c.steer += (target - c.steer) * Math.min(1, dt * 11);
  let turn = c.steer * CAR.STEER * T.steer * Math.min(1, speed / 260) * (vF < -5 ? -1 : 1);
  if (c.drift) turn *= 1.25; if (inp.hb) turn *= 1.55; turn *= 1 - Math.min(0.32, Math.max(0, (speed - 620) / 1400));
  c.vx = fx * vF + rx * vR; c.vy = fy * vF + ry * vR; c.a += turn * dt;
  c.x += c.vx * dt; c.y += c.vy * dt;
  c.layer = tr && tr.layerAt ? tr.layerAt[nr.i] : 0; if (!c.layer) wallCollide(c, tr); else segCollide(c, tr.rails, c.layer);
  if (!isFinite(c.x) || !isFinite(c.y) || !isFinite(c.vx) || !isFinite(c.vy) || !isFinite(c.a)) { c.vx = c.vy = 0; if (!isFinite(c.a)) c.a = 0; if (!isFinite(c.x) || !isFinite(c.y)) { const p = tr.pts[c.hint || 0] || tr.pts[0]; c.x = p[0]; c.y = p[1]; } }
  const WW = (tr && tr.W) || WORLD_W, WH = (tr && tr.H) || WORLD_H; if (c.x < 30 || c.x > WW - 30) { c.x = Math.max(30, Math.min(WW - 30, c.x)); c.vx *= -0.3; }
  if (c.y < 30 || c.y > WH - 30) { c.y = Math.max(30, Math.min(WH - 30, c.y)); c.vy *= -0.3; }
  c.thr = inp.up ? 1 : 0; c.brake = inp.down && vF > 20; c.hb = !!inp.hb; c.speed = speed; c.vF = vF;
  return nr;
}
function wheelPos(c) { const ca = Math.cos(c.a), sa = Math.sin(c.a), bx = -CAR.L * 0.32, by = CAR.W * 0.42; return [[c.x + ca * bx - sa * -by, c.y + sa * bx + ca * -by], [c.x + ca * bx - sa * by, c.y + sa * bx + ca * by]]; }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function drawCar(g, c, night) {
  const L = CAR.L, W = CAR.W, col = c.color;
  g.save(); g.translate(c.x, c.y); g.rotate(c.a);
  if (night) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(L * 0.5, 0, 4, L * 0.5 + 170, 0, 230); gr.addColorStop(0, 'rgba(255,240,200,.2)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(L * 0.45, -W * 0.35); g.lineTo(L * 0.5 + 250, -110); g.lineTo(L * 0.5 + 250, 110); g.lineTo(L * 0.45, W * 0.35); g.fill(); g.restore(); }
  g.fillStyle = 'rgba(0,0,0,.38)'; rr(g, -L / 2 + 5, -W / 2 + 7, L, W, 9); g.fill();
  g.fillStyle = '#121214';
  for (const sx of [-1, 1]) { g.fillRect(-L * 0.42, sx * W * 0.5 - 5, 14, 10); g.save(); g.translate(L * 0.3, sx * W * 0.5); g.rotate(c.steer * 0.5); g.fillRect(-7, -5, 14, 10); g.restore(); }
  const bg = g.createLinearGradient(0, -W / 2, 0, W / 2); bg.addColorStop(0, shadeHex(col, 0.62)); bg.addColorStop(0.45, shadeHex(col, 1.18)); bg.addColorStop(0.55, shadeHex(col, 1.18)); bg.addColorStop(1, shadeHex(col, 0.62));
  g.fillStyle = bg; rr(g, -L / 2, -W / 2, L, W, 9); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(L * 0.12, -2.5, L * 0.36, 2); g.fillRect(L * 0.12, 0.5, L * 0.36, 2);
  const wg = g.createLinearGradient(L * 0.05, 0, L * 0.28, 0); wg.addColorStop(0, '#0d1420'); wg.addColorStop(1, '#4a6a8a');
  g.fillStyle = wg; g.beginPath(); g.moveTo(L * 0.06, -W * 0.38); g.lineTo(L * 0.24, -W * 0.3); g.lineTo(L * 0.24, W * 0.3); g.lineTo(L * 0.06, W * 0.38); g.closePath(); g.fill();
  g.fillStyle = shadeHex(col, 1.3); rr(g, -L * 0.2, -W * 0.36, L * 0.26, W * 0.72, 4); g.fill();
  g.fillStyle = '#132030'; g.fillRect(-L * 0.32, -W * 0.33, L * 0.1, W * 0.66);
  g.fillStyle = shadeHex(col, 0.45); g.fillRect(-L / 2 - 3, -W / 2 + 1, 6, W - 2);
  g.fillStyle = '#fff6c8'; g.fillRect(L / 2 - 4, -W / 2 + 3, 4, 6); g.fillRect(L / 2 - 4, W / 2 - 9, 4, 6);
  g.fillStyle = c.brake ? '#ff2a2a' : '#8a1010'; g.fillRect(-L / 2, -W / 2 + 3, 3, 6); g.fillRect(-L / 2, W / 2 - 9, 3, 6);
  if (c.brake) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(-L / 2, 0, 0, -L / 2, 0, 40); rg.addColorStop(0, 'rgba(255,40,40,.5)'); rg.addColorStop(1, 'rgba(255,40,40,0)'); g.fillStyle = rg; g.fillRect(-L / 2 - 40, -40, 50, 80); g.restore(); }
  g.restore();
}
