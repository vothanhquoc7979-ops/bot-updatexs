const fetch = require('node-fetch');

async function run() {
  const rs = await fetch('https://ketquaxoso3.com/xsmn/ngay-4-4-2026');
  const txt = await rs.text();
  console.log(txt.length);
  if (txt.includes('tbl-xsmn')) console.log('tbl-xsmn FOUND');
  else console.log('tbl-xsmn NOT FOUND');
}
run();
