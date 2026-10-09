// ===== One active game per account =====
// The newest tab/device to open the game wins; any older ones are kicked out of races/rooms and locked behind an overlay.
// Same browser: BroadcastChannel (localStorage fallback). Other devices: presence on the global Supabase channel (see chat.js).
const SESS = { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), at: Date.now(), blocked: false, bc: null };
function sessKick(why) {
  if (SESS.blocked) return; SESS.blocked = true;
  try { if (G.state !== 'menu' || G.mp) toMenu(); } catch (e) { console.warn('[session]', e); }
  for (const k in KEYS) KEYS[k] = false;
  try { chatClose(); } catch (e) { }
  $('dupMsg').textContent = why; $('dupOv').classList.remove('hidden');
}
function sessClaim() {
  SESS.at = Date.now(); SESS.blocked = false; $('dupOv').classList.add('hidden');
  const m = { t: 'claim', id: SESS.id, at: SESS.at };
  if (SESS.bc) SESS.bc.postMessage(m); else localStorage.setItem('md_tab_claim', JSON.stringify(m));
  try { chatTrack(); } catch (e) { }
}
function sessSeen(m) { if (m && m.t === 'claim' && m.id !== SESS.id) sessKick('Mini Drifters was opened in another tab. Only one game per account can be played at a time.'); }
try { SESS.bc = new BroadcastChannel('md-session'); SESS.bc.onmessage = e => sessSeen(e.data); } catch (e) { SESS.bc = null; }
addEventListener('storage', e => { if (e.key === 'md_tab_claim' && e.newValue) try { sessSeen(JSON.parse(e.newValue)); } catch (x) { } });
addEventListener('load', () => { $('dupBtn').onclick = sessClaim; sessClaim(); });
