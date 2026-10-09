// ===== Sessions =====
// The old "one game per account" lock is removed: opening the game no longer kicks or locks other tabs,
// and nothing is cleared or reset on start. These stubs stay so older code that calls them still works.
const SESS = { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), at: Date.now(), blocked: false };
function sessKick() { }
function sessClaim() { SESS.blocked = false; const o = document.getElementById('dupOv'); if (o) o.classList.add('hidden'); }
