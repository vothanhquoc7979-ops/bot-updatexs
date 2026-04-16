'use strict';
const fs  = require('fs');
let ui    = fs.readFileSync('src/ui.js', 'utf8');

// ────────────────────────────────────────────────────────────────────────────
// 1. REPLACE: chip/variable hints section (add {region_name}, {count})
// ────────────────────────────────────────────────────────────────────────────
ui = ui.replace(
`            <div style="margin-top:8px;line-height:2.2">
              <span class="var-chip" onclick="insertVar('{region_done}')">\\{region_done\\}</span> — Tên miền xổ xong&nbsp;&nbsp;
              <span class="var-chip" onclick="insertVar('{provinces_done}')">\\{provinces_done\\}</span> — Danh sách tỉnh đã xong
            </div>`,
`            <div style="margin-top:8px;line-height:2.6">
              <span class="var-chip" onclick="insertVar('{region_done}')">{region_done}</span> Miền đã xong&nbsp;
              <span class="var-chip" onclick="insertVar('{regions_done}')">{regions_done}</span> Tỉnh đã xong&nbsp;
              <span class="var-chip" onclick="insertVar('{region_name}')">{region_name}</span> Tên miền (chay/dung/xem)&nbsp;
              <span class="var-chip" onclick="insertVar('{count}')">{count}</span> Số lượng&nbsp;
              <span class="var-chip" onclick="insertVar('{site_domain}')">{site_domain}</span> Domain web&nbsp;
              <span class="var-chip" onclick="insertVar('{error_reason}')">{error_reason}</span> Lý do lỗi
            </div>`
);

// ────────────────────────────────────────────────────────────────────────────
// 2. REPLACE: entire card content (from card-hd "Tập hợp..." to </div></div>)
// ────────────────────────────────────────────────────────────────────────────
const OLD_CARD_HD = `        <div class="card">
          <div class="card-hd">📨 Tập hợp nội dung thông báo Bot</div>
          <div class="card-body">
            <!-- 1. Thông báo xổ xong -->`;

const CFG = '${(cfg.bot_messages?.';
// Helper to produce a textarea row
function ta(id, key, label, rows, placeholder, hintVar) {
  const def = '';
  return `
                <div class="form-group" style="margin-bottom:10px">
                  <label>${label}</label>
                  <textarea id="bm-${id}" class="msg-editor" rows="${rows}"${placeholder ? ` placeholder="${placeholder}"` : ''}>${CFG}${key} || '').replace(/</g, '&amp;lt;').replace(/>/g, '&amp;gt;')}</textarea>
                </div>`;
}

