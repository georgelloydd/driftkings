// ===== Key-based accounts + leaderboards =====
// Each player has a secret key (MD-XXXX-XXXX-XXXX). The key IS the login: no email or password.
// Without ONLINE config, everything is stored in this browser. With Supabase configured,
// profiles and lap times are synced so the key works on any device and leaderboards are global.
const CLOUD = !!(ONLINE.SUPABASE_URL && ONLINE.SUPABASE_ANON_KEY);
const KEY_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newKey() { const r = crypto.getRandomValues(new Uint8Array(12)); let s = 'MD'; for (let i = 0; i < 12; i++) { if (i % 4 === 0) s += '-'; s += KEY_ABC[r[i] % 32]; } return s; }
function normKey(k) { return String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^MD/, '').replace(/(.{4})(?=.)/g, '$1-').replace(/^/, 'MD-'); }
function validKey(k) { return /^MD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(k); }
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function blankStats() { return { races: 0, wins: 0, laps: 0, sessions: 0, drift: 0, dist: 0, best: {} }; }

const ACCT = {
  key: '', stats: blankStats(), pub: '', priv: '',
  async load() {
    let k = localStorage.getItem('md_key');
    if (!k || !validKey(k)) { k = newKey(); localStorage.setItem('md_key', k); }
    await this.use(k, false);
  },
  async use(k, fetchCloud) {
    this.key = k; localStorage.setItem('md_key', k); this.pub = (await sha('pub:' + k)).slice(0, 24); this.priv = await sha('priv:' + k);
    const local = JSON.parse(localStorage.getItem('md_acct_' + k) || 'null');
    let data = local;
    if (CLOUD && fetchCloud !== false) { try { const r = await sb('GET', 'profiles?id=eq.' + this.priv + '&select=data'); if (r && r[0]) data = r[0].data; } catch (e) { } }
    if (data) { this.stats = Object.assign(blankStats(), data.stats || {}); if (data.cfg) { Object.assign(CFG, data.cfg); } }
    else this.stats = blankStats();
    this.save(true);
    return !!data;
  },
  data() { return { cfg: { name: CFG.name, color: CFG.color, body: CFG.body, livery: CFG.livery }, stats: this.stats }; },
  save(localOnly) {
    if (!this.key) return; localStorage.setItem('md_acct_' + this.key, JSON.stringify(this.data()));
    if (CLOUD && !localOnly) { clearTimeout(this._t); this._t = setTimeout(() => sb('POST', 'profiles', { id: this.priv, data: this.data(), updated_at: new Date().toISOString() }, 'resolution=merge-duplicates').catch(() => { }), 800); }
  },
  backup() { return 'MDB1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ k: this.key, d: this.data() })))); },
  async restore(text) {
    text = String(text || '').trim();
    if (text.startsWith('MDB1.')) { const o = JSON.parse(decodeURIComponent(escape(atob(text.slice(5))))); localStorage.setItem('md_acct_' + o.k, JSON.stringify(o.d)); await this.use(o.k, false); return 'Account restored from backup code.'; }
    const k = normKey(text); if (!validKey(k)) throw new Error('That does not look like a key (MD-XXXX-XXXX-XXXX) or a backup code.');
    const found = await this.use(k, true);
    return found ? 'Signed in.' : CLOUD ? 'No saved account for that key, so a fresh profile was started with it.' : 'That key has no profile on this device. Use a backup code to move an account between devices.';
  },
  async create() { await this.use(newKey(), false); this.stats = blankStats(); this.save(); },
  // ---- stats ----
  addSession(o) { const s = this.stats; s.sessions++; s.laps += o.laps || 0; s.drift += o.drift || 0; s.dist += o.dist || 0; if (o.race) s.races++; if (o.win) s.wins++; this.save(); },
  bestLap(tr) { return (this.stats.best[tr] || {}).lap || 0; },
  lap(tr, ms, score) { const b = this.stats.best[tr] = this.stats.best[tr] || {}; let pb = false; if (!b.lap || ms < b.lap) { b.lap = ms; pb = true; LB.submit(tr, ms, score); } this.save(); return pb; },
};

async function sb(method, path, body, prefer) {
  const r = await fetch(ONLINE.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + path, { method, headers: { apikey: ONLINE.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + ONLINE.SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: prefer || 'return=minimal' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('Leaderboard server ' + r.status); const t = await r.text(); return t ? JSON.parse(t) : null;
}

const LB = {
  localGet(tr) { return JSON.parse(localStorage.getItem('md_lb_' + tr) || '[]'); },
  submit(tr, ms, score) {
    const e = { pid: ACCT.pub, name: CFG.name, color: CFG.color, body: CFG.body, lap: Math.round(ms), score: Math.round(score || 0), at: Date.now() };
    let L = this.localGet(tr).filter(x => x.pid !== e.pid || x.lap < e.lap); if (!L.some(x => x.pid === e.pid)) L.push(e);
    L.sort((a, b) => a.lap - b.lap); localStorage.setItem('md_lb_' + tr, JSON.stringify(L.slice(0, 50)));
    if (CLOUD) sb('POST', 'laps', { track: tr, pid: e.pid, name: e.name, color: e.color, body: e.body, lap_ms: e.lap, score: e.score }).catch(() => { });
  },
  async top(tr) {
    if (!CLOUD) return { live: false, rows: this.localGet(tr).slice(0, 10) };
    try {
      const r = await sb('GET', `laps?track=eq.${tr}&select=pid,name,color,body,lap_ms,score,created_at&order=lap_ms.asc&limit=200`);
      const seen = new Set(), rows = []; for (const x of r) { if (seen.has(x.pid)) continue; seen.add(x.pid); rows.push({ pid: x.pid, name: x.name, color: x.color, body: x.body, lap: x.lap_ms, score: x.score, at: Date.parse(x.created_at) }); if (rows.length >= 10) break; }
      return { live: true, rows };
    } catch (e) { return { live: false, err: true, rows: this.localGet(tr).slice(0, 10) }; }
  },
};
