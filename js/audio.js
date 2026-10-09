// ===== Synthesised car audio: engine (idle lope, revs, gearbox, crackles), tyre squeal, gravel, wind, impacts, tunnel echo =====
const SND = { ctx: null, muted: localStorage.getItem('md_mute') === '1', rpm: 850, gear: 0, lastT: 0, prevThr: 0, shiftCut: 0, load: 0 };
const SND_GEARS = [0.17, 0.3, 0.44, 0.59, 0.76, 1.02], SND_IDLE = 850, SND_RED = 7600;
function sndNoise(A, secs) { const b = A.createBuffer(1, Math.floor(A.sampleRate * secs), A.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
function sndLoop(A, buf) { const n = A.createBufferSource(); n.buffer = buf; n.loop = true; n.start(0, Math.random() * 1.5); return n; }
function sndCurve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }
function sndInit() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume().catch(() => {}); return; }
  try {
    const A = new (window.AudioContext || window.webkitAudioContext)(); SND.ctx = A;
    const comp = A.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(A.destination);
    SND.master = A.createGain(); SND.master.gain.value = SND.muted ? 0 : 0.6; SND.master.connect(comp);
    // everything car-related goes through a bus with a tunnel echo send
    SND.bus = A.createGain(); SND.bus.connect(SND.master);
    const dl = A.createDelay(1); dl.delayTime.value = 0.085; const fb = A.createGain(); fb.gain.value = 0.42; const dlf = A.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 2200;
    SND.wet = A.createGain(); SND.wet.gain.value = 0; SND.bus.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(SND.wet); SND.wet.connect(SND.master);
    const NB = SND.NB = sndNoise(A, 2);
    // engine: firing-frequency saw + sub square + 2nd harmonic + gear whine, soft-clipped, load-dependent lowpass, idle lope
    const mix = A.createGain();
    const mk = (type, g) => { const o = A.createOscillator(); o.type = type; const gn = A.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(mix); o.start(); return o; };
    SND.o1 = mk('sawtooth', 0.5); SND.o2 = mk('square', 0.3); SND.o3 = mk('sawtooth', 0.2); SND.o4 = mk('triangle', 0.07);
    SND.drive = A.createWaveShaper(); SND.drive.curve = sndCurve(4); SND.drive.oversample = '2x';
    SND.elp = A.createBiquadFilter(); SND.elp.type = 'lowpass'; SND.elp.Q.value = 1.6; SND.elp.frequency.value = 500;
    SND.lope = A.createGain(); SND.lfo = A.createOscillator(); SND.lfo.frequency.value = 7; SND.lfoG = A.createGain(); SND.lfoG.gain.value = 0.3; SND.lfo.connect(SND.lfoG); SND.lfoG.connect(SND.lope.gain); SND.lfo.start();
    SND.eg = A.createGain(); SND.eg.gain.value = 0;
    mix.connect(SND.drive); SND.drive.connect(SND.elp); SND.elp.connect(SND.lope); SND.lope.connect(SND.eg); SND.eg.connect(SND.bus);
    // intake / exhaust rasp
    SND.ib = A.createBiquadFilter(); SND.ib.type = 'bandpass'; SND.ib.Q.value = 1.2; SND.ib.frequency.value = 600; SND.ig = A.createGain(); SND.ig.gain.value = 0; sndLoop(A, NB).connect(SND.ib); SND.ib.connect(SND.ig); SND.ig.connect(SND.bus);
    // tyres: band-passed hiss + two wobbling tones = squeal
    SND.sb = A.createBiquadFilter(); SND.sb.type = 'bandpass'; SND.sb.frequency.value = 1900; SND.sb.Q.value = 5; SND.sg = A.createGain(); SND.sg.gain.value = 0; sndLoop(A, NB).connect(SND.sb); SND.sb.connect(SND.sg); SND.sg.connect(SND.bus);
    SND.sq = A.createGain(); SND.sq.gain.value = 0; SND.sq.connect(SND.bus);
    SND.t1 = A.createOscillator(); SND.t1.type = 'sine'; SND.t2 = A.createOscillator(); SND.t2.type = 'triangle';
    const vib = A.createOscillator(); vib.frequency.value = 9; const vg = A.createGain(); vg.gain.value = 28; vib.connect(vg); vg.connect(SND.t1.frequency); vg.connect(SND.t2.frequency); vib.start();
    const t2g = A.createGain(); t2g.gain.value = 0.45; SND.t1.connect(SND.sq); SND.t2.connect(t2g); t2g.connect(SND.sq); SND.t1.start(); SND.t2.start();
    // gravel rumble + wind
    SND.gl = A.createBiquadFilter(); SND.gl.type = 'lowpass'; SND.gl.frequency.value = 420; SND.gg = A.createGain(); SND.gg.gain.value = 0; sndLoop(A, NB).connect(SND.gl); SND.gl.connect(SND.gg); SND.gg.connect(SND.bus);
    SND.wh = A.createBiquadFilter(); SND.wh.type = 'highpass'; SND.wh.frequency.value = 900; SND.wg = A.createGain(); SND.wg.gain.value = 0; sndLoop(A, NB).connect(SND.wh); SND.wh.connect(SND.wg); SND.wg.connect(SND.master);
  } catch (e) { console.warn('[audio]', e); SND.ctx = null; }
}
function sndBurst(dur, freq, gain, type) {
  const A = SND.ctx; if (!A || SND.muted) return; const t = A.currentTime, s = A.createBufferSource(); s.buffer = SND.NB;
  const f = A.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq; const g = A.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f); f.connect(g); g.connect(SND.bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function sndClank(v) {
  const A = SND.ctx; if (!A || SND.muted) return; const t = A.currentTime, k = Math.min(1, v / 700); sndBurst(0.18, 260, 0.5 * k);
  const o = A.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(170 + Math.random() * 60, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
  const g = A.createGain(); g.gain.setValueAtTime(0.12 * k, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3); o.connect(g); g.connect(SND.bus); o.start(t); o.stop(t + 0.35);
}
function sndPop() { const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) setTimeout(() => sndBurst(0.05 + Math.random() * 0.05, 900 + Math.random() * 900, 0.25 + Math.random() * 0.2), 40 + Math.random() * 320); }
function sndUpdate(c, active) {
  if (!SND.ctx || !SND.eg) return; const A = SND.ctx, t = A.currentTime, dt = Math.min(0.1, Math.max(0.001, t - (SND.lastT || t - 0.016))); SND.lastT = t;
  if (!active || !c) { for (const g of [SND.eg, SND.ig, SND.sg, SND.sq, SND.gg, SND.wg]) g.gain.setTargetAtTime(0, t, 0.12); SND.wet.gain.setTargetAtTime(0, t, 0.2); return; }
  const sp = Math.max(0, Math.min(1.1, (c.speed || 0) / CAR.MAXS)), thr = c.thr ? 1 : 0, slip = Math.abs(c.slip || 0);
  // gearbox with hysteresis
  let g = SND.gear; if (g < SND_GEARS.length - 1 && sp / SND_GEARS[g] > 0.96) { g++; SND.shiftCut = 0.09; } else if (g > 0 && sp / SND_GEARS[g - 1] < 0.62) g--; SND.gear = g;
  let target = SND_IDLE + (SND_RED - SND_IDLE) * Math.min(1, sp / SND_GEARS[g]);
  if (thr && sp < 0.04) target = Math.max(target, 3200);
  if (c.drift || c.hb) target += 900 * Math.min(1, slip * 1.4) * (thr ? 1 : 0.4);
  if (!thr) target = Math.max(SND_IDLE, target - 600);
  target = Math.min(SND_RED + 200, target);
  SND.rpm += (target - SND.rpm) * Math.min(1, dt * (target > SND.rpm ? 9 : 5));
  if (SND.shiftCut > 0) { SND.shiftCut -= dt; SND.rpm *= 1 - dt * 3; }
  if (SND.prevThr && !thr && SND.rpm > 4300 && Math.random() < 0.7) sndPop(); SND.prevThr = thr;
  if (thr && SND.rpm > SND_RED - 150 && g === SND_GEARS.length - 1 && Math.random() < dt * 4) sndBurst(0.04, 1400, 0.12);
  const rpm = SND.rpm, rn = (rpm - SND_IDLE) / (SND_RED - SND_IDLE), f = rpm / 30;
  SND.load += ((thr ? 1 : 0.15) - SND.load) * Math.min(1, dt * 6); const load = SND.load;
  SND.o1.frequency.setTargetAtTime(f, t, 0.03); SND.o2.frequency.setTargetAtTime(f / 2, t, 0.03); SND.o3.frequency.setTargetAtTime(f * 2.005, t, 0.03); SND.o4.frequency.setTargetAtTime(f * 3.5 + 180 * sp, t, 0.03);
  SND.elp.frequency.setTargetAtTime(260 + rpm * 0.22 + load * 1600 * (0.4 + rn), t, 0.04);
  SND.lfo.frequency.setTargetAtTime(f / 4 + Math.random() * 0.8, t, 0.1); SND.lfoG.gain.setTargetAtTime(Math.max(0, 0.32 - rn * 0.9), t, 0.1);
  const cut = SND.shiftCut > 0 ? 0.35 : 1;
  SND.eg.gain.setTargetAtTime((0.05 + 0.05 * rn + 0.05 * load) * cut, t, 0.03);
  SND.ib.frequency.setTargetAtTime(300 + rpm * 0.18, t, 0.05); SND.ig.gain.setTargetAtTime(0.03 * load * (0.3 + rn), t, 0.05);
  const fast = Math.min(1, (c.speed || 0) / 260), off = !!c.off;
  let sq = off ? 0 : Math.max(0, Math.min(1, (slip - 0.12) * 1.9)) * fast; if (c.hb && !off) sq = Math.max(sq, 0.5 * fast); if (c.brake && !off && sp > 0.35) sq = Math.max(sq, 0.35 * fast);
  SND.sq.gain.setTargetAtTime(sq * 0.06, t, 0.04); SND.sg.gain.setTargetAtTime(sq * 0.09, t, 0.04);
  const pitch = 760 + slip * 380 + sp * 180; SND.t1.frequency.setTargetAtTime(pitch, t, 0.06); SND.t2.frequency.setTargetAtTime(pitch * 1.48, t, 0.06); SND.sb.frequency.setTargetAtTime(1500 + slip * 900, t, 0.06);
  SND.gg.gain.setTargetAtTime(off ? 0.16 * Math.min(1, sp * 2.2) : 0, t, 0.06);
  SND.wg.gain.setTargetAtTime(0.035 * sp * sp, t, 0.2);
  if (c.wallHit > 60) sndClank(c.wallHit); c.wallHit = 0;
  const tun = (typeof G !== 'undefined' && G.tunT) || 0; SND.wet.gain.setTargetAtTime(tun * 0.55, t, 0.15);
}
function sndMute() { SND.muted = !SND.muted; try { localStorage.setItem('md_mute', SND.muted ? '1' : '0'); } catch (e) { } if (SND.master) SND.master.gain.value = SND.muted ? 0 : 0.6; return SND.muted; }
