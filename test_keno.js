const cheerio = require('cheerio');
async function run() {
  const html = await (await fetch('https://ketqua.plus/xo-so-keno')).text();
  const $ = cheerio.load(html);
  const scripts = $('script[src]').map((i, el) => $(el).attr('src')).get();
  for (let s of scripts) {
    if (!s.endsWith('.js')) continue;
    let src = s.startsWith('/') ? 'https://ketqua.plus' + s : s;
    const js = await (await fetch(src)).text();
    if (js.includes('public/vietlott/keno')) {
      console.log('FOUND string in', src);
      const parts = js.split('public/vietlott/keno');
      console.log(parts[0].substr(-200), '=====', parts[1].substr(0, 200));
    }
  }
}
run();