// Build the new card HTML - we'll use a string constant for clarity
const NEW_CARD = `        <div class="card" style="margin-bottom:16px">
          <div class="card-hd">📊 Thông báo Tự Động (Auto-push)</div>
          <div class="card-body">
            <!-- A1. Xổ xong -->
            <div class="msg-section">
              <div class="msg-section-hd">✅ Khi 1 miền xổ xong hoàn toàn</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>Dòng tiêu đề <span style="color:var(--muted);font-weight:400;text-transform:none">({region_done})</span></label>
                  <textarea id="bm-completion-header" class="msg-editor" rows="2">\${(cfg.bot_messages?.completion_header || '✅ <b>Xổ Số {region_done}</b> đã cập nhật trực tiếp và đầy đủ Full số thành công!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>Dòng đầu phần "Còn đợi"</label>
                  <textarea id="bm-pending-header" class="msg-editor" rows="2">\${(cfg.bot_messages?.pending_header || '⏳ <b>Các hàng còn đợi:</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>Dòng đầu phần Vietlott</label>
                  <textarea id="bm-vietlott-header" class="msg-editor" rows="2">\${(cfg.bot_messages?.vietlott_header || '🎰 <b>Vietlott</b> (18:00 - 18:30)').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label>Khi tất cả xong hết</label>
                  <textarea id="bm-all-done" class="msg-editor" rows="2">\${(cfg.bot_messages?.all_done || '🏆 Tất cả cuộc xổ hôm nay đã hoàn thành!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="tgemoji-hint">💡 Hỗ trợ HTML: <code>&lt;b&gt;</code> <code>&lt;i&gt;</code> <code>&lt;code&gt;</code> <code>&lt;tg-emoji emoji-id="..."&gt;&lt;/tg-emoji&gt;</code></div>
              </div>
            </div>
            <!-- A2. Push thất bại -->
            <div class="msg-section">
              <div class="msg-section-hd">⚠️ Push Thất Bại ({site_domain}, {error_reason})</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:0">
                  <textarea id="bm-push-fail" class="msg-editor" rows="2">\${(cfg.bot_messages?.push_fail || '⚠️ Push thất bại đến <b>{site_domain}</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <!-- A3. Auto-schedule bắt đầu -->
            <div class="msg-section">
              <div class="msg-section-hd">🕒 Auto-Schedule Bắt Đầu <span style="color:var(--muted);font-size:11px;font-weight:400">(để trống = không thông báo)</span></div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:0">
                  <label><span style="color:var(--muted);font-weight:400;text-transform:none">{region_name}: tên miền đang bật</span></label>
                  <textarea id="bm-schedule-start" class="msg-editor" rows="2" placeholder="Để trống = không gửi thông báo khi auto-schedule bắt đầu...">\${(cfg.bot_messages?.schedule_start || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-hd">🎰 Lệnh Crawl &amp; Xổ Số</div>
          <div class="card-body">
            <!-- B1. /start header -->
            <div class="msg-section">
              <div class="msg-section-hd">🚀 /start — Dòng chào đầu tiên</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:0">
                  <label><span style="color:var(--muted);font-weight:400;text-transform:none">Dòng tiêu đề của /start, phần danh sách lệnh giữ nguyên</span></label>
                  <textarea id="bm-cmd-start-header" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_start_header || '🎰 <b>KQXS Live Bot</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="tgemoji-hint">💡 Mặc định: 🎰 &lt;b&gt;KQXS Live Bot&lt;/b&gt;</div>
              </div>
            </div>
            <!-- B2. /chay -->
            <div class="msg-section">
              <div class="msg-section-hd">▶️ /chay — Bắt đầu Poll</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/chay all — Chạy tất cả 3 miền</label>
                  <textarea id="bm-cmd-chay-all" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_chay_all || '🚀 Đã bắt đầu poll cả 3 miền!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label>/chay mb|mn|mt — Chạy từng miền <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span></label>
                  <textarea id="bm-cmd-chay-region" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_chay_region || '🚀 Bắt đầu poll {region_name}...').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <!-- B3. /dung -->
            <div class="msg-section">
              <div class="msg-section-hd">⏹ /dung — Dừng Poll</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/dung (tất cả)</label>
                  <textarea id="bm-cmd-dung-all" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_dung_all || '⏹ Đã dừng tất cả.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label>/dung mb|mn|mt <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span></label>
                  <textarea id="bm-cmd-dung-region" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_dung_region || '⏹ Đã dừng {region_name}').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <!-- B4. /xem /status /lichxo /cancelbai -->
            <div class="msg-section">
              <div class="msg-section-hd">📊 /xem, /status, /lichxo, /cancelbai</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/xem header <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span></label>
                  <textarea id="bm-cmd-xem-header" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_xem_header || '📊 <b>KQ {region_name}</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/status header</label>
                  <textarea id="bm-cmd-status-header" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_status_header || '📊 <b>Trạng thái:</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/lichxo — Lịch xổ hôm nay (full message)</label>
                  <textarea id="bm-cmd-lichxo" class="msg-editor" rows="4">\${(cfg.bot_messages?.cmd_lichxo || '📅 <b>Lịch xổ hôm nay</b>\\n\\n🟢 Miền Nam / Miền Trung: 16:00 – 17:30\\n🔴 Miền Bắc: 18:30 – 19:15').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label>/cancelbai</label>
                  <textarea id="bm-cmd-cancelbai" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_cancelbai || '🗑️ Đã hủy phiên làm việc hiện tại.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-hd">🔑 Lệnh Groq API Keys</div>
          <div class="card-body">
            <div class="msg-section">
              <div class="msg-section-hd">📋 /keys — Xem danh sách keys</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/keys header</label>
                  <textarea id="bm-cmd-keys-header" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_keys_header || '🔑 <b>Groq API Keys</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label>/keys khi chưa có key</label>
                  <textarea id="bm-cmd-keys-empty" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_keys_empty || '❌ Chưa có Groq API key nào!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <div class="msg-section">
              <div class="msg-section-hd">🔄 /resetgroq — Reset Keys</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/resetgroq thành công <span style="color:var(--muted);font-weight:400;text-transform:none">({count} key đã reset)</span></label>
                  <textarea id="bm-cmd-resetgroq-ok" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_resetgroq_ok || '✅ <b>Đã reset {count} key!</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/resetgroq khi không có key nào cần reset</label>
                  <textarea id="bm-cmd-resetgroq-none" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_resetgroq_none || 'ℹ️ Không có key nào cần reset.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:0">
                  <label>/resetgroq khi chưa có key nào</label>
                  <textarea id="bm-cmd-resetgroq-empty" class="msg-editor" rows="2">\${(cfg.bot_messages?.cmd_resetgroq_empty || '❌ Chưa có Groq API key nào để reset.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center">
          <button class="btn btn-primary" onclick="saveBotMessages()">💾 Lưu tất cả</button>
          <button class="btn btn-gray" onclick="resetBotMessages()">↩️ Về mặc định</button>
          <span id="botmsg-save-msg" style="font-size:13px;margin-left:4px"></span>
        </div>`;

