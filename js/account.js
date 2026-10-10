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
const GUEST_NAME = 'Driver';
function cleanName(n) { return String(n || '').trim().replace(/\s+/g, ' ').slice(0, 14); }
function blankStats() { return { races: 0, wins: 0, laps: 0, sessions: 0, drift: 0, dist: 0, best: {} }; }

const ACCT = {
  key: '', stats: blankStats(), pub: '', priv: '', reg: false, // reg = created an account (guests only save on this device)
  async load() {
    let k = localStorage.getItem('md_key');
    if (!k || !validKey(k)) { k = newKey(); localStorage.setItem('md_key', k); }
    await this.use(k);
  },
  async use(k, fetchCloud) {
    this.key = k; localStorage.setItem('md_key', k); this.pub = (await sha('pub:' + k)).slice(0, 24); this.priv = await sha('priv:' + k);
    const local = JSON.parse(localStorage.getItem('md_acct_' + k) || 'null');
    let data = local;
    if (CLOUD && fetchCloud !== false) { try { const r = await Promise.race([sb('GET', 'profiles?id=eq.' + this.priv + '&select=data'), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 4000))]); if (r && r[0]) data = r[0].data; } catch (e) { } }
    if (data) { this.stats = Object.assign(blankStats(), data.stats || {}); if (data.cfg) { Object.assign(CFG, data.cfg); } }
    else this.stats = blankStats();
    this.reg = !!(data && data.reg); if (!this.reg) CFG.name = GUEST_NAME; loadTweaks();
    this.save(true); if (CLOUD && this.reg) { this.save(); syncBests(false); this.register(); LB.flush(); }
    return !!data;
  },
  // lets the admin dev site look up a forgotten key by player name (needs register_key from supabase-admin.sql; silently skipped if missing)
  register() { if (CLOUD && this.key && this.reg) sb('POST', 'rpc/register_key', { p_key: this.key, p_name: CFG.name }).catch(() => { }); },
  data() { return { cfg: Object.assign({ name: CFG.name }, carLook(CFG)), stats: this.stats, reg: this.reg }; },
  save(localOnly) {
    if (!this.key) return; localStorage.setItem('md_acct_' + this.key, JSON.stringify(this.data()));
    if (CLOUD && this.reg && !localOnly) { clearTimeout(this._t); this._t = setTimeout(() => sb('POST', 'profiles', { id: this.priv, data: this.data(), updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal').catch(() => { }), 800); }
  },
  backup() { return 'MDB1.' + btoa(unescape(encodeURIComponent(JSON.stringify({ k: this.key, d: this.data() })))); },
  async restore(text) {
    text = String(text || '').trim();
    if (text.startsWith('MDB1.')) { const o = JSON.parse(decodeURIComponent(escape(atob(text.slice(5))))); localStorage.setItem('md_acct_' + o.k, JSON.stringify(o.d)); await this.use(o.k, false); return 'Account restored from backup code.'; }
    const k = normKey(text); if (!validKey(k)) throw new Error('That does not look like a key (MD-XXXX-XXXX-XXXX) or a backup code.');
    const found = await this.use(k, true);
    return found ? 'Signed in.' : CLOUD ? 'No saved account for that key, so a fresh profile was started with it.' : 'That key has no profile on this device. Use a backup code to move an account between devices.';
  },
  // log out: forget this key on this device's active slot and go back to a fresh guest called Driver
  async logout() {
    this.save(true); clearTimeout(this._t); localStorage.removeItem('md_key');
    await this.use(newKey(), false); this.stats = blankStats(); this.reg = false; CFG.name = GUEST_NAME; this.save(true);
  },
  // names are unique (case-insensitive) and 'Driver' is kept for guests. Throws with a friendly message if not allowed.
  async checkName(name) {
    name = cleanName(name);
    if (name.length < 2) throw new Error('Pick a driver name (2 to 14 characters).');
    if (/^driver\d*$/i.test(name)) throw new Error('"Driver" is the guest name. Pick something else.');
    const low = name.toLowerCase();
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('md_acct_') || k === 'md_acct_' + this.key) continue;
      try { const d = JSON.parse(localStorage.getItem(k) || 'null'); if (d && d.reg && d.cfg && String(d.cfg.name || '').toLowerCase() === low) throw new Error('Someone already has that name. Try another one.'); } catch (e) { if (/already/.test(e.message)) throw e; } }
    if (!CLOUD) return name;
    let free = null;
    try { free = await sb('POST', 'rpc/name_available', { p_name: name, p_key: this.key }, 'return=representation'); }
    catch (e) { // older database without name_available: check the public leaderboard names instead
      try { const r = await sb('GET', 'laps?select=pid&limit=1&pid=neq.' + this.pub + '&name=ilike.' + encodeURIComponent(name.replace(/[%_*\\]/g, '\\$&'))); free = !(r && r.length); } catch (e2) { throw new Error('Could not check if that name is free. Check your connection and try again.'); } }
    if (free === false) throw new Error('Someone already has that name. Try another one.');
    return name;
  },
  // turn the current guest profile into an account: from now on it syncs to Supabase and shows on the online leaderboards
  async signUp(name) {
    name = await this.checkName(name);
    CFG.name = name; this.reg = true; this.save(); this.register();
    if (CLOUD) { await syncBests(true); LB.flush(); return 'Account created! Your best laps are now on the online leaderboards. Copy your key below so you can sign in on other devices.'; }
    return 'Account created! Copy your key below to keep it safe.';
  },
  // ---- stats ----
  addSession(o) { const s = this.stats; s.sessions++; s.laps += o.laps || 0; s.drift += o.drift || 0; s.dist += o.dist || 0; if (o.race) s.races++; if (o.win) s.wins++; this.save(); },
  bestLap(tr) { return (this.stats.best[tr] || {}).lap || 0; },
  async rename(name) {
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('md_lb_')) continue; const L = JSON.parse(localStorage.getItem(k) || '[]'); L.forEach(x => { if (x.pid === this.pub) x.name = name; }); localStorage.setItem(k, JSON.stringify(L)); }
    if (!CLOUD || !this.reg) return 'Name saved.';
    try { await sb('POST', 'rpc/rename_player', { p_key: this.key, p_name: name }); this.register(); return 'Name saved and updated on the online leaderboards.'; }
    catch (e) { return /404|PGRST202|rename_player/.test(e.message) ? 'Name saved. Old online leaderboard times keep the old name until you run the rename_player SQL from the README.' : 'Name saved here, but the online update failed: ' + e.message; }
  },
  lap(tr, ms, score, rep) { const b = this.stats.best[tr] = this.stats.best[tr] || {}; let pb = false; if (!b.lap || ms < b.lap) { b.lap = ms; pb = true; }
    let sy = null; try { sy = JSON.parse(localStorage.getItem('md_synced_' + this.key) || '{}')[tr]; } catch (e) { }
    if (pb || (this.reg && (!sy || ms < sy))) LB.submit(tr, ms, score, rep); this.save(); return pb; },
};

