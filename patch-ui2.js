'use strict';
const fs = require('fs');
let ui = fs.readFileSync('src/ui.js', 'utf8');

// ─── Find exact slice boundaries ────────────────────────────────────────────
const cardStart    = 45200;  // start of <div class="card"> with "Tập hợp..."
const panelEndStr  = '</div><!-- /panel-botmsg -->';
const panelEndIdx  = ui.indexOf(panelEndStr);   // 49961

// Replace from cardStart up to (but not including) </div><!-- /panel-botmsg -->
const before = ui.slice(0, cardStart);
const after  = ui.slice(panelEndIdx); // starts with </div><!--/panel-botmsg -->

// ─── Build the new cards HTML ────────────────────────────────────────────────
// Note: inside template literals in ui.js, \` and \${ are escaped.
// But since we're building a plain string that goes into the big backtick template
// that has already been evaluated (this is server-side code strings), we need to
// leave the ${...} expressions intact as template literal expressions.
// We use ES template literals in the outer ui.js backtick template, so ${...} work.

const HLTH = '${(cfg.bot_messages?.KEYNAME || "DEFAULT").replace(/</g, \'&lt;\').replace(/>/g, \'&gt;\')}';
function ta(id, key, defVal, rows, label, placeholder) {
  const exprVal = defVal.replace(/\\/g,'\\\\').replace(/`/g,'\\`');
  const expr    = `\${(cfg.bot_messages?.${key} || '${exprVal}').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
  return `<div class="form-group" style="margin-bottom:10px">
                  <label>${label}</label>
                  <textarea id="bm-${id}" class="msg-editor" rows="${rows}"${placeholder ? ` placeholder="${placeholder}"` : ''}>${expr}</textarea>
                </div>`;
}

const NEW_HTML = `        <div class="card" style="margin-bottom:16px">\r
          <div class="card-hd">📊 Thông báo Tự Động</div>\r
          <div class="card-body">\r
            <div class="msg-section">\r
              <div class="msg-section-hd">✅ Khi 1 miền xổ xong hoàn toàn</div>\r
              <div class="msg-section-body">\r
                ${ta('completion-header','completion_header','✅ <b>Xổ Số {region_done}</b> đã cập nhật đầy đủ!',2,'Tiêu đề xổ xong <span style="color:var(--muted);font-weight:400;text-transform:none">({region_done})</span>')}\r
                ${ta('pending-header','pending_header','⏳ <b>Các hàng còn đợi:</b>',2,'Dòng đầu "Còn đợi"')}\r
                ${ta('vietlott-header','vietlott_header','🎰 <b>Vietlott</b> (18:00 - 18:30)',2,'Dòng đầu Vietlott')}\r
                ${ta('all-done','all_done','🏆 Tất cả cuộc xổ hôm nay đã hoàn thành!',2,'Khi tất cả xong')}\r
                <div class="tgemoji-hint">💡 Hỗ trợ: <code>&lt;b&gt;</code> <code>&lt;i&gt;</code> <code>&lt;tg-emoji emoji-id="..."&gt;&lt;/tg-emoji&gt;</code></div>\r
              </div>\r
            </div>\r
            <div class="msg-section">\r
              <div class="msg-section-hd">⚠️ Push Thất Bại ({site_domain}, {error_reason})</div>\r
              <div class="msg-section-body">\r
                ${ta('push-fail','push_fail','⚠️ Push thất bại đến <b>{site_domain}</b>\\n❌ {error_reason}',2,'Template cảnh báo')}\r
              </div>\r
            </div>\r
            <div class="msg-section">\r
              <div class="msg-section-hd">🕒 Auto-Schedule Bắt Đầu <span style="color:var(--muted);font-size:11px;font-weight:400">(trống = không gửi)</span></div>\r
              <div class="msg-section-body">\r
                ${ta('schedule-start','schedule_start','',2,'Template ({region_name})','Để trống = không thông báo')}\r
              </div>\r
            </div>\r
          </div>\r
        </div>\r
\r
        <div class="card" style="margin-bottom:16px">\r
          <div class="card-hd">🎰 Lệnh Crawl &amp; Xổ Số</div>\r
          <div class="card-body">\r
            <div class="msg-section">\r
              <div class="msg-section-hd">🚀 /start — Dòng tiêu đề chào</div>\r
              <div class="msg-section-body">\r
                ${ta('cmd-start-header','cmd_start_header','🎰 <b>KQXS Live Bot</b>',2,'Header /start <span style="color:var(--muted);font-weight:400;text-transform:none">(phần danh sách lệnh giữ nguyên)</span>')}\r
                <div class="tgemoji-hint">💡 Mặc định: 🎰 &lt;b&gt;KQXS Live Bot&lt;/b&gt;</div>\r
              </div>\r
            </div>\r
            <div class="msg-section">\r
              <div class="msg-section-hd">▶️ /chay — Bắt đầu Poll</div>\r
              <div class="msg-section-body">\r
                ${ta('cmd-chay-all','cmd_chay_all','🚀 Đã bắt đầu poll cả 3 miền!',2,'/chay all')}\r
                ${ta('cmd-chay-region','cmd_chay_region','🚀 Bắt đầu poll {region_name}...',2,'/chay mb|mn|mt <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span>')}\r
              </div>\r
            </div>\r
            <div class="msg-section">\r
              <div class="msg-section-hd">⏹ /dung — Dừng Poll</div>\r
              <div class="msg-section-body">\r
                ${ta('cmd-dung-all','cmd_dung_all','⏹ Đã dừng tất cả.',2,'/dung (tất cả)')}\r
                ${ta('cmd-dung-region','cmd_dung_region','⏹ Đã dừng {region_name}',2,'/dung mb|mn|mt <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span>')}\r
              </div>\r
            </div>\r
            <div class="msg-section">\r
              <div class="msg-section-hd">📊 /xem, /status, /lichxo, /cancelbai</div>\r
              <div class="msg-section-body">\r
                ${ta('cmd-xem-header','cmd_xem_header','📊 <b>KQ {region_name}</b>',2,'/xem header <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span>')}\r
                ${ta('cmd-status-header','cmd_status_header','📊 <b>Trạng thái:</b>',2,'/status header')}\r
                ${ta('cmd-lichxo','cmd_lichxo','📅 <b>Lịch xổ hôm nay</b>\\n\\n🟢 Miền Nam / Miền Trung: 16:00 – 17:30\\n🔴 Miền Bắc: 18:30 – 19:15',4,'/lichxo — Full message')}\r
                ${ta('cmd-cancelbai','cmd_cancelbai','🗑️ Đã hủy phiên làm việc hiện tại.',2,'/cancelbai')}\r
              </div>\r
            </div>\r
          </div>\r
        </div>\r
\r
        <div class="card" style="margin-bottom:16px">\r
          <div class="card-hd">🔑 Lệnh Groq API Keys</div>\r
          <div class="card-body">\r
            <div class="msg-section">\r
              <div class="msg-section-hd">📋 /keys — Xem danh sách keys</div>\r
              <div class="msg-section-body">\r
                ${ta('cmd-keys-header','cmd_keys_header','🔑 <b>Groq API Keys</b>',2,'/keys header')}\r
                ${ta('cmd-keys-empty','cmd_keys_empty','❌ Chưa có Groq API key nào!',2,'/keys khi chưa có key')}\r
              </div>\r
            </div>\r
            <div class="msg-section">\r
              <div class="msg-section-hd">🔄 /resetgroq — Reset Keys</div>\r
              <div class="msg-section-body">\r
                ${ta('cmd-resetgroq-ok','cmd_resetgroq_ok','✅ <b>Đã reset {count} key!</b>\\n\\nTất cả keys đã sẵn sàng.',2,'/resetgroq OK <span style="color:var(--muted);font-weight:400;text-transform:none">({count})</span>')}\r
                ${ta('cmd-resetgroq-none','cmd_resetgroq_none','ℹ️ Không có key nào cần reset.',2,'/resetgroq khi không có key exhausted')}\r
                ${ta('cmd-resetgroq-empty','cmd_resetgroq_empty','❌ Chưa có Groq API key nào để reset.',2,'/resetgroq khi chưa có key nào')}\r
              </div>\r
            </div>\r
          </div>\r
        </div>\r
\r
        <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center">\r
          <button class="btn btn-primary" onclick="saveBotMessages()">💾 Lưu tất cả</button>\r
          <button class="btn btn-gray" onclick="resetBotMessages()">↩️ Về mặc định</button>\r
          <span id="botmsg-save-msg" style="font-size:13px;margin-left:4px"></span>\r
        </div>\r
`;

// Write out the new file
ui = before + NEW_HTML + after;

// ─── UPDATE: saveBotMessages fields ────────────────────────────────────────
const OLD_FIELDS = `      var fields = [
        /* auto notifications */
        ['completion-header','completion_header'],
        ['pending-header','pending_header'],
        ['vietlott-header','vietlott_header'],
        ['all-done','all_done'],
        ['push-fail','push_fail'],
        ['schedule-start','schedule_start'],
        /* crawl commands */
        ['cmd-start-header','cmd_start_header'],
        ['cmd-chay-all','cmd_chay_all'],
        ['cmd-chay-region','cmd_chay_region'],
        ['cmd-dung-all','cmd_dung_all'],
        ['cmd-dung-region','cmd_dung_region'],
        ['cmd-xem-header','cmd_xem_header'],
        ['cmd-status-header','cmd_status_header'],
        ['cmd-lichxo','cmd_lichxo'],
        ['cmd-cancelbai','cmd_cancelbai'],
        /* groq keys */
        ['cmd-keys-header','cmd_keys_header'],
        ['cmd-keys-empty','cmd_keys_empty'],
        ['cmd-resetgroq-ok','cmd_resetgroq_ok'],
        ['cmd-resetgroq-none','cmd_resetgroq_none'],
        ['cmd-resetgroq-empty','cmd_resetgroq_empty'],
      ];`;

// Check if already updated
if (!ui.includes(OLD_FIELDS)) {
  // It must still have the old simple fields
  ui = ui.replace(
    `      var fields = [\r\n        ['completion-header','completion_header'],\r\n        ['pending-header','pending_header'],\r\n        ['vietlott-header','vietlott_header'],\r\n        ['all-done','all_done'],\r\n        ['push-fail','push_fail'],\r\n        ['start-msg','start_msg'],\r\n        ['schedule-start','schedule_start'],\r\n      ];`,
    `      var fields = [\r\n        // auto\r\n        ['completion-header','completion_header'],\r\n        ['pending-header','pending_header'],\r\n        ['vietlott-header','vietlott_header'],\r\n        ['all-done','all_done'],\r\n        ['push-fail','push_fail'],\r\n        ['schedule-start','schedule_start'],\r\n        // crawl\r\n        ['cmd-start-header','cmd_start_header'],\r\n        ['cmd-chay-all','cmd_chay_all'],\r\n        ['cmd-chay-region','cmd_chay_region'],\r\n        ['cmd-dung-all','cmd_dung_all'],\r\n        ['cmd-dung-region','cmd_dung_region'],\r\n        ['cmd-xem-header','cmd_xem_header'],\r\n        ['cmd-status-header','cmd_status_header'],\r\n        ['cmd-lichxo','cmd_lichxo'],\r\n        ['cmd-cancelbai','cmd_cancelbai'],\r\n        // groq\r\n        ['cmd-keys-header','cmd_keys_header'],\r\n        ['cmd-keys-empty','cmd_keys_empty'],\r\n        ['cmd-resetgroq-ok','cmd_resetgroq_ok'],\r\n        ['cmd-resetgroq-none','cmd_resetgroq_none'],\r\n        ['cmd-resetgroq-empty','cmd_resetgroq_empty'],\r\n      ];`
  );
  console.log('fields updated via old path:', ui.includes('cmd-start-header'));
} else {
  console.log('fields already updated');
}

// ─── UPDATE: JSON bot-dfl defaults ───────────────────────────────────────────
// Replace the old JSON element
const oldJson = ui.indexOf('<script type="application/json" id="bot-dfl">');
const oldJsonEnd = ui.indexOf('</script>', oldJson) + 9;
if (oldJson > 0) {
  const newJson = `<script type="application/json" id="bot-dfl">\${
        JSON.stringify({
          completion_header  : '\\u2705 <b>X\\u1ed5 S\\u1ed1 {region_done}</b> \\u0111\\u00e3 c\\u1eadp nh\\u1eadt tr\\u1ef1c ti\\u1ebfp v\\u00e0 \\u0111\\u1ea7y \\u0111\\u1ee7 Full s\\u1ed1 th\\u00e0nh c\\u00f4ng!',
          pending_header     : '\\u23f3 <b>C\\u00e1c h\\u00e0ng c\\u00f2n \\u0111\\u1ee3i:</b>',
          vietlott_header    : '\\ud83c\\udfb0 <b>Vietlott</b> (18:00 - 18:30)',
          all_done           : '\\ud83c\\udfc6 T\\u1ea5t c\\u1ea3 cu\\u1ed9c x\\u1ed5 h\\u00f4m nay \\u0111\\u00e3 ho\\u00e0n th\\u00e0nh!',
          push_fail          : '\\u26a0\\ufe0f Push th\\u1ea5t b\\u1ea1i \\u0111\\u1ebfn <b>{site_domain}</b>\\n\\u274c {error_reason}',
          schedule_start     : '',
          cmd_start_header   : '\\ud83c\\udfb0 <b>KQXS Live Bot</b>',
          cmd_chay_all       : '\\ud83d\\ude80 \\u0110\\u00e3 b\\u1eaft \\u0111\\u1ea7u poll c\\u1ea3 3 mi\\u1ec1n!',
          cmd_chay_region    : '\\ud83d\\ude80 B\\u1eaft \\u0111\\u1ea7u poll {region_name}...',
          cmd_dung_all       : '\\u23f9 \\u0110\\u00e3 d\\u1eebng t\\u1ea5t c\\u1ea3.',
          cmd_dung_region    : '\\u23f9 \\u0110\\u00e3 d\\u1eebng {region_name}',
          cmd_xem_header     : '\\ud83d\\udcca <b>KQ {region_name}</b>',
          cmd_status_header  : '\\ud83d\\udcca <b>Tr\\u1ea1ng th\\u00e1i:</b>',
          cmd_lichxo         : '\\ud83d\\udcc5 <b>L\\u1ecbch x\\u1ed5 h\\u00f4m nay</b>\\n\\n\\ud83d\\udfe2 Mi\\u1ec1n Nam / Mi\\u1ec1n Trung: 16:00 \\u2013 17:30\\n\\ud83d\\udd34 Mi\\u1ec1n B\\u1eafc: 18:30 \\u2013 19:15',
          cmd_cancelbai      : '\\ud83d\\uddd1\\ufe0f \\u0110\\u00e3 h\\u1ee7y phi\\u00ean l\\u00e0m vi\\u1ec7c hi\\u1ec7n t\\u1ea1i.',
          cmd_keys_header    : '\\ud83d\\udd11 <b>Groq API Keys</b>',
          cmd_keys_empty     : '\\u274c Ch\\u01b0a c\\u00f3 Groq API key n\\u00e0o!',
          cmd_resetgroq_ok   : '\\u2705 <b>\\u0110\\u00e3 reset {count} key!</b>\\n\\nT\\u1ea5t c\\u1ea3 keys \\u0111\\u00e3 s\\u1eb5n s\\u00e0ng.',
          cmd_resetgroq_none : '\\u2139\\ufe0f Kh\\u00f4ng c\\u00f3 key n\\u00e0o c\\u1ea7n reset.',
          cmd_resetgroq_empty: '\\u274c Ch\\u01b0a c\\u00f3 Groq API key n\\u00e0o \\u0111\\u1ec3 reset.',
        }).replace(/</g,'\\\\u003c').replace(/>/g,'\\\\u003e')
      }</script>`;
  ui = ui.slice(0, oldJson) + newJson + ui.slice(oldJsonEnd);
  console.log('JSON updated');
}

// ─── UPDATE: API allowed keys ─────────────────────────────────────────────────
ui = ui.replace(
  `    const allowed = ['completion_header','pending_header','vietlott_header','all_done',
                     'push_ok','push_fail','start_msg','schedule_start'];`,
  `    const allowed = [
      'completion_header','pending_header','vietlott_header','all_done',
      'push_ok','push_fail','schedule_start',
      'cmd_start_header',
      'cmd_chay_all','cmd_chay_region',
      'cmd_dung_all','cmd_dung_region',
      'cmd_xem_header','cmd_status_header','cmd_lichxo','cmd_cancelbai',
      'cmd_keys_header','cmd_keys_empty',
      'cmd_resetgroq_ok','cmd_resetgroq_none','cmd_resetgroq_empty',
    ];`
);
console.log('API allowed:', ui.includes('cmd_start_header'));

fs.writeFileSync('src/ui.js', ui, 'utf8');
console.log('ALL DONE. File size:', ui.length);
