const fetch = require('node-fetch');
const cheerio = require('cheerio');

async function test() {
  const rs = await fetch('https://ketquaxoso3.com/xsmn/ngay-4-4-2024');
  const html = await rs.text();
  const $ = cheerio.load(html);
  const tables = $('table.tbl-xsmn');
  console.log('Tables found:', tables.length);
  
  const results = [];
  tables.each((_, table) => {
    const rows = $(table).find('tr');
    if (rows.length === 0) return;

    const firstRow = $(rows[0]);
    let headerCells = firstRow.find('td');
    if (headerCells.length === 0) headerCells = firstRow.find('th');

    const provinces = [];
    for (let ci = 1; ci < headerCells.length; ci++) {
      provinces.push($(headerCells[ci]).text().trim());
    }
    
    console.log('Provinces:', provinces);

    const prizesPerProvince = Array(provinces.length).fill().map(() => ({}));

    const titleMap = {
      'đb': 'prize_db', 'giải đb': 'prize_db',
      'g.1': 'prize_1', 'giải nhất': 'prize_1',
      'g.2': 'prize_2', 'giải nhì': 'prize_2',
      'g.3': 'prize_3', 'giải ba': 'prize_3',
      'g.4': 'prize_4', 'giải tư': 'prize_4',
      'g.5': 'prize_5', 'giải năm': 'prize_5',
      'g.6': 'prize_6', 'giải sáu': 'prize_6',
      'g.7': 'prize_7', 'giải bảy': 'prize_7',
      'g.8': 'prize_8', 'giải tám': 'prize_8',
    };

    for (let ri = 1; ri < rows.length; ri++) {
      const cells = $(rows[ri]).find('td');
      if (cells.length < 2) continue;

      let label = ($(cells[0]).attr('title') || $(cells[0]).text()).trim().toLowerCase();
      let prizeKey = null;
      for (const [k, v] of Object.entries(titleMap)) {
        if (label === k || label.includes(k)) { prizeKey = v; break; }
      }
      if (!prizeKey) continue;
      
      console.log('Found Prize:', prizeKey);

      for (let ci = 1; ci < cells.length; ci++) {
        let pi = ci - 1;
        if (pi >= provinces.length) break;

        let cell = $(cells[ci]);
        let innerHtml = '';
        cell.contents().each((_, node) => {
           if (node.type === 'text') {
             let t = $(node).text().trim();
             if (t) innerHtml += t + ' ';
           } else if (node.name === 'br') {
             innerHtml += ' ';
           } else {
             let t = $(node).text().trim();
             if (t) innerHtml += t + ' ';
           }
        });

        let nums = innerHtml.replace(/[^0-9 ]/g, ' ').trim();
        let parts = nums.split(' ').filter(n => /^\d{2,}$/.test(n.trim())).map(n => n.trim());
        if (parts.length > 0) {
          prizesPerProvince[pi][prizeKey] = parts.join(',');
        }
      }
    }

    provinces.forEach((province, pi) => {
      const prizes = prizesPerProvince[pi];
      if (prizes.prize_db && province) {
        results.push({ province, ...prizes });
      }
    });

  });
  console.log(JSON.stringify(results, null, 2));
}

test();
