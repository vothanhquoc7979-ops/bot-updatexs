

    // ── Tab switching ─────────────────────────────────────
    function showTab(name) {
      ['dashboard','botmsg','crawl'].forEach(function(t) {
        document.getElementById('panel-' + t).style.display = t === name ? '' : 'none';
        document.getElementById('tab-' + t).className = 'tab-btn' + (t === name ? ' active' : '');
      });
    }

    // Đã bỏ Javascript checkMySQLStatus và testMysql

    // ── Poll status mỗi 5s ──────────────────────────────
    async function fetchStatus() {
      try {
        const r = await fetch('/api/status');
        const d = await r.json();
        updateStatus(d.status);
        updateLogs(d.logs);
      } catch(_) {}
    }

    function updateStatus(statusText) {
      const lines = statusText.split('\\n');
      const map = { mn:'s-mn', mt:'s-mt', mb:'s-mb' };
      const regionKeys = Object.keys(map);
      lines.forEach((line, i) => {
        const key = regionKeys[i];
        if (!key) return;
        const el = document.getElementById(map[key]);
        if (!el) return;
        if (line.includes('đang poll')) {
          el.textContent = '🔴 Live';
          el.className = 'pill pill-on';
        } else if (line.includes('xong')) {
          el.textContent = '✅ Xong';
          el.className = 'pill pill-done';
        } else {
          el.textContent = 'Dừng';
          el.className = 'pill pill-off';
        }
      });
    }

    function updateLogs(logs) {
      const box = document.getElementById('logbox');
      const atBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 40;
      box.innerHTML = logs.map(l => {
        let cls = 'log-info';
        if (l.msg.includes('✅') || l.msg.includes('OK')) cls = 'log-ok';
        else if (l.msg.includes('❌') || l.msg.includes('Lỗi')) cls = 'log-err';
        else if (l.msg.includes('⚠️')) cls = 'log-warn';
        return \`<div class="\${cls}"><span style="color:#3d4566">\${l.ts}</span> \${escHtml(l.msg)}</div>\`;
      }).join('');
      if (atBottom) box.scrollTop = box.scrollHeight;
    }

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Control ─────────────────────────────────────────
    async function ctrl(action, region) {
      const r = await fetch('/api/control', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action, region}) });
      const d = await r.json();
      flash(d.msg || (d.ok ? 'OK' : 'Lỗi'), d.ok);
    }

    // ── Clear logs ──────────────────────────────────────
    async function clearLogs() {
      await fetch('/api/control', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'clear_logs'}) });
      document.getElementById('logbox').innerHTML = '';
    }

    // ── Flash message ────────────────────────────────────
    function flash(msg, ok = true) {
      const el = document.getElementById('flash');
      el.textContent = (ok ? '✅ ' : '❌ ') + msg;
      el.className = 'alert ' + (ok ? 'alert-ok' : 'alert-err');
      el.style.display = 'block';
      clearTimeout(flash._t);
      flash._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
    }

    // ── Save config form ─────────────────────────────────
    document.getElementById('cfg-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        telegram_bot_token: fd.get('telegram_bot_token'),
        telegram_chat_id:   fd.get('telegram_chat_id'),
        // gemini_api_key removed — now using Groq
        auto_schedule:      fd.get('auto_schedule') === 'true',
      };
      const r = await fetch('/api/save-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const d = await r.json();
      flash(d.ok ? 'Đã lưu cấu hình! Bot đang restart...' : (d.msg || 'Lỗi'), d.ok);
    });


    // ── Crawl Dữ Liệu ────────────────────────────────────
    function toggleAllMien(checked) {
      document.querySelectorAll('.mien-cb').forEach(cb => { cb.checked = checked; });
    }

    function appendCrawlLog(msg, color = '#e8e8f0') {
      const box = document.getElementById('crawl-logbox');
      const line = document.createElement('div');
      line.style.color = color;
      line.textContent = '[' + new Date().toLocaleTimeString('vi-VN') + '] ' + msg;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    }

    async function runCrawl() {
      const mienChecked  = Array.from(document.querySelectorAll('.mien-cb:checked')).map(cb => cb.value);
      const vietlottChecked = Array.from(document.querySelectorAll('.game-cb:checked')).map(cb => cb.value);
      const from    = document.getElementById('crawl-from').value;
      const to      = document.getElementById('crawl-to').value;

      if (!mienChecked.length && !vietlottChecked.length) {
        alert('Vui lòng chọn ít nhất 1 loại xổ số!'); return;
      }
      if (!from || !to) { alert('Vui lòng chọn khoảng ngày!'); return; }

      const btn = document.getElementById('btn-crawl');
      btn.disabled = true;
      btn.textContent = '⏳ Đang crawl...';

      const box = document.getElementById('crawl-logbox');
      box.innerHTML = '';

      const progPanel = document.getElementById('crawl-progress');
      const progBar  = document.getElementById('prog-bar');
      const progLabel = document.getElementById('prog-label');
      const progCount = document.getElementById('prog-count');
      const summary   = document.getElementById('crawl-summary');

      progPanel.style.display = '';
      summary.style.display   = 'none';

      let totalSaved = 0;
      let totalErrors = 0;

      // ── Crawl 3 Miền ──────────────────────────────
      if (mienChecked.length) {
        appendCrawlLog('📌 Bắt đầu crawl 3 Miền: ' + mienChecked.join(', ') + ' | ' + from + ' → ' + to, '#ffd700');
        try {
          const res = await fetch('/api/crawler/mien', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regions: mienChecked, from, to }),
          });
          const data = await res.json();
          if (data.ok) {
            totalSaved  += data.saved;
            totalErrors += data.errors;
            appendCrawlLog('✅ 3 Miền: đã lưu ' + data.saved + ' bản ghi, ' + data.errors + ' lỗi | ' + data.elapsed, '#4caf50');
          } else {
            appendCrawlLog('❌ 3 Miền lỗi: ' + data.msg, '#ef5350');
          }
        } catch (e) {
          appendCrawlLog('❌ Lỗi kết nối 3 Miền: ' + e.message, '#ef5350');
        }
      }

      // ── Crawl Vietlott ────────────────────────────
      if (vietlottChecked.length) {
        appendCrawlLog('💰 Bắt đầu crawl Vietlott: ' + vietlottChecked.join(', ') + ' | ' + from + ' → ' + to, '#ffd700');
        try {
          const res = await fetch('/api/crawler/vietlott', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ games: vietlottChecked, from, to, force: false }),
          });
          const data = await res.json();
          if (data.ok) {
            totalSaved  += data.saved;
            totalErrors += data.errors;
            appendCrawlLog('✅ Vietlott: đã lưu ' + data.saved + ' bản ghi, ' + data.errors + ' lỗi | ' + data.elapsed, '#4caf50');
          } else {
            appendCrawlLog('❌ Vietlott lỗi: ' + data.msg, '#ef5350');
          }
        } catch (e) {
          appendCrawlLog('❌ Lỗi kết nối Vietlott: ' + e.message, '#ef5350');
        }
      }

      // ── Tổng kết ──────────────────────────────────
      progBar.style.width = '100%';
      progCount.textContent = totalSaved + ' bản ghi';
      progLabel.textContent = '✅ Hoàn tất!';
      summary.style.display = '';
      summary.innerHTML = '<span style="color:#4caf50">✅ Lưu ' + totalSaved + ' bản ghi</span> · <span style="color:#ef5350">❌ ' + totalErrors + ' lỗi</span>';

      appendCrawlLog('🏁 HOÀN TẤT! Tổng: ' + totalSaved + ' lưu, ' + totalErrors + ' lỗi', '#ffd700');

      btn.disabled = false;
      btn.textContent = '🚀 Bắt đầu crawl';
    }

    // ── Kiểm tra dữ liệu thiếu ───────────────────────────────
    async function checkMissing() {
      var mienChecked = Array.from(document.querySelectorAll('.mien-cb:checked')).map(function(cb) { return cb.value; });
      var vtChecked   = Array.from(document.querySelectorAll('.game-cb:checked')).map(function(cb) { return cb.value; });
      var from = document.getElementById('crawl-from').value;
      var to   = document.getElementById('crawl-to').value;

      if (!mienChecked.length && !vtChecked.length) { alert('Chọn ít nhất 1 loại xổ số!'); return; }
      if (!from || !to) { alert('Chọn khoảng ngày!'); return; }

      var btn = document.getElementById('btn-check');
      btn.disabled = true;
      btn.textContent = '⏳ Đang kiểm tra...';

      var card    = document.getElementById('card-missing');
      var results = document.getElementById('missing-results');
      card.style.display = '';
      results.innerHTML  = '<span style="color:var(--muted)">Đang truy vấn database...</span>';

      var html         = '';
      var totalMissing = 0;
      var missingInfo  = { games: [], regions: [], missingDates: {} };

      // Check 3 Miền
      if (mienChecked.length) {
        try {
          var p3  = new URLSearchParams({ type: '3mien', regions: mienChecked.join(','), from: from, to: to });
          var r3  = await fetch('/api/check-missing?' + p3);
          var d3  = await r3.json();
          if (d3.ok) {
            var miss3 = d3.missing || {};
            if (!Object.keys(miss3).length) {
              html += '<div style="color:#4caf50;margin-bottom:6px">✅ 3 Miền (' + mienChecked.join(', ').toUpperCase() + '): Đầy đủ!</div>';
            } else {
              for (var reg in miss3) {
                var rdates = miss3[reg];
                totalMissing += rdates.length;
                missingInfo.regions.push(reg);
                missingInfo.missingDates[reg] = rdates;
                html += '<div style="margin-bottom:8px"><strong style="color:#ffa726">' + reg.toUpperCase() + '</strong>: thiếu <strong>' + rdates.length + '</strong> ngày';
                html += ' <span style="font-size:11px;color:var(--muted)">' + rdates.slice(0, 5).join(', ') + (rdates.length > 5 ? ' ...' : '') + '</span></div>';
              }
            }
          } else {
            html += '<div style="color:#ef5350;margin-bottom:6px">❌ Lỗi 3 Miền: ' + escHtml(d3.error || d3.msg || '') + '</div>';
          }
        } catch(e) {
          html += '<div style="color:#ef5350;margin-bottom:6px">❌ Không kết nối PHP (3 Miền): ' + escHtml(e.message) + '</div>';
        }
      }

      // Check Vietlott
      if (vtChecked.length) {
        try {
          var pVt = new URLSearchParams({ type: 'vietlott', games: vtChecked.join(','), from: from, to: to });
          var rVt = await fetch('/api/check-missing?' + pVt);
          var dVt = await rVt.json();
          if (dVt.ok) {
            var missVt = dVt.missing || {};
            if (!Object.keys(missVt).length) {
              html += '<div style="color:#4caf50;margin-bottom:6px">✅ Vietlott (' + vtChecked.join(', ').toUpperCase() + '): Đầy đủ!</div>';
            } else {
              for (var gm in missVt) {
                var gdates = missVt[gm];
                totalMissing += gdates.length;
                missingInfo.games.push(gm);
                missingInfo.missingDates[gm] = gdates;
                html += '<div style="margin-bottom:8px"><strong style="color:#ffa726">' + gm.toUpperCase() + '</strong>: thiếu <strong>' + gdates.length + '</strong> ngày';
                html += ' <span style="font-size:11px;color:var(--muted)">' + gdates.slice(0, 5).join(', ') + (gdates.length > 5 ? ' ...' : '') + '</span></div>';
              }
            }
          } else {
            html += '<div style="color:#ef5350;margin-bottom:6px">❌ Lỗi Vietlott: ' + escHtml(dVt.error || dVt.msg || '') + '</div>';
          }
        } catch(e) {
          html += '<div style="color:#ef5350;margin-bottom:6px">❌ Không kết nối PHP (Vietlott): ' + escHtml(e.message) + '</div>';
        }
      }

      if (totalMissing > 0) {
        html = '<div style="color:#ef5350;font-size:14px;font-weight:700;margin-bottom:12px">⚠️ Tổng thiếu: ' + totalMissing + ' ngày</div>' + html;
        html += '<button class="btn btn-primary" style="margin-top:12px" id="btn-crawl-missing">🚀 Crawl bù ' + totalMissing + ' ngày thiếu</button>';
      } else if (html.indexOf('❌') === -1) {
        html = '<div style="color:#4caf50;font-size:14px;font-weight:700">✅ Dữ liệu đầy đủ trong khoảng ngày đã chọn!</div>' + html;
      }

      results.innerHTML = html;

      // Gắn sự kiện cho nút crawl bù
      var btnMiss = document.getElementById('btn-crawl-missing');
      if (btnMiss) {
        (function(info) { btnMiss.onclick = function() { crawlMissing(info); }; })(missingInfo);
      }

      btn.disabled = false;
      btn.textContent = '🔍 Kiểm tra thiếu';
    }

    // Crawl bù các ngày đã phát hiện thiếu
    async function crawlMissing(info) {
      var allDates = [];
      for (var key in info.missingDates) {
        allDates = allDates.concat(info.missingDates[key]);
      }
      allDates.sort();
      if (!allDates.length) { appendCrawlLog('Không có ngày nào để crawl!', '#4caf50'); return; }

      var from = allDates[0];
      var to   = allDates[allDates.length - 1];

      // Tick đúng checkbox
      document.querySelectorAll('.mien-cb').forEach(function(cb) {
        cb.checked = info.regions.indexOf(cb.value) >= 0;
      });
      document.querySelectorAll('.game-cb').forEach(function(cb) {
        cb.checked = info.games.indexOf(cb.value) >= 0;
      });
      document.getElementById('crawl-from').value = from;
      document.getElementById('crawl-to').value   = to;

      appendCrawlLog('↩️ Crawl bù từ ' + from + ' → ' + to + ' (' + allDates.length + ' ngày thiếu)...', '#ffd700');
      await runCrawl();
    }

    // ── Kiểm tra số thiếu trong record đã có (Max3D Pro thiếu tier, Power thiếu jackpot...) ──
    async function checkIncomplete() {
      var vtChecked = Array.from(document.querySelectorAll('.game-cb:checked')).map(function(cb) { return cb.value; });
      var from = document.getElementById('crawl-from').value;
      var to   = document.getElementById('crawl-to').value;

      if (!vtChecked.length) { alert('Chọn ít nhất 1 game Vietlott để kiểm tra!'); return; }
      if (!from || !to)      { alert('Chọn khoảng ngày!'); return; }

      var btn = document.getElementById('btn-check-inc');
      btn.disabled = true;
      btn.textContent = '⏳ Đang kiểm tra...';

      var card    = document.getElementById('card-missing');
      var results = document.getElementById('missing-results');
      card.style.display = '';
      results.innerHTML  = '<span style="color:var(--muted)">Đang scan record trong DB...</span>';

      var html          = '';
      var totalBroken   = 0;
      var datesForCrawl = {};
      var gamesForCrawl = [];

      try {
        var params = new URLSearchParams({ games: vtChecked.join(','), from: from, to: to });
        var r      = await fetch('/api/check-incomplete?' + params);
        var data   = await r.json();

        if (!data.ok) {
          results.innerHTML = '<div style="color:#ef5350">❌ Lỗi: ' + escHtml(data.msg || data.error || '') + '</div>';
        } else {
          var incomplete = data.incomplete || {};

          if (!Object.keys(incomplete).length) {
            results.innerHTML = '<div style="color:#4caf50;font-size:14px;font-weight:700">✅ Tất cả record đều đầy đủ! Không thiếu số nào.</div>';
          } else {
            for (var gm in incomplete) {
              var rows = incomplete[gm];
              totalBroken += rows.length;
              gamesForCrawl.push(gm);
              datesForCrawl[gm] = rows.map(function(r) { return r.date; });

              html += '<div style="margin-bottom:14px">';
              html += '<strong style="color:#ffa726;font-size:13px">' + gm.toUpperCase() + '</strong>: ' + rows.length + ' record thiếu số';
              html += '<table style="width:100%;margin-top:6px;font-size:11px;border-collapse:collapse">';
              html += '<thead><tr style="color:var(--muted)">';
              html += '<th style="text-align:left;padding:3px 6px">Ngày</th>';
              html += '<th style="text-align:left;padding:3px 6px">Kỳ</th>';
              html += '<th style="text-align:left;padding:3px 6px">Vấn đề</th>';
              html += '<th style="text-align:left;padding:3px 6px">Số hiện có</th>';
              html += '</tr></thead><tbody>';
              rows.forEach(function(row) {
                html += '<tr style="border-top:1px solid #2a2d3d">';
                html += '<td style="padding:3px 6px;color:#e8e8f0">' + row.date + '</td>';
                html += '<td style="padding:3px 6px;color:var(--muted)">' + (row.draw_number || '—') + '</td>';
                html += '<td style="padding:3px 6px;color:#ef5350">' + escHtml(row.issues) + '</td>';
                html += '<td style="padding:3px 6px;color:var(--muted);font-family:monospace">' + escHtml(row.preview || '') + '</td>';
                html += '</tr>';
              });
              html += '</tbody></table></div>';
            }

            html = '<div style="color:#ef5350;font-size:14px;font-weight:700;margin-bottom:14px">⚠️ ' + totalBroken + ' record thiếu số/jackpot</div>' + html;
            html += '<button class="btn btn-primary" style="margin-top:8px" id="btn-fix-crawl">🚀 Crawl bù ' + totalBroken + ' record thiếu</button>';
            results.innerHTML = html;

            var btnFix = document.getElementById('btn-fix-crawl');
            if (btnFix) {
              (function(gms, dts) {
                btnFix.onclick = function() {
                  var allD = [];
                  for (var k in dts) allD = allD.concat(dts[k]);
                  allD.sort();
                  var f = allD[0], t = allD[allD.length-1];
                  document.querySelectorAll('.game-cb').forEach(function(cb) { cb.checked = gms.indexOf(cb.value) >= 0; });
                  document.querySelectorAll('.mien-cb').forEach(function(cb) { cb.checked = false; });
                  document.getElementById('crawl-from').value = f;
                  document.getElementById('crawl-to').value   = t;
                  appendCrawlLog('↩️ Crawl bù từ ' + f + ' → ' + t + ' (' + allD.length + ' ngày)...', '#ffd700');
                  runCrawl();
                };
              })(gamesForCrawl, datesForCrawl);
            }

            return; // đã set innerHTML trong vòng lặp
          }
        }
      } catch(e) {
        results.innerHTML = '<div style="color:#ef5350">❌ Không kết nối: ' + escHtml(e.message) + '</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = '🔧 Kiểm tra số thiếu';
      }
    }

    // ── Start polling ────────────────────────────────────
    fetchStatus();
    setInterval(fetchStatus, 5000);

    // ══ Bot Messages Editor ══════════════════════════════
    var _lastTA = null;
    document.addEventListener('focusin', function(e) {
      if (e.target && e.target.classList.contains('msg-editor')) _lastTA = e.target;
    });
    function insertVar(text) {
      var ta = _lastTA;
      if (!ta) { alert('Hãy click vào textarea trước!'); return; }
      var s = ta.selectionStart, e2 = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + text + ta.value.slice(e2);
      ta.selectionStart = ta.selectionEnd = s + text.length;
      ta.focus();
    }
    function deentify(str) {
      return str.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    }
    async function saveBotMessages() {
      var fields = [
        ['completion-header','completion_header'],
        ['pending-header','pending_header'],
        ['vietlott-header','vietlott_header'],
        ['all-done','all_done'],
        ['push-fail','push_fail'],
        ['start-msg','start_msg'],
        ['schedule-start','schedule_start'],
      ];
      var data = {};
      fields.forEach(function(f) {
        var el = document.getElementById('bm-' + f[0]);
        if (el) data[f[1]] = deentify(el.value);
      });
      var p = document.getElementById('botmsg-save-msg');
      p.textContent = '⏳ Đang lưu...'; p.style.color='#888';
      try {
        var r = await fetch('/api/save-bot-messages', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        var d = await r.json();
        if (d.ok) { p.textContent = '✅ Đã lưu!'; p.style.color='#4caf50'; }
        else      { p.textContent = '❌ ' + (d.msg||'Lỗi'); p.style.color='#ef5350'; }
      } catch(e) { p.textContent = '❌ ' + e.message; p.style.color='#ef5350'; }
    }
    function resetBotMessages() {
      if (!confirm('Đặt về nội dung mặc định?')) return;
      document.getElementById('bm-completion-header').value = '\u2705 <b>X\u1ed5 S\u1ed1 {region_done}</b> \u0111\u00e3 c\u1eadp nh\u1eadt tr\u1ef1c ti\u1ebfp v\u00e0 \u0111\u1ea7y \u0111\u1ee7 Full s\u1ed1 th\u00e0nh c\u00f4ng!';
      document.getElementById('bm-pending-header').value   = '\u23f3 <b>C\u00e1c h\u00e0ng c\u00f2n \u0111\u1ee3i:</b>';
      document.getElementById('bm-vietlott-header').value  = '\ud83c\udfb0 <b>Vietlott</b> (18:00 - 18:30)';
      document.getElementById('bm-all-done').value         = '\ud83c\udfc6 T\u1ea5t c\u1ea3 cu\u1ed9c x\u1ed5 h\u00f4m nay \u0111\u00e3 ho\u00e0n th\u00e0nh!';
      document.getElementById('bm-push-fail').value        = '\u26a0\ufe0f Push th\u1ea5t b\u1ea1i \u0111\u1ebfn <b>{site_domain}</b>\n\u274c {error_reason}';
      document.getElementById('bm-start-msg').value        = '';
      document.getElementById('bm-schedule-start').value   = '';
    }
    </script>
  `, '<script src="/site-mgr.js"></script><script src="/groq-mgr.js"></script><script src="/groq-seo-mgr.js"></script>