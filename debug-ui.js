'use strict';
const fs=require('fs');
const c=fs.readFileSync('src/ui.js','utf8');
const idx2 = c.indexOf('card-hd">\ud83d\udce8 T\u1eadp h\u1ee3p');
const idx3 = c.indexOf('</div><!-- /panel-botmsg -->');
console.log('card idx:', idx2, 'end idx:', idx3);
if (idx2>0) {
  // Show 80 chars before card-hd
  const cardStart = c.lastIndexOf('<div class="card">', idx2);
  console.log('cardStart:', cardStart);
  console.log('before content:', JSON.stringify(c.slice(cardStart, cardStart+60)));
}
if (idx3>0) {
  console.log('before panel end:', JSON.stringify(c.slice(idx3-100, idx3+30)));
}
