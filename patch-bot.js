'use strict';
const fs = require('fs');
let c = fs.readFileSync('src/bot-manager.js', 'utf8');

// ─── 1. Add getBotMsg + fillTpl helpers after tgLog ──────────────────────────
c = c.replace(
  '  }\n\n  function formatResults(results) {',
  `  }

  // ── Bot message template helper ───────────────────────────────────────────
  function getBotMsg(key, def) {
    const cfg = storage.load();
    const val = cfg.bot_messages ? cfg.bot_messages[key] : '';
    return (val && val.trim()) ? val.trim() : def;
  }
  function fillTpl(tpl, vars) {
    return tpl.replace(/\\{(\\w+)\\}/g, (_, k) => vars[k] !== undefined ? vars[k] : _);
  }

  function formatResults(results) {`
);

// ─── 2. /start — wrap header with getBotMsg ───────────────────────────────
// Replace the hardcoded emoji prefix in /start with getBotMsg
c = c.replace(
  "bot.command('start', ctx => ctx.reply(\n    '\\ud83c\\udfb0 <b>KQXS Live Bot</b>\\n\\n' +",
  "bot.command('start', ctx => {\n    const startHeader = getBotMsg('cmd_start_header', '\\ud83c\\udfb0 <b>KQXS Live Bot</b>');\n    ctx.reply(\n    startHeader + '\\n\\n' +"
);
// Close old reply with ) change to }); style
c = c.replace(
  "    { parse_mode: 'HTML' }\n  ));\n\n  // ── /model",
  "    { parse_mode: 'HTML' }\n    );\n  });\n\n  // ── /model"
);

// ─── 3. /chay ────────────────────────────────────────────────────────────────
c = c.replace(
  "return ctx.reply('🚀 Đã bắt đầu poll cả 3 miền!');",
  "return ctx.reply(getBotMsg('cmd_chay_all', '🚀 Đã bắt đầu poll cả 3 miền!'), { parse_mode: 'HTML' });"
);
c = c.replace(
  "ctx.reply(`🚀 Bắt đầu poll ${REGION_NAMES[arg]}...`);",
  "ctx.reply(fillTpl(getBotMsg('cmd_chay_region', '🚀 Bắt đầu poll {region_name}...'), { region_name: REGION_NAMES[arg] }), { parse_mode: 'HTML' });"
);

// ─── 4. /dung ────────────────────────────────────────────────────────────────
c = c.replace(
  "if (!arg || arg === 'all') { stopAll(tgLog); return ctx.reply('⏹ Đã dừng tất cả.'); }",
  "if (!arg || arg === 'all') { stopAll(tgLog); return ctx.reply(getBotMsg('cmd_dung_all', '⏹ Đã dừng tất cả.'), { parse_mode: 'HTML' }); }"
);
c = c.replace(
  "ctx.reply(`⏹ Đã dừng ${REGION_NAMES[arg]}`);",
  "ctx.reply(fillTpl(getBotMsg('cmd_dung_region', '⏹ Đã dừng {region_name}'), { region_name: REGION_NAMES[arg] }), { parse_mode: 'HTML' });"
);

// ─── 5. /xem ─────────────────────────────────────────────────────────────────
c = c.replace(
  "ctx.reply(`📊 <b>KQ ${REGION_NAMES[arg]}</b>\\n\\n` + formatResults(data), { parse_mode: 'HTML' });",
  "const xHeader = fillTpl(getBotMsg('cmd_xem_header', '📊 <b>KQ {region_name}</b>'), { region_name: REGION_NAMES[arg] });\n    ctx.reply(xHeader + '\\n\\n' + formatResults(data), { parse_mode: 'HTML' });"
);

// ─── 6. /status ──────────────────────────────────────────────────────────────
c = c.replace(
  "ctx.reply('📊 <b>Trạng thái:</b>\\n\\n' + getStatus(), { parse_mode: 'HTML' });",
  "ctx.reply(getBotMsg('cmd_status_header', '📊 <b>Trạng thái:</b>') + '\\n\\n' + getStatus(), { parse_mode: 'HTML' });"
);

// ─── 7. /lichxo ──────────────────────────────────────────────────────────────
c = c.replace(
  "ctx.reply(\n      '📅 <b>Lịch xổ hôm nay</b>\\n\\n' +\n      '🟢 Miền Nam / Miền Trung: 16:00 – 17:30\\n' +\n      '🔴 Miền Bắc: 18:30 – 19:15',",
  "ctx.reply(\n      getBotMsg('cmd_lichxo',\n        '📅 <b>Lịch xổ hôm nay</b>\\n\\n🟢 Miền Nam / Miền Trung: 16:00 – 17:30\\n🔴 Miền Bắc: 18:30 – 19:15'\n      ),"
);

// ─── 8. /cancelbai ───────────────────────────────────────────────────────────
c = c.replace(
  "ctx.reply('🗑️ Đã hủy phiên làm việc hiện tại.\\nDùng /link [url] để bắt đầu mới.');",
  "ctx.reply(getBotMsg('cmd_cancelbai', '🗑️ Đã hủy phiên làm việc hiện tại.\\nDùng /link [url] để bắt đầu mới.'), { parse_mode: 'HTML' });"
);

// ─── 9. /keys ────────────────────────────────────────────────────────────────
c = c.replace(
  "return ctx.reply('❌ Chưa có Groq API key nào!\\n\\n👉 Vào Dashboard → mục Groq Keys để thêm key.');",
  "return ctx.reply(getBotMsg('cmd_keys_empty', '❌ Chưa có Groq API key nào!\\n\\n👉 Vào Dashboard → mục Groq Keys để thêm key.'));"
);
c = c.replace(
  "ctx.reply(\n      `🔑 <b>Groq API Keys (${keys.length} keys)</b>\\n\\n${list}\\n\\n` +",
  "const keysHeader = getBotMsg('cmd_keys_header', '🔑 <b>Groq API Keys</b>');\n    ctx.reply(\n      `${keysHeader} (${keys.length} keys)\\n\\n${list}\\n\\n` +"
);

// ─── 10. /resetgroq ─────────────────────────────────────────────────────────
c = c.replace(
  "return ctx.reply('❌ Chưa có Groq API key nào để reset.\\n👉 Vào Dashboard để thêm key.');",
  "return ctx.reply(getBotMsg('cmd_resetgroq_empty', '❌ Chưa có Groq API key nào để reset.\\n👉 Vào Dashboard để thêm key.'));"
);
c = c.replace(
  "resetCount > 0\n        ? `✅ <b>Đã reset ${resetCount} key!</b>\\n\\nTất cả keys đã sẵn sàng. Thử <code>/link [url]</code> lại nhé.`\n        : `ℹ️ Không có key nào cần reset. Tất cả keys đều đang hoạt động.`,",
  "resetCount > 0\n        ? fillTpl(getBotMsg('cmd_resetgroq_ok', '✅ <b>Đã reset {count} key!</b>\\n\\nTất cả keys đã sẵn sàng. Thử <code>/link [url]</code> lại nhé.'), { count: resetCount })\n        : getBotMsg('cmd_resetgroq_none', 'ℹ️ Không có key nào cần reset. Tất cả keys đều đang hoạt động.'),"
);

fs.writeFileSync('src/bot-manager.js', c, 'utf8');
console.log('Patched! getBotMsg:', c.includes('getBotMsg'));
console.log('fillTpl:', c.includes('fillTpl'));
console.log('cmd_lichxo:', c.includes('cmd_lichxo'));
console.log('cmd_status_header:', c.includes('cmd_status_header'));