// Find the old card to delete
const OLD_CARD_START = `        <div class="card">
          <div class="card-hd">📨 Tập hợp nội dung thông báo Bot</div>`;
const OLD_SAVE_BTN = `            <div style="display:flex;gap:10px;margin-top:16px;align-items:center">
              <button class="btn btn-primary" onclick="saveBotMessages()">💾 Lưu nội dung</button>
              <button class="btn btn-gray" onclick="resetBotMessages()">↩️ Về mặc định</button>
              <span id="botmsg-save-msg" style="font-size:13px;margin-left:4px"></span>
            </div>
          </div>
        </div>
      </div><!-- /panel-botmsg -->`;

// Get start and end indexes
const startIdx = ui.indexOf(OLD_CARD_START);
const endIdx   = ui.indexOf(OLD_SAVE_BTN) + OLD_SAVE_BTN.length;

if (startIdx === -1) { console.error('OLD_CARD_START not found!'); process.exit(1); }
if (endIdx <= OLD_SAVE_BTN.length) { console.error('OLD_SAVE_BTN not found!'); process.exit(1); }

ui = ui.slice(0, startIdx) + NEW_CARD + '\n      </div><!-- /panel-botmsg -->' + ui.slice(endIdx);

// ────────────────────────────────────────────────────────────────────────────
// 3. UPDATE: JSON defaults element (bot-dfl) to include all new keys
// ────────────────────────────────────────────────────────────────────────────
const OLD_JSON_SCRIPT = `      <script type="application/json" id="bot-dfl">\${
        JSON.stringify({
          completion_header: '\\u2705 <b>X\\u1ed5 S\\u1ed1 {region_done}</b> \\u0111\\u00e3 c\\u1eadp nh\\u1eadt tr\\u1ef1c ti\\u1ebfp v\\u00e0 \\u0111\\u1ea7y \\u0111\\u1ee7 Full s\\u1ed1 th\\u00e0nh c\\u00f4ng!',
          pending_header   : '\\u23f3 <b>C\\u00e1c h\\u00e0ng c\\u00f2n \\u0111\\u1ee3i:</b>',
          vietlott_header  : '\\ud83c\\udfb0 <b>Vietlott</b> (18:00 - 18:30)',
          all_done         : '\\ud83c\\udfc6 T\\u1ea5t c\\u1ea3 cu\\u1ed9c x\\u1ed5 h\\u00f4m nay \\u0111\\u00e3 ho\\u00e0n th\\u00e0nh!',
          push_fail        : '\\u26a0\\ufe0f Push th\\u1ea5t b\\u1ea1i \\u0111\\u1ebfn <b>{site_domain}</b>\\n\\u274c {error_reason}',
          start_msg        : '',
          schedule_start   : '',
        }).replace(/</g,'\\\\u003c').replace(/>/g,'\\\\u003e')
      }</script>`;

