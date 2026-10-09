// Loaded FIRST. Wipes save data left by older versions, which can break newer builds.
// Bump STORE_VER whenever the save format changes to force everyone to reset once.
// Only game keys are touched: the dev site shares this origin (md_dev_*, md_deploy_*, md_test_track are kept).
const STORE_VER = '2';
const GAME_KEY_RX = /^md_(key|cfg|mute|tab_claim|acct_|lb_|rec_|synced_|pending_|gfx|binds|store_)/;
function mdWipeGameData() {
  let oldKey = null; try { oldKey = localStorage.getItem('md_key'); } catch (e) {}
  try { const rm = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && GAME_KEY_RX.test(k)) rm.push(k); } rm.forEach(k => localStorage.removeItem(k)); } catch (e) {}
  try { const rm = []; for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); if (k && k.startsWith('md_') && !k.startsWith('md_dev')) rm.push(k); } rm.forEach(k => sessionStorage.removeItem(k)); } catch (e) {}
  try { // cookies: expire every one we can see, on this path and its parents
    const parts = location.pathname.split('/').filter(Boolean), paths = ['/']; let p = ''; parts.forEach(s => { p += '/' + s; paths.push(p, p + '/'); });
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean).forEach(n => paths.forEach(pa => { document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + pa; }));
  } catch (e) {}
  return oldKey;
}
(function () {
  let ver = null, hasOld = false;
  try { ver = localStorage.getItem('md_store_ver'); for (let i = 0; i < localStorage.length; i++) if (GAME_KEY_RX.test(localStorage.key(i) || '') && localStorage.key(i) !== 'md_store_ver') { hasOld = true; break; } } catch (e) {}
  if (ver === STORE_VER) return;
  const oldKey = hasOld || document.cookie ? mdWipeGameData() : null;
  try { localStorage.setItem('md_store_ver', STORE_VER); } catch (e) {}
  if (oldKey) window.MD_RESET_KEY = oldKey;
})();
// One-time notice with the old key so the player can sign back in (cloud times and name come back).
function mdResetNotice(key, manual) {
  const ov = document.createElement('div'); ov.className = 'resetOv';
  ov.innerHTML = `<div class="resetBox"><h3>${manual ? 'Save data cleared' : 'Old save data cleared'}</h3>
    <p>${manual ? 'All local game data on this browser was removed.' : 'This version of Mini Drifters uses a new save format, so data from older versions was removed to stop things breaking.'}</p>
    ${key ? `<p>Your old player key:</p><div class="row"><input readonly value="${String(key).replace(/[^A-Za-z0-9-]/g, '')}" id="resetKey"><button class="btn sm" id="resetCopy">Copy</button></div>
    <p class="sm">To keep your name and cloud lap times, go to <b>Account</b> and sign in with this key. Or ignore it to start fresh.</p>` : ''}
    <div class="row"><button class="btn primary" id="resetOk">OK</button></div></div>`;
  document.body.appendChild(ov);
  const c = ov.querySelector('#resetCopy'); if (c) c.onclick = () => { const i = ov.querySelector('#resetKey'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).catch(() => document.execCommand('copy')); c.textContent = 'Copied'; };
  ov.querySelector('#resetOk').onclick = () => { ov.remove(); if (manual) location.reload(); };
}
function mdManualReset() {
  if (!confirm('Clear ALL local game data on this browser (settings, local times, cached account)? Your cloud account is not deleted.')) return;
  const k = mdWipeGameData(); try { localStorage.setItem('md_store_ver', STORE_VER); } catch (e) {} mdResetNotice(k, true);
}
window.addEventListener('DOMContentLoaded', () => {
  if (window.MD_RESET_KEY) mdResetNotice(window.MD_RESET_KEY, false);
  const g = document.getElementById('bGfxReset'); if (g && !document.getElementById('bWipe')) { const b = document.createElement('button'); b.id = 'bWipe'; b.className = 'opt'; b.textContent = 'Clear save data'; b.onclick = mdManualReset; g.parentNode.appendChild(b); }
});