let ONLINE_ERR = '';
async function sb(method, path, body, prefer) {
  const key = ONLINE.SUPABASE_ANON_KEY.trim(), h = { apikey: key, 'Content-Type': 'application/json', Prefer: prefer || 'return=minimal' };
  if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key; // legacy anon JWT only; sb_publishable_ keys go in apikey alone
  let r; try { r = await fetch(ONLINE.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '') + '/rest/v1/' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); }
  catch (e) { ONLINE_ERR = 'Could not reach Supabase. Check SUPABASE_URL (should look like https://xxxx.supabase.co).'; throw new Error(ONLINE_ERR); }
  const t = await r.text();
  if (!r.ok) { let m = t; try { const j = JSON.parse(t); m = [j.message, j.hint, j.details].filter(Boolean).join(' · '); } catch (e) { } ONLINE_ERR = `${method} ${path.split('?')[0]} failed (${r.status}): ${m}`; console.warn('[Supabase]', ONLINE_ERR); throw new Error(ONLINE_ERR); }
  ONLINE_ERR = ''; return t ? JSON.parse(t) : null;
}
async function testOnline() {
  if (!CLOUD) return { ok: false, msg: 'Online is off: js/config.js has no SUPABASE_URL / SUPABASE_ANON_KEY on this deployed site.' };
  const steps = [];
  try { await sb('GET', 'laps?select=id&limit=1'); steps.push('✓ read laps'); if (!ACCT.reg) return { ok: true, msg: steps.join(' ') + ' · you are a guest: create an account to save online' }; } catch (e) { return { ok: false, msg: e.message }; }
  try { await sb('POST', 'profiles', { id: ACCT.priv, data: ACCT.data(), updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal'); steps.push('✓ save profile'); } catch (e) { return { ok: false, msg: steps.join(' ') + ' ✗ ' + e.message }; }
  const n = await syncBests(true); steps.push(`✓ uploaded ${n} best lap${n === 1 ? '' : 's'}`);
  return { ok: true, msg: steps.join(' · ') };
}
// one row per player per track: the submit_lap function only replaces it when the new lap is faster.
// Falls back to a plain insert if the upgrade SQL hasn't been run yet.
async function submitLap(tr, e) {
  const r = { p_track: +tr, p_pid: e.pid || ACCT.pub, p_name: CFG.name, p_color: CFG.color, p_body: CFG.body, p_lap_ms: Math.round(e.lap), p_score: Math.round(e.score || 0) };
  const perm = er => { const m = /\((\d{3})\)/.exec(er.message), s = m ? +m[1] : 0; if (s >= 400 && s < 500 && s !== 408 && s !== 429) er.perm = true; return er; };
  if (e.rep) { r.p_replay = e.rep; try { await sb('POST', 'rpc/submit_lap', r); return; } catch (er) { if (!/\(404\)|PGRST202/.test(er.message)) throw perm(er); delete r.p_replay; } }
  try { await sb('POST', 'rpc/submit_lap', r); }
  catch (er) { if (!/\(404\)|PGRST202/.test(er.message)) throw perm(er);
    // old database without submit_lap: plain insert (a duplicate means the server already has a time for us)
    try { await sb('POST', 'laps', { track: r.p_track, pid: r.p_pid, name: r.p_name, color: r.p_color, body: r.p_body, lap_ms: r.p_lap_ms, score: r.p_score }); }
    catch (e2) { if (/\(409\)|23505/.test(e2.message)) { const x = new Error('Run the latest admin SQL in Supabase so faster laps can replace old ones.'); x.perm = true; throw x; } throw perm(e2); } }
}
// push every local best lap up once, so laps set before Supabase was configured still appear
async function syncBests(force) {
  if (!CLOUD || !ACCT.reg) return 0; let n = 0; const done = JSON.parse(localStorage.getItem('md_synced_' + ACCT.key) || '{}');
  for (const tr in ACCT.stats.best) { const lap = ACCT.stats.best[tr].lap; if (!lap || (!force && done[tr] === lap)) continue;
    try { await submitLap(tr, { pid: ACCT.pub, lap, score: 0 }); done[tr] = lap; n++; } catch (e) { break; } }
  localStorage.setItem('md_synced_' + ACCT.key, JSON.stringify(done)); return n;
}
const LB = {
  localGet(tr) { return JSON.parse(localStorage.getItem('md_lb_' + tr) || '[]'); },
  submit(tr, ms, score, rep) {
    const e = { pid: ACCT.pub, name: CFG.name, color: CFG.color, body: CFG.body, lap: Math.round(ms), score: Math.round(score || 0), at: Date.now() };
    let L = this.localGet(tr).filter(x => x.pid !== e.pid || x.lap < e.lap); if (!L.some(x => x.pid === e.pid)) L.push(e);
    L.sort((a, b) => a.lap - b.lap); localStorage.setItem('md_lb_' + tr, JSON.stringify(L.slice(0, 50)));
    if (CLOUD && ACCT.reg) this.queue(tr, rep ? Object.assign({ rep }, e) : e); // guests: this device only, never sent to Supabase
  },
  rej() { return JSON.parse(localStorage.getItem('md_rej_' + ACCT.key) || '{}'); },
  pend() { return JSON.parse(localStorage.getItem('md_pending_' + ACCT.key) || '{}'); },
  queue(tr, e) { const P = this.pend(); if (!P[tr] || e.lap < P[tr].lap) P[tr] = e; localStorage.setItem('md_pending_' + ACCT.key, JSON.stringify(P)); this.flush(); },
  async flush() {
    if (!CLOUD || !ACCT.reg || this.busy) return; this.busy = true; clearTimeout(this.rt); let okAny = false, failed = false;
    try { const P = this.pend();
      for (const tr in P) { const e = P[tr];
        try { await submitLap(tr, e);
          const Q = this.pend(); if (Q[tr] && Q[tr].lap === e.lap) delete Q[tr]; localStorage.setItem('md_pending_' + ACCT.key, JSON.stringify(Q));
          const done = JSON.parse(localStorage.getItem('md_synced_' + ACCT.key) || '{}'); done[tr] = e.lap; localStorage.setItem('md_synced_' + ACCT.key, JSON.stringify(done)); okAny = true; }
        catch (er) { if (er.perm) { const Q = this.pend(); delete Q[tr]; localStorage.setItem('md_pending_' + ACCT.key, JSON.stringify(Q)); const rj = this.rej(); rj[tr] = { lap: Math.round(e.lap), why: er.message }; localStorage.setItem('md_rej_' + ACCT.key, JSON.stringify(rj)); okAny = true; console.warn('[Supabase] lap rejected', er.message); }
          else failed = true; } }
    } finally { this.busy = false; }
    if (failed) { if (!this.warned && typeof pop === 'function' && G.state !== 'menu') { this.warned = true; pop('LAP NOT UPLOADED YET · RETRYING', '#ff9a2a'); } this.rt = setTimeout(() => this.flush(), 15000); }
    else this.warned = false;
    if (okAny && typeof TAB !== 'undefined' && TAB === 'lb' && typeof loadLB === 'function' && G.state === 'menu') loadLB();
    if (Object.keys(this.pend()).length && !failed) this.flush();
  },
  async top(tr) {
    if (!CLOUD) return { live: false, rows: this.localGet(tr).slice(0, 10) };
    try {
      const r = await sb('GET', `laps?track=eq.${tr}&select=pid,name,color,body,lap_ms,score,created_at&order=lap_ms.asc&limit=100`);
      const seen = new Set(), rows = []; for (const x of r) { if (seen.has(x.pid)) continue; seen.add(x.pid); rows.push({ pid: x.pid, name: x.name, color: x.color, body: x.body, lap: x.lap_ms, score: x.score, at: Date.parse(x.created_at) }); }
      const mine = Math.round(ACCT.bestLap(tr)), P = this.pend(), srv = rows.find(x => x.pid === ACCT.pub);
      if (ACCT.reg && mine && !TRACKS[tr].test && (!srv || mine < srv.lap) && (r.length < 100 || mine <= r[r.length - 1].lap_ms)) {
        const rj = this.rej()[tr], bad = rj && rj.lap === mine;
        if (!P[tr] && !bad) this.queue(tr, { pid: ACCT.pub, lap: mine, score: 0 });
        const me = { pid: ACCT.pub, name: CFG.name, color: CFG.color, body: CFG.body, lap: mine, at: Date.now(), pending: !bad, failed: bad ? rj.why : '' };
        const i = rows.indexOf(srv); if (i >= 0) rows.splice(i, 1); rows.push(me); rows.sort((a, b) => a.lap - b.lap); }
      return { live: true, rows: rows.slice(0, 10) };
    } catch (e) { return { live: false, err: true, rows: this.localGet(tr).slice(0, 10) }; }
  },
};

// admin troll tweaks for this player (Troll tab on the dev site). Checked every 15 s so changes apply mid-race.
async function loadTweaks() {
  if (!CLOUD || !ACCT.pub) return;
  try { const r = await sb('GET', 'player_tweaks?pid=eq.' + ACCT.pub + '&select=data'), d = (r && r[0] && r[0].data) || {}, t = Object.assign({}, TW_DEF);
    for (const k in TW_DEF) { const v = d[k]; if (typeof v === 'number' && isFinite(v)) t[k] = k === 'inv' ? (v ? 1 : 0) : Math.max(k === 'maxs' || k === 'engine' ? 0.05 : 0, Math.min(10, v)); }
    TWEAKS = t; if (G.me) G.me.tw = TWEAKS; } catch (e) { }
}
setInterval(loadTweaks, 15000);
