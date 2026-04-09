const cheerio = require('cheerio');
fetch('https://ketquaxoso3.com/mega-645')
  .then(r => r.text())
  .then(t => {
    const d = t.match(/jackpot[^0-9]*([0-9\.]+)\s*(VNĐ|đồng)/i);
    console.log('JACKPOT REGEX MATCH:', d ? d[1] : null);
    const $ = cheerio.load(t);
    console.log('DANGER CLASS:', $('.text-danger').text());
    
    // Tìm trong bảng
    const tables = $('table.trunggiai');
    let jackpotFound = '';
    tables.find('tr').each((_, tr) => {
        const tds = $(tr).find('td');
        if (tds.length >= 4) {
            let label = $(tds[0]).text().toLowerCase();
            if (label.includes('j.pot') || label.includes('jackpot')) {
                jackpotFound = $(tds[3]).text().trim();
            }
        }
    });
    console.log('TABLE JACKPOT VALUE:', jackpotFound);
  });
