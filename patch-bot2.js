'use strict';
const fs = require('fs');
let c = fs.readFileSync('src/bot-manager.js', 'utf8');

// Fix /start: change the arrow function to use body {} and getBotMsg for header
// Current broken state: bot.command('start', ctx => ctx.reply(\n  '🎰...' + ... );\n  });
// Target: bot.command('start', ctx => {\n  const h = getBotMsg(...);\n  ctx.reply(h + ... );\n  });
c = c.replace(
  /bot\.command\('start', ctx => ctx\.reply\(\n([\s\S]*?)\{ parse_mode: 'HTML' \}\n\s+\);\n\s+\}\);/,
  (match, body) => {
    // Remove the hardcoded emoji header line from body
    const withoutHeader = body.replace(/\s*'[^']*KQXS Live Bot[^']*'.*?\+\n/, '');
    return `bot.command('start', ctx => {
    const startHeader = getBotMsg('cmd_start_header', '🎰 <b>KQXS Live Bot</b>');
    return ctx.reply(
    startHeader + '\\n\\n' +
${withoutHeader}    { parse_mode: 'HTML' }
    );
  });`;
  }
);

fs.writeFileSync('src/bot-manager.js', c, 'utf8');
console.log('Fixed! start cmd now:', c.includes("const startHeader = getBotMsg('cmd_start_header'"));
