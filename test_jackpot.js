const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function test() {
  const rs = await fetch('https://ketquaxoso3.com/mega-645');
  const html = await rs.text();
  const $ = cheerio.load(html);
  
  const h2 = $('h2.text-danger, h3.text-danger, span.text-danger, div.text-danger, strong.text-danger').text();
  console.log('TEXT DANGER:', h2);
  
  const tables = $('table.trunggiai');
  console.log('Trung giai:', tables.text().substring(0, 500));
}

test();
