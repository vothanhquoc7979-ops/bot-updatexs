'use strict';
const fs = require('fs');
let c = fs.readFileSync('src/ui.js', 'utf8');

// Find ctrl by position
const ctrlStart = c.indexOf('    // \u2500\u2500 Control \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
console.log('ctrl block starts at:', ctrlStart);
// Find the end: the next comment or function after the broken flash
const flashEnd = c.indexOf('    // \u2500\u2500 Save config form', ctrlStart);
console.log('flash block ends at:', flashEnd);

if (ctrlStart < 0 || flashEnd < 0) {
  console.error('Markers not found');
  process.exit(1);
}

const before = c.slice(0, ctrlStart);
const after  = c.slice(flashEnd);

const newBlock = `    // \u2500\u2500 Control \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r\n    async function ctrl(action, region) {\r\n      const r = await fetch('/api/control', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action, region}) });\r\n      const d = await r.json();\r\n      flash(d.msg || (d.ok ? 'OK' : 'L\u1ed7i'), d.ok);\r\n    }\r\n\r\n    // \u2500\u2500 Clear logs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r\n    async function clearLogs() {\r\n      await fetch('/api/control', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'clear_logs'}) });\r\n      document.getElementById('logbox').innerHTML = '';\r\n    }\r\n\r\n    // \u2500\u2500 G\u1ecdi API Vietlott th\u1ee7 c\u00f4ng \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r\n    async function pollVietlott() {\r\n      const btn = document.getElementById('btn-poll-vl');\r\n      const msg = document.getElementById('poll-vl-msg');\r\n      btn.disabled = true;\r\n      btn.textContent = '\u23f3 \u0110ang g\u1ecdi...';\r\n      msg.textContent = '';\r\n      try {\r\n        const r = await fetch('/api/poll-vietlott', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({game:'all'}) });\r\n        const d = await r.json();\r\n        if (d.ok) { msg.style.color='#4caf50'; msg.textContent='\u2705 \u0110\u00e3 g\u1ecdi! Xem log b\u00ean d\u01b0\u1edbi.'; }\r\n        else       { msg.style.color='#ef5350'; msg.textContent='\u274c '+(d.msg||'L\u1ed7i'); }\r\n      } catch(e) { msg.style.color='#ef5350'; msg.textContent='\u274c '+e.message; }\r\n      finally {\r\n        btn.disabled = false;\r\n        btn.textContent = '\ud83d\udd17 G\u1ecdi API Vietlott';\r\n        setTimeout(() => { msg.textContent=''; }, 6000);\r\n      }\r\n    }\r\n\r\n    // \u2500\u2500 Flash message \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\r\n    function flash(msg, ok = true) {\r\n      const el = document.getElementById('flash');\r\n      el.textContent = (ok ? '\u2705 ' : '\u274c ') + msg;\r\n      el.className = 'alert ' + (ok ? 'alert-ok' : 'alert-err');\r\n      el.style.display = 'block';\r\n      clearTimeout(flash._t);\r\n      flash._t = setTimeout(() => { el.style.display = 'none'; }, 4000);\r\n    }\r\n\r\n    `;

c = before + newBlock + after;
console.log('pollVietlott added:', c.includes('pollVietlott'));
console.log('clearLogs added:', c.includes('clearLogs'));
console.log('flash preserved:', c.includes('function flash(msg'));
fs.writeFileSync('src/ui.js', c, 'utf8');
console.log('Done. File size:', c.length);
