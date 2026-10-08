// ===== Simple synthesized engine + tyre audio (no files needed) =====
const SND = { ctx: null, muted: localStorage.getItem('md_mute') === '1' };
function sndInit() {
  if (SND.ctx) return; try { const A = new (window.AudioContext || window.webkitAudioContext)(); SND.ctx = A;
    SND.master = A.createGain(); SND.master.gain.value = SND.muted ? 0 : 0.5; SND.master.connect(A.destination);
    SND.eng = A.createOscillator(); SND.eng.type = 'sawtooth'; SND.eng2 = A.createOscillator(); SND.eng2.type = 'square';
    const lp = A.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; SND.eg = A.createGain(); SND.eg.gain.value = 0.08;
    SND.eng.connect(lp); SND.eng2.connect(lp); lp.connect(SND.eg); SND.eg.connect(SND.master); SND.eng.start(); SND.eng2.start();
    const buf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = A.createBufferSource(); n.buffer = buf; n.loop = true; const bp = A.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 3;
    SND.sg = A.createGain(); SND.sg.gain.value = 0; n.connect(bp); bp.connect(SND.sg); SND.sg.connect(SND.master); n.start();
  } catch (e) { SND.ctx = null; }
}
function sndUpdate(c, active) {
  if (!SND.ctx) return; const t = SND.ctx.currentTime, sp = active ? c.speed / CAR.MAXS : 0;
  const gearRev = (sp * 5) % 1, f = 55 + sp * 90 + gearRev * 70;
  SND.eng.frequency.setTargetAtTime(f, t, 0.05); SND.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  SND.eg.gain.setTargetAtTime(active ? 0.05 + sp * 0.07 : 0, t, 0.1);
  SND.sg.gain.setTargetAtTime(active && (c.drift || c.hb) && c.speed > 120 ? Math.min(0.12, Math.abs(c.slip) * 0.15) : 0, t, 0.05);
}
function sndMute() { SND.muted = !SND.muted; localStorage.setItem('md_mute', SND.muted ? '1' : '0'); if (SND.master) SND.master.gain.value = SND.muted ? 0 : 0.5; return SND.muted; }
