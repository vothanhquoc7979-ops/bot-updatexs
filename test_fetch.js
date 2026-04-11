const c = require('./src/crawler-vietlott');
async function run() {
  const [y, m, d] = '2021-08-31'.split('-');
  const url = `https://ketqua.plus/xo-so-max-4d/ngay-${d}-${m}-${y}`;
  console.log('Fetching', url);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0'} });
  const html = await res.text();
  console.log('HTML len:', html.length);
  const match = html.match(/window\.__SSR_DATA__\s*=\s*(\{.*?\});<\/script>/s);
  if (!match) return console.log('No regex match');
  console.log('Match len:', match[1].length);
  const json = JSON.parse(match[1]);
  const draws = json?.vietlott_list?.draws || [];
  console.log('Draws count:', draws.length);
  const draw = draws.find(dObj => (dObj.drawDate || '').startsWith('2021-08-31'));
  console.log('Draw found:', !!draw);
}
run();