const NEW_JSON_SCRIPT = `      <script type="application/json" id="bot-dfl">\${
        JSON.stringify({
          /* auto notifications */
          completion_header  : '\\u2705 <b>X\\u1ed5 S\\u1ed1 {region_done}</b> \\u0111\\u00e3 c\\u1eadp nh\\u1eadt tr\\u1ef1c ti\\u1ebfp v\\u00e0 \\u0111\\u1ea7y \\u0111\\u1ee7 Full s\\u1ed1 th\\u00e0nh c\\u00f4ng!',
          pending_header     : '\\u23f3 <b>C\\u00e1c h\\u00e0ng c\\u00f2n \\u0111\\u1ee3i:</b>',
          vietlott_header    : '\\ud83c\\udfb0 <b>Vietlott</b> (18:00 - 18:30)',
          all_done           : '\\ud83c\\udfc6 T\\u1ea5t c\\u1ea3 cu\\u1ed9c x\\u1ed5 h\\u00f4m nay \\u0111\\u00e3 ho\\u00e0n th\\u00e0nh!',
          push_fail          : '\\u26a0\\ufe0f Push th\\u1ea5t b\\u1ea1i \\u0111\\u1ebfn <b>{site_domain}</b>',
          schedule_start     : '',
          /* crawl commands */
          cmd_start_header   : '\\ud83c\\udfb0 <b>KQXS Live Bot</b>',
          cmd_chay_all       : '\\ud83d\\ude80 \\u0110\\u00e3 b\\u1eaft \\u0111\\u1ea7u poll c\\u1ea3 3 mi\\u1ec1n!',
          cmd_chay_region    : '\\ud83d\\ude80 B\\u1eaft \\u0111\\u1ea7u poll {region_name}...',
          cmd_dung_all       : '\\u23f9 \\u0110\\u00e3 d\\u1eebng t\\u1ea5t c\\u1ea3.',
          cmd_dung_region    : '\\u23f9 \\u0110\\u00e3 d\\u1eebng {region_name}',
          cmd_xem_header     : '\\ud83d\\udcca <b>KQ {region_name}</b>',
          cmd_status_header  : '\\ud83d\\udcca <b>Tr\\u1ea1ng th\\u00e1i:</b>',
          cmd_lichxo         : '\\ud83d\\udcc5 <b>L\\u1ecbch x\\u1ed5 h\\u00f4m nay</b>\\n\\n\\ud83d\\udfe2 Mi\\u1ec1n Nam / Mi\\u1ec1n Trung: 16:00 \\u2013 17:30\\n\\ud83d\\udd34 Mi\\u1ec1n B\\u1eafc: 18:30 \\u2013 19:15',
          cmd_cancelbai      : '\\ud83d\\uddd1\\ufe0f \\u0110\\u00e3 h\\u1ee7y phi\\u00ean l\\u00e0m vi\\u1ec7c hi\\u1ec7n t\\u1ea1i.',
          /* groq keys commands */
          cmd_keys_header    : '\\ud83d\\udd11 <b>Groq API Keys</b>',
          cmd_keys_empty     : '\\u274c Ch\\u01b0a c\\u00f3 Groq API key n\\u00e0o!',
          cmd_resetgroq_ok   : '\\u2705 <b>\\u0110\\u00e3 reset {count} key!</b>\\n\\nT\\u1ea5t c\\u1ea3 keys \\u0111\\u00e3 s\\u1eb5n s\\u00e0ng.',
          cmd_resetgroq_none : '\\u2139\\ufe0f Kh\\u00f4ng c\\u00f3 key n\\u00e0o c\\u1ea7n reset.',
          cmd_resetgroq_empty: '\\u274c Ch\\u01b0a c\\u00f3 Groq API key n\\u00e0o \\u0111\\u1ec3 reset.',
        }).replace(/</g,'\\\\u003c').replace(/>/g,'\\\\u003e')
      }</script>`;

ui = ui.replace(OLD_JSON_SCRIPT, NEW_JSON_SCRIPT);
console.log('JSON updated:', ui.includes('cmd_start_header'));

// ────────────────────────────────────────────────────────────────────────────
// 4. UPDATE: saveBotMessages fields array
// ────────────────────────────────────────────────────────────────────────────
const OLD_FIELDS = `      var fields = [
        ['completion-header','completion_header'],
        ['pending-header','pending_header'],
        ['vietlott-header','vietlott_header'],
        ['all-done','all_done'],
        ['push-fail','push_fail'],
        ['start-msg','start_msg'],
        ['schedule-start','schedule_start'],
      ];`;

const NEW_FIELDS = `      var fields = [
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

ui = ui.replace(OLD_FIELDS, NEW_FIELDS);
console.log('Fields updated:', ui.includes('cmd-start-header'));

// ────────────────────────────────────────────────────────────────────────────
// 5. UPDATE: /api/save-bot-messages allowed keys
// ────────────────────────────────────────────────────────────────────────────
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
console.log('API allowed updated:', ui.includes('cmd_start_header'));

fs.writeFileSync('src/ui.js', ui, 'utf8');
console.log('Done!');
