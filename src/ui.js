/**
 * ui.js — Express Web Dashboard cho bot admin
 * Truy cập: https://your-service.up.railway.app
 * Đăng nhập bằng ADMIN_PASSWORD (env var)
 */
'use strict';

const express = require('express');
const session = require('express-session');
const storage = require('./storage');
const logger  = require('./logger');

const router = express.Router();

// ── Middleware session ────────────────────────────────────
router.use(session({
  secret: process.env.SESSION_SECRET || 'xoso-bot-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 ngày
}));

// ── Auth middleware ───────────────────────────────────────
function requireAuth(req, res, next) {
  return next(); // Bỏ xác thực mật khẩu
}

// ── HTML shell ───────────────────────────────────────────
function html(title, body, extraHead = '') {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — KQXS Bot</title>
${extraHead}
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0f1117;--surface:#1a1d27;--border:#2a2d3d;
    --accent:#e74c3c;--accent2:#3498db;--text:#e8e8f0;
    --muted:#7f8398;--green:#27ae60;--yellow:#f39c12;
  }
  body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh}
  .topbar{background:linear-gradient(135deg,#c0392b,#922b21);padding:14px 24px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 12px rgba(0,0,0,.4)}
  .topbar h1{font-size:20px;font-weight:700;color:#fff;letter-spacing:.5px}
  .topbar .badge{background:rgba(255,255,255,.15);color:#fff;padding:3px 10px;border-radius:20px;font-size:12px}
  .container{max-width:960px;margin:0 auto;padding:24px 16px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  @media(max-width:640px){.grid{grid-template-columns:1fr}}
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
  .card-hd{padding:14px 18px;border-bottom:1px solid var(--border);font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px}
  .card-body{padding:18px}
  .form-group{margin-bottom:14px}
  .form-group label{display:block;font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .form-group input,.form-group select{width:100%;background:#111320;border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:14px;outline:none;transition:border-color .2s}
  .form-group input:focus,.form-group select:focus{border-color:var(--accent2)}
  .form-group input[type=password]{font-family:monospace}
  .btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity .2s,transform .1s;text-decoration:none}
  .btn:active{transform:scale(.97)}
  .btn:hover{opacity:.88}
  .btn-primary{background:var(--accent);color:#fff}
  .btn-blue{background:var(--accent2);color:#fff}
  .btn-green{background:var(--green);color:#fff}
  .btn-gray{background:#2c2f45;color:var(--text)}
  .btn-sm{padding:6px 12px;font-size:12px}
  .tab-btn{background:transparent;border:none;border-bottom:2px solid transparent;padding:10px 18px;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;transition:color .2s,border-color .2s;margin-bottom:-2px}
  .tab-btn:hover{color:var(--text)}
  .tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
  .game-check{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 12px;background:#111320;border:1px solid var(--border);border-radius:8px;transition:border-color .2s}
  .game-check:hover{border-color:var(--accent2)}
  .game-check input[type=checkbox]{accent-color:var(--accent2);width:16px;height:16px}
  .status-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)}
  .status-row:last-child{border-bottom:none;padding-bottom:0}
  .region-name{font-weight:600;font-size:14px}
  .pill{padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
  .pill-on{background:#1a3a26;color:#4caf50}
  .pill-off{background:#2a2a2a;color:var(--muted)}
  .pill-done{background:#1a2a3a;color:#42a5f5}
  .actions{display:flex;gap:6px}
  #logbox{background:#080b14;border-radius:8px;padding:12px;height:320px;overflow-y:auto;font-family:'Cascadia Code',Consolas,monospace;font-size:12px;line-height:1.6;border:1px solid var(--border)}
  .log-ok{color:#4caf50}.log-err{color:#ef5350}.log-warn{color:#ffa726}.log-info{color:#7f8398}
  .alert{padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:13px}
  .alert-ok{background:#1a3a26;color:#4caf50;border:1px solid #2e5e3a}
  .alert-err{background:#3a1a1a;color:#ef5350;border:1px solid #5e2e2e}
  .sep{height:1px;background:var(--border);margin:20px 0}
  .login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;background:radial-gradient(ellipse at center,#1a1d27 0%,#0f1117 100%)}
  .login-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:36px 32px;width:100%;max-width:380px;text-align:center}
  .login-card h2{font-size:24px;margin-bottom:4px}
  .login-card p{color:var(--muted);margin-bottom:24px;font-size:13px}
  .logo{font-size:44px;margin-bottom:16px}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ── GET /login ────────────────────────────────────────────
router.get('/login', (req, res) => {
  const err = req.query.err ? '<div class="alert alert-err">❌ Sai mật khẩu!</div>' : '';
  res.send(html('Đăng nhập', `
    <div class="login-wrap">
      <div class="login-card">
        <div class="logo">🎰</div>
        <h2>KQXS Bot</h2>
        <p>Admin Dashboard — Nhập mật khẩu để tiếp tục</p>
        ${err}
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Mật khẩu Admin</label>
            <input type="password" name="password" placeholder="••••••••" autofocus required>
          </div>
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:4px" type="submit">🔓 Đăng nhập</button>
        </form>
      </div>
    </div>
  `));
});

// ── POST /login ───────────────────────────────────────────
router.post('/login', express.urlencoded({ extended: true }), (req, res) => {
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
  if (req.body.password === ADMIN_PASS) {
    req.session.authed = true;
    res.redirect('/');
  } else {
    res.redirect('/login?err=1');
  }
});

// ── GET /logout ───────────────────────────────────────────
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ── GET /api/status (JSON) ────────────────────────────────
router.get('/api/status', requireAuth, (req, res) => {
  const { getStatus: getRawStatus, getCurrentData } = require('./scheduler');
  res.json({
    status:  getRawStatus(),
    logs:    logger.getLogs(80),
    config:  (() => { const c = storage.load(); return { has_token: !!c.telegram_bot_token, php_host: c.php_host, auto_schedule: c.auto_schedule }; })(),
  });
});

// Đã bỏ route /api/mysql-check

// ── GET /api/logs ─────────────────────────────────────────
router.get('/api/logs', requireAuth, (req, res) => {
  res.json(logger.getLogs(100));
});

// ── POST /api/control ─────────────────────────────────────
router.post('/api/control', requireAuth, express.json(), (req, res) => {
  const { action, region } = req.body;
  const { start, stop, stopAll } = require('./scheduler');

  try {
    if (action === 'start' && region) {
      const regions = region === 'all' ? ['mn', 'mt', 'mb'] : [region];
      regions.forEach(r => start(r, logger.log, true));
      return res.json({ ok: true, msg: `Đã start ${region}` });
    }
    if (action === 'stop' && region === 'all') {
      stopAll(logger.log);
      return res.json({ ok: true, msg: 'Đã dừng tất cả' });
    }
    if (action === 'stop' && region) {
      stop(region, logger.log);
      return res.json({ ok: true, msg: `Đã dừng ${region}` });
    }
    if (action === 'clear_logs') {
      logger.clear();
      return res.json({ ok: true });
    }
    res.json({ ok: false, msg: 'Action không hợp lệ' });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── POST /api/save-config ─────────────────────────────────
router.post('/api/save-config', requireAuth, express.json(), async (req, res) => {
  try {
    const { telegram_bot_token, telegram_chat_id, php_host, php_push_secret, php_server_url, auto_schedule, gemini_api_key } = req.body;
    storage.save({
      telegram_bot_token: (telegram_bot_token || '').trim(),
      telegram_chat_id:   (telegram_chat_id   || '').trim(),
      php_host:           (php_host           || '').trim().replace(/\/$/, ''),
      php_push_secret:    (php_push_secret    || '').trim(),
      php_server_url:     (php_server_url     || '').trim().replace(/\/$/, ''),
      gemini_api_key:     (gemini_api_key     || '').trim(),
      auto_schedule:      auto_schedule === true || auto_schedule === 'true',
    });
    logger.log('✅ Đã lưu cấu hình mới. Restarting bot...');

    // Restart bot với token mới
    const botManager = require('./bot-manager');
    await botManager.restart();

    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── GET / (Dashboard) ─────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const cfg = storage.load();
  const hasToken = !!cfg.telegram_bot_token;

  res.send(html('Dashboard', `
    <div class="topbar">
      <span style="font-size:24px">🎰</span>
      <h1>KQXS Live Bot</h1>
      <span class="badge" id="bot-pill">${hasToken ? '🟢 Bot online' : '🔴 Chưa cấu hình'}</span>
      <a href="/logout" class="btn btn-gray btn-sm" style="margin-left:auto">Đăng xuất</a>
    </div>

    <div class="container">

      <!-- Tab navigation -->
      <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border)">
        <button class="tab-btn active" id="tab-dashboard" onclick="showTab('dashboard')">📊 Dashboard</button>
        <button class="tab-btn" id="tab-crawl" onclick="showTab('crawl')">🕷️ Crawl Vietlott</button>
      </div>

      <!-- ═══════════════ TAB: DASHBOARD ═══════════════ -->
      <div id="panel-dashboard">

      <!-- Thông báo -->
      ${!hasToken ? '<div class="alert alert-err">⚠️ Chưa cài token Telegram! Nhập token ở phần Cấu hình bên dưới.</div>' : ''}
      <div id="flash" style="display:none" class="alert alert-ok"></div>

      <!-- Grid trên -->
      <div class="grid">

        <!-- Card: Điều khiển bot -->
        <div class="card">
          <div class="card-hd">🕹️ Điều khiển bot</div>
          <div class="card-body">
            <div class="status-row">
              <span class="region-name">🟢 Miền Nam</span>
              <span class="pill pill-off" id="s-mn">—</span>
              <div class="actions">
                <button class="btn btn-green btn-sm" onclick="ctrl('start','mn')">▶ Chạy</button>
                <button class="btn btn-gray btn-sm" onclick="ctrl('stop','mn')">⏹</button>
              </div>
            </div>
            <div class="status-row">
              <span class="region-name">🔵 Miền Trung</span>
              <span class="pill pill-off" id="s-mt">—</span>
              <div class="actions">
                <button class="btn btn-green btn-sm" onclick="ctrl('start','mt')">▶ Chạy</button>
                <button class="btn btn-gray btn-sm" onclick="ctrl('stop','mt')">⏹</button>
              </div>
            </div>
            <div class="status-row">
              <span class="region-name">🔴 Miền Bắc</span>
              <span class="pill pill-off" id="s-mb">—</span>
              <div class="actions">
                <button class="btn btn-green btn-sm" onclick="ctrl('start','mb')">▶ Chạy</button>
                <button class="btn btn-gray btn-sm" onclick="ctrl('stop','mb')">⏹</button>
              </div>
            </div>
            <div class="sep"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-green" onclick="ctrl('start','all')">▶▶ Chạy tất cả</button>
              <button class="btn btn-primary" onclick="ctrl('stop','all')">⏹ Dừng tất cả</button>
            </div>
          </div>
        </div>

        <!-- Card: Lịch xổ -->
        <div class="card">
          <div class="card-hd">📅 Lịch xổ hôm nay (giờ VN)</div>
          <div class="card-body">
            <div class="status-row">
              <span>🟢 Miền Nam / Miền Trung</span>
              <span style="color:#f39c12;font-weight:700">16:00 – 17:30</span>
            </div>
            <div class="status-row">
              <span>🔴 Miền Bắc</span>
              <span style="color:#f39c12;font-weight:700">18:30 – 19:15</span>
            </div>
            <div class="sep"></div>
            <p style="font-size:12px;color:var(--muted);line-height:1.6">
              Bot tự động bật theo lịch nếu bật <strong>Auto-schedule</strong>.<br>
              Poll mỗi <strong>15 giây</strong> trong giờ xổ.<br>
              Tự dừng khi <strong>xổ xong</strong> (tất cả tỉnh có đủ giải).
            </p>
          </div>
        </div>

      </div><!-- /grid -->

      <!-- Card: Log -->
      <div class="card" style="margin-top:16px">
        <div class="card-hd">
          📋 Log real-time
          <button class="btn btn-gray btn-sm" style="margin-left:auto" onclick="clearLogs()">🗑 Xóa log</button>
        </div>
        <div class="card-body" style="padding:12px">
          <div id="logbox"><span style="color:var(--muted)">Đang tải log...</span></div>
        </div>
      </div>

      <!-- Card: Cấu hình -->
      <div class="card" style="margin-top:16px">
        <div class="card-hd">⚙️ Cấu hình Bot</div>
        <div class="card-body">
          <form id="cfg-form">
            <div class="grid">
              <div>
                <div class="form-group">
                  <label>Telegram Bot Token</label>
                  <input type="password" name="telegram_bot_token" id="f-token"
                    value="${cfg.telegram_bot_token || ''}"
                    placeholder="1234567890:ABCdef...">
                </div>
                <div class="form-group">
                  <label>Telegram Chat ID (để nhận thông báo)</label>
                  <input type="text" name="telegram_chat_id" id="f-chatid"
                    value="${cfg.telegram_chat_id || ''}"
                    placeholder="-100123456789 hoặc @username">
                </div>
                <div class="form-group">
                  <label>Gemini API Key (Dành cho Auto-Chat Bot AI)</label>
                  <input type="password" name="gemini_api_key" id="f-gemini"
                    value="${cfg.gemini_api_key || ''}"
                    placeholder="AIzaSyAxxxxxxxxxxxxxxxx">
                </div>
              </div>
              <div>
                <div class="form-group">
                  <label>PHP Hosting URL</label>
                  <input type="text" name="php_host" id="f-phphost"
                    value="${cfg.php_host || ''}"
                    placeholder="https://yoursite.com">
                </div>
                <div class="form-group">
                  <label>PHP Push Secret Token</label>
                  <input type="password" name="php_push_secret" id="f-phpsecret"
                    value="${cfg.php_push_secret || ''}"
                    placeholder="random_secret_32_chars">
                </div>
                <div class="form-group">
                  <label>PHP Proxy URL (crawl-save.php)</label>
                  <input type="text" name="php_server_url" id="f-phpserverurl"
                    value="${cfg.php_server_url || ''}"
                    placeholder="https://pateanlien.online/api/crawl-save.php">
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>Auto-schedule (tự chạy theo giờ xổ)</label>
              <select name="auto_schedule" id="f-auto">
                <option value="true" ${cfg.auto_schedule !== false ? 'selected' : ''}>✅ Bật — tự chạy theo lịch VN</option>
                <option value="false" ${cfg.auto_schedule === false ? 'selected' : ''}>❌ Tắt — chỉ chạy khi bấm tay</option>
              </select>
            </div>
            <button type="submit" class="btn btn-primary">💾 Lưu cấu hình & Restart bot</button>
          </form>
        </div>
      </div>

      </div><!-- /panel-dashboard -->

      <!-- ═══════════════ TAB: CRAWL DỮ LIỆU ═══════════════ -->
      <div id="panel-crawl" style="display:none">

        <div class="card">
          <div class="card-hd">🎯 Chọn loại xổ số cần crawl</div>
          <div class="card-body">
            <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
              <button class="btn btn-blue btn-sm" onclick="toggleAllMien(true)">✅ Chọn tất cả 3 Miền</button>
              <button class="btn btn-gray btn-sm" onclick="toggleAllMien(false)">❌ Bỏ chọn</button>
            </div>

            <!-- 3 Miền -->
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px">📌 Xổ số 3 Miền (web: xskt.com.vn)</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px">
              <label class="game-check"><input type="checkbox" class="mien-cb" value="mb"> 🏛️ XS Miền Bắc (XSMB)</label>
              <label class="game-check"><input type="checkbox" class="mien-cb" value="mn"> 🌴 XS Miền Nam (XSMN)</label>
              <label class="game-check"><input type="checkbox" class="mien-cb" value="mt"> 🏝️ XS Miền Trung (XSMT)</label>
            </div>

            <!-- Vietlott -->
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px">💰 Vietlott (web: kqxs.vn / xosothantai.mobi)</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:14px">
              <label class="game-check"><input type="checkbox" class="game-cb" value="mega"> 🎰 Mega 6/45</label>
              <label class="game-check"><input type="checkbox" class="game-cb" value="power"> ⚡ Power 6/55</label>
              <label class="game-check"><input type="checkbox" class="game-cb" value="max3d"> 🎲 Max 3D</label>
              <label class="game-check"><input type="checkbox" class="game-cb" value="max3dpro"> 🎲 Max 3D Pro</label>
              <label class="game-check"><input type="checkbox" class="game-cb" value="lotto13h"> 🎫 Lotto 5/35 13H</label>
              <label class="game-check"><input type="checkbox" class="game-cb" value="lotto21h"> 🎫 Lotto 5/35 21H</label>

            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
              <div class="form-group" style="margin:0">
                <label>Từ ngày</label>
                <input type="date" id="crawl-from" class="form-control" value="${new Date().toISOString().slice(0,10)}">
              </div>
              <div class="form-group" style="margin:0">
                <label>Đến ngày</label>
                <input type="date" id="crawl-to" class="form-control" value="${new Date().toISOString().slice(0,10)}">
              </div>
              <button class="btn btn-primary" id="btn-crawl" onclick="runCrawl()">🚀 Bắt đầu crawl</button>
            </div>
          </div>
        </div>

        <!-- Progress -->
        <div class="card" style="margin-top:16px">
          <div class="card-hd">📊 Tiến trình</div>
          <div class="card-body">
            <div id="crawl-progress" style="display:none">
              <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
                <span id="prog-label">Đang crawl...</span>
                <span id="prog-count">0 / 0</span>
              </div>
              <div style="background:#111320;border-radius:6px;height:8px;overflow:hidden">
                <div id="prog-bar" style="background:linear-gradient(90deg,#e74c3c,#f39c12);height:100%;width:0%;transition:width .3s;border-radius:6px"></div>
              </div>
            </div>
            <div id="crawl-summary" style="display:none;margin-top:10px;font-size:14px;font-weight:600"></div>
          </div>
        </div>

        <!-- Log -->
        <div class="card" style="margin-top:16px">
          <div class="card-hd">📋 Log kết quả</div>
          <div class="card-body" style="padding:12px">
            <div id="crawl-logbox"><span style="color:var(--muted)">Chọn loại xổ → khoảng ngày → bấm Bắt đầu crawl...</span></div>
          </div>
        </div>

      </div><!-- /panel-crawl -->

    </div><!-- /container -->

    <script>
    // ── Tab switching ─────────────────────────────────────
    function showTab(name) {
      document.getElementById('panel-dashboard').style.display = name === 'dashboard' ? '' : 'none';
      document.getElementById('panel-crawl').style.display     = name === 'crawl'     ? '' : 'none';
      document.getElementById('tab-dashboard').className = 'tab-btn' + (name === 'dashboard' ? ' active' : '');
      document.getElementById('tab-crawl').className     = 'tab-btn' + (name === 'crawl'     ? ' active' : '');
      // none navigator
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
        php_host:           fd.get('php_host'),
        php_push_secret:    fd.get('php_push_secret'),
        php_server_url:     fd.get('php_server_url'),
        gemini_api_key:     fd.get('gemini_api_key'),
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

    // ── Start polling ────────────────────────────────────
    fetchStatus();
    setInterval(fetchStatus, 5000);
    </script>
  `, ''));
});

module.exports = router;
module.exports.requireAuth = requireAuth;
