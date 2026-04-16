const c = require('fs').readFileSync('src/ui.js', 'utf8');
// search for all button-related strings
['ctrl(', 'btn-red', 'btn btn-primary', 'panel-dashboard', 'Dừng', 'Chạy', 'status-row'].forEach(s => {
  const idx = c.indexOf(s);
  console.log(`"${s}" at: ${idx}`);
});
