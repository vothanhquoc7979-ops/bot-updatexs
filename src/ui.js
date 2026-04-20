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
  /* Bot message editor */
  .msg-editor{width:100%;background:#080b14;border:1px solid var(--border);border-radius:8px;padding:12px;color:#e8e8f0;font-family:'Cascadia Code',Consolas,monospace;font-size:12.5px;line-height:1.7;resize:vertical;outline:none;min-height:80px;transition:border-color .2s}
  .msg-editor:focus{border-color:var(--accent2)}
  .msg-section{background:#111320;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px}
  .msg-section-hd{padding:10px 16px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;background:#0d1020}
  .msg-section-body{padding:14px 16px}
  .var-chip{display:inline-block;background:#1a2038;border:1px solid #2a3050;border-radius:4px;padding:1px 7px;font-family:monospace;font-size:11px;color:#7bc8f6;cursor:pointer;margin:2px;transition:background .15s}
  .var-chip:hover{background:#2a3555}
  .tgemoji-hint{font-size:11px;color:#5a6080;margin-top:6px}
  .tgemoji-hint code{color:#42a5f5;background:#111830;padding:1px 5px;border-radius:3px;font-size:11px}
  .domain-check{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:8px 12px;background:#111320;border:1px solid var(--border);border-radius:8px;transition:border-color .2s,background .2s}
  .domain-check:hover{border-color:var(--accent2)}
  .domain-check input[type=checkbox]{accent-color:var(--green);width:16px;height:16px;flex-shrink:0}
  .domain-check .d-name{font-weight:600;color:#e8e8f0;}
  .domain-check .d-url{font-size:11px;color:var(--muted);}
  .domain-check input:checked ~ * .d-name{color:#4caf50}
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

// ── POST /api/poll-vietlott ──────────────────────────────
router.post('/api/poll-vietlott', requireAuth, express.json(), async (req, res) => {
  const { game } = req.body;  // game = 'power655' | 'mega645' | 'all'
  try {
    const { pollLiveKetquaPlus, tryFetchJackpotStatic } = require('./live-vietlott');
    const games = (game === 'all' || !game)
      ? ['power655', 'mega645']
      : [game];
    const logs = [];
    const log = msg => { logs.push(msg); logger.log(msg); };
    await Promise.allSettled(games.map(g => pollLiveKetquaPlus(g, log)));
    res.json({ ok: true, logs });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── POST /api/save-config ─────────────────────────────────
router.post('/api/save-config', requireAuth, express.json(), async (req, res) => {
  try {
    const { telegram_bot_token, telegram_chat_id, auto_schedule } = req.body;
    storage.save({
      telegram_bot_token: (telegram_bot_token || '').trim(),
      telegram_chat_id:   (telegram_chat_id   || '').trim(),
      auto_schedule:      auto_schedule === true || auto_schedule === 'true',
    });
    logger.log('✅ Đã lưu cấu hình mới. Restarting bot...');
    const botManager = require('./bot-manager');
    await botManager.restart();
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});
// ── POST /api/save-bot-messages ───────────────────────────────
router.post('/api/save-bot-messages', requireAuth, express.json(), (req, res) => {
  try {
    const allowed = ['completion_header','pending_header','vietlott_header','all_done',
                     'push_ok','push_fail','start_msg','schedule_start'];
    const msgs = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) msgs[k] = String(req.body[k]);
    }
    storage.save({ bot_messages: msgs });
    logger.log('✅ Đã lưu nội dung bot messages');
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── POST /api/save-groq-settings ────────────────────────────
router.post('/api/save-groq-settings', requireAuth, express.json(), (req, res) => {
  try {
    const { groq_default_model, groq_api_base } = req.body;
    const { AVAILABLE_MODELS } = require('./seo-rewriter');
    const validIds = AVAILABLE_MODELS.map(m => m.id);
    if (groq_default_model && !validIds.includes(groq_default_model)) {
      return res.json({ ok: false, msg: 'Model không hợp lệ' });
    }
    const updates = {};
    if (groq_default_model) updates.groq_default_model = groq_default_model;
    if (groq_api_base)      updates.groq_api_base      = groq_api_base.trim().replace(/\/+$/, '');
    storage.save(updates);
    logger.log(`✅ Groq settings: model=${groq_default_model || '(không đổi)'} base=${groq_api_base || '(không đổi)'}`);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});



// ── POST /api/sites/add ────────────────────────────────────
router.post('/api/sites/add', requireAuth, express.json(), (req, res) => {
  try {
    const { domain, secret } = req.body;
    if (!domain || !secret) return res.json({ ok: false, msg: 'Thiếu domain hoặc secret' });
    const cleanDomain = domain.trim().replace(/\/+$/, '');
    if (!cleanDomain.startsWith('http')) return res.json({ ok: false, msg: 'Domain phải bắt đầu bằng https://' });

    const cfg   = storage.load();
    const sites = Array.isArray(cfg.sites) ? cfg.sites : [];
    if (sites.find(s => s.domain === cleanDomain)) return res.json({ ok: false, msg: 'Domain đã tồn tại!' });
    sites.push({ domain: cleanDomain, secret: secret.trim() });
    storage.save({ sites });
    logger.log(`✅ Đã thêm site: ${cleanDomain}`);
    res.json({ ok: true, count: sites.length });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── POST /api/sites/remove ────────────────────────────────
router.post('/api/sites/remove', requireAuth, express.json(), (req, res) => {
  try {
    const index = parseInt(req.body.index ?? -1, 10);
    const cfg   = storage.load();
    const sites = Array.isArray(cfg.sites) ? [...cfg.sites] : [];
    if (index < 0 || index >= sites.length) return res.json({ ok: false, msg: 'Index không hợp lệ' });
    const removed = sites.splice(index, 1);
    storage.save({ sites });
    logger.log(`🗑 Đã xóa site: ${removed[0]?.domain}`);
    res.json({ ok: true, count: sites.length });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── GET /api/sites/test ───────────────────────────────────
router.get('/api/sites/test', requireAuth, async (req, res) => {
  try {
    const index = parseInt(req.query.index ?? -1, 10);
    const cfg   = storage.load();
    const sites = Array.isArray(cfg.sites) ? cfg.sites : [];
    const site  = sites[index];
    if (!site) return res.json({ ok: false, msg: 'Site không tồn tại' });

    const testUrl = site.domain + '/api/crawl-save.php';
    const t0      = Date.now();
    const ctrl    = new AbortController();
    setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(testUrl, {
      method:  'POST',
      signal:  ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-Bot-Secret': site.secret },
      body:    JSON.stringify({ _ping: true }),
    });
    const ms = Date.now() - t0;
    // 403 Forbidden = secret sai; 200/400 = server OK
    if (r.status === 403) return res.json({ ok: false, domain: site.domain, msg: 'Secret sai!', ms });
    res.json({ ok: true, domain: site.domain, status: r.status, ms });
  } catch (e) {
    res.json({ ok: false, msg: e.message });
  }
});

// ── POST /api/groq/add ────────────────────────────────────
router.post('/api/groq/add', requireAuth, express.json(), (req, res) => {
  try {
    const { key, name } = req.body;
    if (!key) return res.json({ ok: false, msg: 'Thiếu API key' });
    const cfg  = storage.load();
    const keys = Array.isArray(cfg.groq_keys) ? cfg.groq_keys : [];
    if (keys.find(k => k.key === key.trim())) return res.json({ ok: false, msg: 'Key đã tồn tại!' });
    const autoName = name && name.trim() ? name.trim() : `API-${keys.length + 1}`;
    keys.push({ name: autoName, key: key.trim(), exhausted: false });
    storage.save({ groq_keys: keys });
    logger.log(`✅ Đã thêm Groq key: ${autoName}`);
    res.json({ ok: true, name: autoName, count: keys.length });
  } catch (e) { res.json({ ok: false, msg: e.message }); }
});

// ── POST /api/groq/remove ─────────────────────────────────
router.post('/api/groq/remove', requireAuth, express.json(), (req, res) => {
  try {
    const index = parseInt(req.body.index ?? -1, 10);
    const cfg   = storage.load();
    const keys  = Array.isArray(cfg.groq_keys) ? [...cfg.groq_keys] : [];
    if (index < 0 || index >= keys.length) return res.json({ ok: false, msg: 'Index không hợp lệ' });
    const removed = keys.splice(index, 1);
    storage.save({ groq_keys: keys });
    logger.log(`🗑 Đã xóa Groq key: ${removed[0]?.name}`);
    res.json({ ok: true, count: keys.length });
  } catch (e) { res.json({ ok: false, msg: e.message }); }
});

// ── POST /api/groq/reset ──────────────────────────────────
router.post('/api/groq/reset', requireAuth, express.json(), (req, res) => {
  try {
    const index = parseInt(req.body.index ?? -1, 10);
    const cfg   = storage.load();
    const keys  = Array.isArray(cfg.groq_keys) ? [...cfg.groq_keys] : [];
    if (index < 0 || index >= keys.length) return res.json({ ok: false, msg: 'Index không hợp lệ' });
    keys[index].exhausted = false;
    storage.save({ groq_keys: keys });
    logger.log(`♻️ Reset Groq key: ${keys[index].name}`);
    res.json({ ok: true, name: keys[index].name });
  } catch (e) { res.json({ ok: false, msg: e.message }); }
});

// ── GET /site-mgr.js (Site management functions — NO template escaping) ────
router.get('/site-mgr.js', requireAuth, (req, res) => {
  res.type('application/javascript').send(
    'async function addSite(){' +
    '  var domain=(document.getElementById("new-site-domain").value||"").trim().replace(/\\/+$/,"");' +
    '  var secret=(document.getElementById("new-site-secret").value||"").trim();' +
    '  var m=document.getElementById("site-add-msg");' +
    '  if(!domain||!secret){m.textContent="⚠️ Nhập đủ Domain và Secret!";m.style.color="#ffa726";return;}' +
    '  if(!domain.startsWith("http")){m.textContent="⚠️ Domain phải bắt đầu bằng https://";m.style.color="#ef5350";return;}' +
    '  m.textContent="⏳ Đang thêm...";m.style.color="#888";' +
    '  var r=await fetch("/api/sites/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:domain,secret:secret})});' +
    '  var d=await r.json();' +
    '  if(d.ok){m.textContent="✅ Đã thêm!";m.style.color="#4caf50";setTimeout(function(){location.reload();},700);}' +
    '  else{m.textContent="❌ "+(d.msg||"Lỗi");m.style.color="#ef5350";}' +
    '}' +
    'async function removeSite(index){' +
    '  if(!confirm("Xóa site này?"))return;' +
    '  var r=await fetch("/api/sites/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({index:index})});' +
    '  var d=await r.json();' +
    '  if(d.ok){if(typeof flash==="function")flash("Đã xóa site!");setTimeout(function(){location.reload();},600);}' +
    '  else if(typeof flash==="function")flash(d.msg||"Lỗi xóa",false);' +
    '}' +
    'async function testSite(index){' +
    '  if(typeof flash==="function")flash("⏳ Đang test kết nối...");' +
    '  var r=await fetch("/api/sites/test?index="+index);' +
    '  var d=await r.json();' +
    '  if(d.ok){if(typeof flash==="function")flash("✅ "+d.domain+" OK! ("+d.ms+"ms)");}' +
    '  else if(typeof flash==="function")flash("❌ "+(d.domain||"")+": "+(d.msg||"Lỗi"),false);' +
    '}'
  );
});

// ── GET /groq-mgr.js (Groq key management — NO template escaping) ──────────
router.get('/groq-mgr.js', requireAuth, (req, res) => {
  res.type('application/javascript').send(
    'async function addGroqKey(){' +
    '  var key=(document.getElementById("new-groq-key").value||"").trim();' +
    '  var name=(document.getElementById("new-groq-name").value||"").trim();' +
    '  var m=document.getElementById("groq-add-msg");' +
    '  if(!key){m.textContent="⚠️ Nhập API Key!";m.style.color="#ffa726";return;}' +
    '  m.textContent="⏳ Đang thêm...";m.style.color="#888";' +
    '  var r=await fetch("/api/groq/add",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:key,name:name})});' +
    '  var d=await r.json();' +
    '  if(d.ok){m.textContent="✅ Đã thêm "+d.name+"!";m.style.color="#4caf50";setTimeout(function(){location.reload();},700);}' +
    '  else{m.textContent="❌ "+(d.msg||"Lỗi");m.style.color="#ef5350";}' +
    '}' +
    'async function removeGroqKey(index){' +
    '  if(!confirm("Xóa Groq key này?"))return;' +
    '  var r=await fetch("/api/groq/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({index:index})});' +
    '  var d=await r.json();' +
    '  if(d.ok){if(typeof flash==="function")flash("Đã xóa key!");setTimeout(function(){location.reload();},600);}' +
    '  else if(typeof flash==="function")flash(d.msg||"Lỗi xóa",false);' +
    '}' +
    'async function resetGroqKey(index){' +
    '  var r=await fetch("/api/groq/reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({index:index})});' +
    '  var d=await r.json();' +
    '  if(d.ok){if(typeof flash==="function")flash("✅ "+d.name+" đã được reset!");setTimeout(function(){location.reload();},600);}' +
    '  else if(typeof flash==="function")flash(d.msg||"Lỗi reset",false);' +
    '}'
  );
});

// ── GET /groq-seo-mgr.js ──────────────────────────────────────────────────
router.get('/groq-seo-mgr.js', requireAuth, (req, res) => {
  res.type('application/javascript').send(
    'async function saveGroqSettings(){' +
    '  var model=(document.getElementById("groq-model-select")?.value||"").trim();' +
    '  var base=(document.getElementById("groq-api-base")?.value||"").trim();' +
    '  var m=document.getElementById("groq-settings-msg");' +
    '  if(!model&&!base){if(m)m.textContent="⚠️ Chọn model hoặc nhập API Base!";return;}' +
    '  if(m){m.textContent="⏳ Đang lưu...";m.style.color="#888";}' +
    '  var r=await fetch("/api/save-groq-settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({groq_default_model:model,groq_api_base:base})});' +
    '  var d=await r.json();' +
    '  if(d.ok){if(m){m.textContent="✅ Đã lưu! Model: "+model;m.style.color="#4caf50";}if(typeof flash==="function")flash("✅ Lưu model thành công!");}' +
    '  else{if(m){m.textContent="❌ "+(d.msg||"Lỗi");m.style.color="#ef5350";}if(typeof flash==="function")flash(d.msg||"Lỗi",false);}' +
    '}'
  );
});

// ── GET /preview/:previewId/:idx ─────────────────────────────────────────────
// Phục vụ bài viết đã tạo (trong memory session) để user xem trước
router.get('/preview/:previewId/:idx', (req, res) => {
  const { getSessionByPreviewId } = require('./session-store');
  const session = getSessionByPreviewId(req.params.previewId);

  if (!session || !session.articles) {
    return res.status(404).send('<h1>404 — Không tìm thấy bài viết</h1><p>Phiên làm việc đã hết hạn hoặc không tồn tại.</p>');
  }

  const idx     = parseInt(req.params.idx, 10);
  const article = session.articles?.[idx];
  if (!article || article.error) {
    return res.status(404).send(`<h1>Bài ${idx + 1} bị lỗi</h1><p>${article?.error || 'Không tìm thấy'}</p>`);
  }

  const thumbHtml = article.image
    ? `<div style="margin-bottom:24px"><img src="data:${article.image.contentType};base64,${article.image.base64}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.15)"></div>`
    : '';

  const totalSites = session.articles.length;
  const navLinks   = session.articles.map((a, i) => {
    const dom = a.site?.domain.replace(/^https?:\/\//, '') || `Site ${i + 1}`;
    return `<a href="/preview/${req.params.previewId}/${i}" style="${i === idx ? 'font-weight:700;color:#1a237e' : 'color:#555'}">${i + 1}. ${dom}</a>`;
  }).join(' &nbsp;|&nbsp; ');

  res.type('text/html; charset=utf-8').send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xem trước: ${(article.seoTitle || article.title || 'Bài viết').replace(/</g, '&lt;')}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;max-width:920px;margin:0 auto;padding:16px;color:#222;background:#f4f6fb}
    .preview-bar{background:linear-gradient(135deg,#1a237e,#283593);color:#fff;padding:14px 20px;border-radius:10px;margin-bottom:16px;font-size:13px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .preview-bar b{font-size:15px}
    .preview-bar a{color:#90caf9}
    .nav-bar{background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:10px 16px;margin-bottom:14px;font-size:13px}
    /* SEO Panel */
    .seo-panel{background:#fff;border-radius:10px;padding:18px 22px;margin-bottom:16px;box-shadow:0 1px 8px rgba(0,0,0,.07);border-left:4px solid #3f51b5}
    .seo-panel h3{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#3f51b5;margin:0 0 14px}
    .seo-row{display:flex;gap:8px;margin-bottom:10px;align-items:flex-start}
    .seo-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#888;min-width:120px;padding-top:2px}
    .seo-value{font-size:13px;color:#333;flex:1;background:#f8f9ff;border-radius:5px;padding:5px 9px;border:1px solid #e3e5f5;line-height:1.5}
    .seo-value.good{border-color:#4caf50;background:#f1fdf3}
    .seo-value.warn{border-color:#ff9800;background:#fffbf0}
    .seo-len{font-size:11px;margin-left:6px;color:#999}
    /* Google Preview */
    .google-preview{background:#fff;border:1px solid #dfe1e5;border-radius:10px;padding:16px 20px;margin-bottom:16px;font-family:Arial,sans-serif}
    .gp-label{font-size:11px;font-weight:700;text-transform:uppercase;color:#888;margin-bottom:10px;letter-spacing:.4px}
    .gp-domain{color:#0d652d;font-size:13px;margin-bottom:2px}
    .gp-title{color:#1a0dab;font-size:20px;font-weight:400;margin-bottom:3px;cursor:pointer}
    .gp-title:hover{text-decoration:underline}
    .gp-desc{color:#4d5156;font-size:14px;line-height:1.5}
    /* Article */
    .article{background:#fff;border-radius:12px;padding:36px 40px;box-shadow:0 2px 16px rgba(0,0,0,.07)}
    h1{font-size:2em;color:#1a237e;border-bottom:3px solid #3f51b5;padding-bottom:12px;margin-bottom:20px}
    h2{font-size:1.45em;color:#283593;margin-top:36px;margin-bottom:8px}
    h3{font-size:1.15em;color:#3949ab;margin-top:20px;margin-bottom:6px}
    p{line-height:1.8;margin-bottom:16px}
    a{color:#1565c0}
    strong{color:#1a237e}
    ul,ol{padding-left:24px;margin-bottom:16px}
    li{margin-bottom:6px}
    .cta-box{background:#fff3e0;border-radius:8px;padding:16px;font-size:13px;border-left:4px solid #ff9800;margin-top:20px}
  </style>
</head>
<body>
  <div class="preview-bar">
    <div><b>👁 Xem trước bài viết ${idx + 1}/${totalSites}</b></div>
    <div>🌐 ${article.site?.domain || ''}</div>
    <div>📂 ${article.category?.name || article.category?.id || ''}</div>
    <div>🤖 ${article.model || ''}</div>
    <div>🔗 Nguồn: <a href="${session.url}" target="_blank">${session.url.slice(0, 55)}...</a></div>
  </div>

  ${totalSites > 1 ? `<div class="nav-bar">Các site: ${navLinks}</div>` : ''}

  <!-- SEO Metadata Panel -->
  <div class="seo-panel">
    <h3>🔍 SEO Metadata</h3>

    <div class="seo-row">
      <div class="seo-label">SEO Title</div>
      <div class="seo-value ${(article.seoTitle||'').length >= 50 && (article.seoTitle||'').length <= 60 ? 'good' : 'warn'}">
        ${(article.seoTitle || article.title || '—').replace(/</g, '&lt;')}
        <span class="seo-len">${(article.seoTitle || '').length}/60 ký tự</span>
      </div>
    </div>

    <div class="seo-row">
      <div class="seo-label">Meta Description</div>
      <div class="seo-value ${(article.metaDescription||'').length >= 140 && (article.metaDescription||'').length <= 160 ? 'good' : 'warn'}">
        ${(article.metaDescription || '—').replace(/</g, '&lt;')}
        <span class="seo-len">${(article.metaDescription || '').length}/160 ký tự</span>
      </div>
    </div>

    <div class="seo-row">
      <div class="seo-label">Focus Keyword</div>
      <div class="seo-value good">${(article.focusKeyword || '—').replace(/</g, '&lt;')}</div>
    </div>

    <div class="seo-row">
      <div class="seo-label">Keywords</div>
      <div class="seo-value">${(article.keywords || '—').replace(/</g, '&lt;')}</div>
    </div>

    <div class="seo-row">
      <div class="seo-label">Slug</div>
      <div class="seo-value good"><code>${article.slug || '—'}</code></div>
    </div>
  </div>

  <!-- Google Search Preview -->
  <div class="google-preview">
    <div class="gp-label">📌 Google Search Preview</div>
    <div class="gp-domain">${article.site?.domain?.replace(/^https?:\/\//, '') || 'yoursite.com'} › ${article.slug || '...'}</div>
    <div class="gp-title">${(article.seoTitle || article.title || 'Tiêu đề SEO').replace(/</g, '&lt;').slice(0, 60)}</div>
    <div class="gp-desc">${(article.metaDescription || 'Meta description sẽ hiển thị ở đây trên Google.').replace(/</g, '&lt;').slice(0, 160)}</div>
  </div>

  <!-- Article Content -->
  <div class="article">
    ${thumbHtml}
    ${article.html}
  </div>

  <div class="cta-box">
    ✅ Nếu bài ổn, gửi <b>/upbai</b> trong Telegram bot để đăng lên website.<br>
    ❌ Gửi <b>/cancelbai</b> để hủy và bắt đầu lại.
  </div>
</body>
</html>`);
});

// ── GET / (Dashboard) ─────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const cfg      = storage.load();
  const hasToken = !!cfg.telegram_bot_token;
  const groqKeys = Array.isArray(cfg.groq_keys) ? cfg.groq_keys : [];
  const groqActive    = groqKeys.filter(k => !k.exhausted);
  const groqExhausted = groqKeys.filter(k => k.exhausted);

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
        <button class="tab-btn" id="tab-botmsg" onclick="showTab('botmsg')">📝 Nội dung Bot</button>
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
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
              <button class="btn btn-green" onclick="ctrl('start','all')">▶▶ Chạy tất cả</button>
              <button class="btn btn-primary" onclick="ctrl('stop','all')">⏹ Dừng tất cả</button>
              <button class="btn btn-blue" onclick="pollVietlott()" id="btn-poll-vl" title="Gọi ngay API Vietlott để lấy số + jackpot">🔗 Gọi API Vietlott</button>
              <span id="poll-vl-msg" style="font-size:12px;color:var(--muted)"></span>
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

      <!-- Card: Cấu hình Bot (Telegram + Scheduler) -->
      <div class="card" style="margin-top:16px">
        <div class="card-hd">⚙️ Cấu hình Bot (Telegram + Scheduler)</div>
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
              </div>
              <div>
                <div class="form-group">
                  <label>Auto-schedule (tự chạy theo giờ xổ)</label>
                  <select name="auto_schedule" id="f-auto">
                    <option value="true" ${cfg.auto_schedule !== false ? 'selected' : ''}>✅ Bật — tự chạy theo lịch VN</option>
                    <option value="false" ${cfg.auto_schedule === false ? 'selected' : ''}>❌ Tắt — chỉ chạy khi bấm tay</option>
                  </select>
                </div>
              </div>
            </div>
            <button type="submit" class="btn btn-primary">💾 Lưu cấu hình & Restart bot</button>
          </form>
        </div>
      </div>

      <!-- Card: Groq API Keys -->
      <div class="card" style="margin-top:16px">
        <div class="card-hd">🤖 Groq API Keys
          <span class="pill ${groqActive.length > 0 ? 'pill-on' : 'pill-off'}" style="font-size:11px;margin-left:8px">${groqActive.length} active / ${groqKeys.length} total</span>
        </div>
        <div class="card-body">
          <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Dùng cho Auto-Chat Bot AI &amp; SEO Content Writer. Bot tự xoay vòng key khi hết token.</p>

          <!-- ── Model Selector ── -->
          ${(()=>{
            const { AVAILABLE_MODELS } = require('./seo-rewriter');
            const currentModel = cfg.groq_default_model || 'llama-3.3-70b-versatile';
            const currentBase  = cfg.groq_api_base || 'https://api.groq.com/openai/v1';
            const modelOpts = AVAILABLE_MODELS.map(m =>
              `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>${m.label} — ${m.note}</option>`
            ).join('');
            return `
          <div style="background:#111320;border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:16px">
            <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:10px">⚙️ Cài đặt Model AI (cho /link command)</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
              <div class="form-group" style="flex:1;min-width:200px;margin:0">
                <label>Model mặc định</label>
                <select id="groq-model-select" style="width:100%;background:#0f1117;border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;outline:none">
                  ${modelOpts}
                </select>
              </div>
              <div class="form-group" style="flex:2;min-width:250px;margin:0">
                <label>API Base URL <span style="font-weight:400;color:#888">(Groq hoặc OpenRouter)</span></label>
                <input type="text" id="groq-api-base" value="${currentBase}"
                  placeholder="https://api.groq.com/openai/v1"
                  style="width:100%;background:#0f1117;border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;outline:none">
              </div>
              <button class="btn btn-blue" onclick="saveGroqSettings()" style="white-space:nowrap">💾 Lưu model</button>
            </div>
            <p id="groq-settings-msg" style="margin-top:8px;font-size:12px"></p>
            <p style="font-size:11px;color:#5a6080;margin-top:8px">
              💡 <b>Groq native</b> (llama-*): dùng <code style="color:#42a5f5">https://api.groq.com/openai/v1</code> &nbsp;|&nbsp;
              <b>OpenRouter</b> (openai/*, moonshotai/*): dùng <code style="color:#42a5f5">https://openrouter.ai/api/v1</code>
            </p>
          </div>`;
          })()}

          <!-- ── Active keys ── -->
          ${groqActive.length === 0
            ? '<div style="color:var(--muted);font-size:13px;margin-bottom:12px">(Chưa có key nào đang hoạt động)</div>'
            : groqActive.map((k) => { const idx = groqKeys.indexOf(k); return `
            <div class="status-row" style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
              <div>
                <div style="font-weight:700;color:#4caf50">${k.name}</div>
                <code style="font-size:11px;color:var(--muted)">${k.key.slice(0,8)}••••${k.key.slice(-4)}</code>
              </div>
              <div class="actions"><button class="btn btn-primary btn-sm" onclick="removeGroqKey(${idx})">✖ Xóa</button></div>
            </div>`;}).join('')
          }

          ${groqExhausted.length > 0 ? `
          <div style="margin-top:14px">
            <p style="font-size:12px;color:#ef5350;margin-bottom:8px">⚠️ Keys đã hết token (bị tắt tự động):</p>
            ${groqExhausted.map((k) => { const idx = groqKeys.indexOf(k); return `
            <div class="status-row" style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);opacity:0.7">
              <div>
                <div style="font-weight:700;color:#ef5350">${k.name} <span style="font-size:10px">(hết token)</span></div>
                <code style="font-size:11px;color:var(--muted)">${k.key.slice(0,8)}••••${k.key.slice(-4)}</code>
              </div>
              <div class="actions">
                <button class="btn btn-green btn-sm" onclick="resetGroqKey(${idx})">♻️ Reset</button>
                <button class="btn btn-primary btn-sm" onclick="removeGroqKey(${idx})">✖ Xóa</button>
              </div>
            </div>`;}).join('')}
          </div>` : ''}

          <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
            <div class="form-group" style="flex:0 0 110px;margin:0">
              <label>Tên key</label>
              <input type="text" id="new-groq-name" placeholder="API-${groqKeys.length + 1}" style="width:100%">
            </div>
            <div class="form-group" style="flex:1;min-width:220px;margin:0">
              <label>Groq / OpenRouter API Key</label>
              <input type="password" id="new-groq-key" placeholder="gsk_xxx... hoặc sk-or-xxx..." style="width:100%">
            </div>
            <button class="btn btn-green" onclick="addGroqKey()" style="white-space:nowrap">+ Thêm key</button>
          </div>
          <p id="groq-add-msg" style="margin-top:8px;font-size:13px"></p>
        </div>
      </div>

      <!-- Card: Quản lý Websites -->
      <div class="card" style="margin-top:16px">
        <div class="card-hd">🌐 Websites nhận dữ liệu
          <span class="pill pill-off" style="font-size:11px;margin-left:8px" id="sites-count">${(cfg.sites||[]).length} site</span>
        </div>
        <div class="card-body">
          <p style="font-size:12px;color:var(--muted);margin-bottom:14px">
            Bot sẽ push dữ liệu đồng thời đến tất cả sites bên dưới.<br>
            URL được tự động tạo: <code style="color:#42a5f5">{domain}/api/crawl-save.php</code>
          </p>

          <!-- Danh sách sites -->
          <div id="sites-list" style="margin-bottom:16px">
            ${(cfg.sites||[]).length === 0
              ? '<div style="color:var(--muted);font-size:13px">(Chưa có site nào)</div>'
              : (cfg.sites||[]).map((s,i) => `
                <div class="status-row" id="site-row-${i}">
                  <div>
                    <div style="font-weight:600;font-size:13px">${s.domain}</div>
                    <div style="font-size:11px;color:var(--muted)">Secret: ${s.secret ? s.secret.slice(0,6)+'••••' : '(chưa có)'}</div>
                  </div>
                  <div class="actions">
                    <button class="btn btn-blue btn-sm" onclick="testSite(${i})">&#128268; Test</button>
                    <button class="btn btn-primary btn-sm" onclick="removeSite(${i})">✖ Xóa</button>
                  </div>
                </div>
              `).join('')
            }
          </div>

          <!-- Form thêm site -->
          <div style="border-top:1px solid var(--border);padding-top:14px">
            <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Thêm website mới:</p>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
              <div class="form-group" style="margin:0;flex:2;min-width:200px">
                <label>Domain (không có dấu / cuối)</label>
                <input type="text" id="new-site-domain" placeholder="https://yoursite.com">
              </div>
              <div class="form-group" style="margin:0;flex:1;min-width:140px">
                <label>PHP Push Secret</label>
                <input type="password" id="new-site-secret" placeholder="random_secret">
              </div>
              <button class="btn btn-green" onclick="addSite()">+ Thêm site</button>
            </div>
            <div id="site-add-msg" style="margin-top:8px;font-size:12px"></div>
          </div>
        </div>
      </div>

      </div><!-- /panel-dashboard -->

      <!-- ═══════════════ TAB: NỘI DUNG BOT ═══════════════ -->
      <div id="panel-botmsg" style="display:none">
        <div id="flash-botmsg" style="display:none" class="alert alert-ok"></div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-hd">🎨 Hướng dẫn: Chèn Custom Emoji Telegram</div>
          <div class="card-body" style="font-size:13px;line-height:1.8">
            <p>Dán trực tiếp thẻ emoji vào bất kỳ vị trí nào trong nội dung:</p>
            <code style="display:block;background:#080b14;padding:10px 14px;border-radius:8px;color:#42a5f5;font-size:12px;margin:10px 0">&lt;tg-emoji emoji-id="5447644880824181073"&gt;&lt;/tg-emoji&gt;</code>
            <p style="color:var(--muted)">Click vào chip bên dưới để chèn biến vào vị trí con trỏ trong textarea:</p>
            <div style="margin-top:8px;line-height:2.2">
              <span class="var-chip" onclick="insertVar('{region_done}')">{region_done}</span> — Tên miền xổ xong&nbsp;&nbsp;
              <span class="var-chip" onclick="insertVar('{provinces_done}')">{provinces_done}</span> — Danh sách tỉnh đã xong
            </div>
          </div>
        </div>
                <div class="card" style="margin-bottom:16px">
          <div class="card-hd">📊 Thông báo Tự Động</div>
          <div class="card-body">
            <div class="msg-section">
              <div class="msg-section-hd">✅ Khi 1 miền xổ xong hoàn toàn</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>Tiêu đề xổ xong <span style="color:var(--muted);font-weight:400;text-transform:none">({region_done})</span></label>
                  <textarea id="bm-completion-header" class="msg-editor" rows="2">${(cfg.bot_messages?.completion_header || '✅ <b>Xổ Số {region_done}</b> đã cập nhật đầy đủ!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>Dòng đầu "Còn đợi"</label>
                  <textarea id="bm-pending-header" class="msg-editor" rows="2">${(cfg.bot_messages?.pending_header || '⏳ <b>Các hàng còn đợi:</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>Dòng đầu Vietlott</label>
                  <textarea id="bm-vietlott-header" class="msg-editor" rows="2">${(cfg.bot_messages?.vietlott_header || '🎰 <b>Vietlott</b> (18:00 - 18:30)').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>Khi tất cả xong</label>
                  <textarea id="bm-all-done" class="msg-editor" rows="2">${(cfg.bot_messages?.all_done || '🏆 Tất cả cuộc xổ hôm nay đã hoàn thành!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="tgemoji-hint">💡 Hỗ trợ: <code>&lt;b&gt;</code> <code>&lt;i&gt;</code> <code>&lt;tg-emoji emoji-id="..."&gt;&lt;/tg-emoji&gt;</code></div>
              </div>
            </div>
            <div class="msg-section">
              <div class="msg-section-hd">⚠️ Push Thất Bại ({site_domain}, {error_reason})</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>Template cảnh báo</label>
                  <textarea id="bm-push-fail" class="msg-editor" rows="2">${(cfg.bot_messages?.push_fail || '⚠️ Push thất bại đến <b>{site_domain}</b>\\n❌ {error_reason}').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <div class="msg-section">
              <div class="msg-section-hd">🕒 Auto-Schedule Bắt Đầu <span style="color:var(--muted);font-size:11px;font-weight:400">(trống = không gửi)</span></div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>Template ({region_name})</label>
                  <textarea id="bm-schedule-start" class="msg-editor" rows="2" placeholder="Để trống = không thông báo">${(cfg.bot_messages?.schedule_start || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <div class="card-hd">🎰 Lệnh Crawl &amp; Xổ Số</div>
          <div class="card-body">
            <div class="msg-section">
              <div class="msg-section-hd">🚀 /start — Dòng tiêu đề chào</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>Header /start <span style="color:var(--muted);font-weight:400;text-transform:none">(phần danh sách lệnh giữ nguyên)</span></label>
                  <textarea id="bm-cmd-start-header" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_start_header || '🎰 <b>KQXS Live Bot</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="tgemoji-hint">💡 Mặc định: 🎰 &lt;b&gt;KQXS Live Bot&lt;/b&gt;</div>
              </div>
            </div>
            <div class="msg-section">
              <div class="msg-section-hd">▶️ /chay — Bắt đầu Poll</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/chay all</label>
                  <textarea id="bm-cmd-chay-all" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_chay_all || '🚀 Đã bắt đầu poll cả 3 miền!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/chay mb|mn|mt <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span></label>
                  <textarea id="bm-cmd-chay-region" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_chay_region || '🚀 Bắt đầu poll {region_name}...').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <div class="msg-section">
              <div class="msg-section-hd">⏹ /dung — Dừng Poll</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/dung (tất cả)</label>
                  <textarea id="bm-cmd-dung-all" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_dung_all || '⏹ Đã dừng tất cả.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/dung mb|mn|mt <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span></label>
                  <textarea id="bm-cmd-dung-region" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_dung_region || '⏹ Đã dừng {region_name}').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <div class="msg-section">
              <div class="msg-section-hd">📊 /xem, /status, /lichxo, /cancelbai</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/xem header <span style="color:var(--muted);font-weight:400;text-transform:none">({region_name})</span></label>
                  <textarea id="bm-cmd-xem-header" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_xem_header || '📊 <b>KQ {region_name}</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/status header</label>
                  <textarea id="bm-cmd-status-header" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_status_header || '📊 <b>Trạng thái:</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/lichxo — Full message</label>
                  <textarea id="bm-cmd-lichxo" class="msg-editor" rows="4">${(cfg.bot_messages?.cmd_lichxo || '📅 <b>Lịch xổ hôm nay</b>\\n\\n🟢 Miền Nam / Miền Trung: 16:00 – 17:30\\n🔴 Miền Bắc: 18:30 – 19:15').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/cancelbai</label>
                  <textarea id="bm-cmd-cancelbai" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_cancelbai || '🗑️ Đã hủy phiên làm việc hiện tại.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
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
                  <textarea id="bm-cmd-keys-header" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_keys_header || '🔑 <b>Groq API Keys</b>').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/keys khi chưa có key</label>
                  <textarea id="bm-cmd-keys-empty" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_keys_empty || '❌ Chưa có Groq API key nào!').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
            <div class="msg-section">
              <div class="msg-section-hd">🔄 /resetgroq — Reset Keys</div>
              <div class="msg-section-body">
                <div class="form-group" style="margin-bottom:10px">
                  <label>/resetgroq OK <span style="color:var(--muted);font-weight:400;text-transform:none">({count})</span></label>
                  <textarea id="bm-cmd-resetgroq-ok" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_resetgroq_ok || '✅ <b>Đã reset {count} key!</b>\\n\\nTất cả keys đã sẵn sàng.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/resetgroq khi không có key exhausted</label>
                  <textarea id="bm-cmd-resetgroq-none" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_resetgroq_none || 'ℹ️ Không có key nào cần reset.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
                <div class="form-group" style="margin-bottom:10px">
                  <label>/resetgroq khi chưa có key nào</label>
                  <textarea id="bm-cmd-resetgroq-empty" class="msg-editor" rows="2">${(cfg.bot_messages?.cmd_resetgroq_empty || '❌ Chưa có Groq API key nào để reset.').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:16px;align-items:center">
          <button class="btn btn-primary" onclick="saveBotMessages()">💾 Lưu tất cả</button>
          <button class="btn btn-gray" onclick="resetBotMessages()">↩️ Về mặc định</button>
          <span id="botmsg-save-msg" style="font-size:13px;margin-left:4px"></span>
        </div>
</div><!-- /panel-botmsg -->
      <script type="application/json" id="bot-dfl">${
        JSON.stringify({
          completion_header  : '\u2705 <b>X\u1ed5 S\u1ed1 {region_done}</b> \u0111\u00e3 c\u1eadp nh\u1eadt tr\u1ef1c ti\u1ebfp v\u00e0 \u0111\u1ea7y \u0111\u1ee7 Full s\u1ed1 th\u00e0nh c\u00f4ng!',
          pending_header     : '\u23f3 <b>C\u00e1c h\u00e0ng c\u00f2n \u0111\u1ee3i:</b>',
          vietlott_header    : '\ud83c\udfb0 <b>Vietlott</b> (18:00 - 18:30)',
          all_done           : '\ud83c\udfc6 T\u1ea5t c\u1ea3 cu\u1ed9c x\u1ed5 h\u00f4m nay \u0111\u00e3 ho\u00e0n th\u00e0nh!',
          push_fail          : '\u26a0\ufe0f Push th\u1ea5t b\u1ea1i \u0111\u1ebfn <b>{site_domain}</b>\n\u274c {error_reason}',
          schedule_start     : '',
          cmd_start_header   : '\ud83c\udfb0 <b>KQXS Live Bot</b>',
          cmd_chay_all       : '\ud83d\ude80 \u0110\u00e3 b\u1eaft \u0111\u1ea7u poll c\u1ea3 3 mi\u1ec1n!',
          cmd_chay_region    : '\ud83d\ude80 B\u1eaft \u0111\u1ea7u poll {region_name}...',
          cmd_dung_all       : '\u23f9 \u0110\u00e3 d\u1eebng t\u1ea5t c\u1ea3.',
          cmd_dung_region    : '\u23f9 \u0110\u00e3 d\u1eebng {region_name}',
          cmd_xem_header     : '\ud83d\udcca <b>KQ {region_name}</b>',
          cmd_status_header  : '\ud83d\udcca <b>Tr\u1ea1ng th\u00e1i:</b>',
          cmd_lichxo         : '\ud83d\udcc5 <b>L\u1ecbch x\u1ed5 h\u00f4m nay</b>\n\n\ud83d\udfe2 Mi\u1ec1n Nam / Mi\u1ec1n Trung: 16:00 \u2013 17:30\n\ud83d\udd34 Mi\u1ec1n B\u1eafc: 18:30 \u2013 19:15',
          cmd_cancelbai      : '\ud83d\uddd1\ufe0f \u0110\u00e3 h\u1ee7y phi\u00ean l\u00e0m vi\u1ec7c hi\u1ec7n t\u1ea1i.',
          cmd_keys_header    : '\ud83d\udd11 <b>Groq API Keys</b>',
          cmd_keys_empty     : '\u274c Ch\u01b0a c\u00f3 Groq API key n\u00e0o!',
          cmd_resetgroq_ok   : '\u2705 <b>\u0110\u00e3 reset {count} key!</b>\n\nT\u1ea5t c\u1ea3 keys \u0111\u00e3 s\u1eb5n s\u00e0ng.',
          cmd_resetgroq_none : '\u2139\ufe0f Kh\u00f4ng c\u00f3 key n\u00e0o c\u1ea7n reset.',
          cmd_resetgroq_empty: '\u274c Ch\u01b0a c\u00f3 Groq API key n\u00e0o \u0111\u1ec3 reset.',
        }).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
      }</script>

      <!-- ═══════════════ TAB: CRAWL DỮ LIỆU ═══════════════ -->
      <div id="panel-crawl" style="display:none">

        <!-- Chọn loại xổ -->
        <div class="card">
          <div class="card-hd">🎯 Chọn loại xổ số cần crawl</div>
          <div class="card-body">
            <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
              <button class="btn btn-blue btn-sm" onclick="toggleAllMien(true)">✅ Chọn tất cả 3 Miền</button>
              <button class="btn btn-gray btn-sm" onclick="toggleAllMien(false)">❌ Bỏ chọn</button>
            </div>

            <!-- 3 Miền -->
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px">📌 Xổ số 3 Miền (source: GitHub JSON API)</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-bottom:16px">
              <label class="game-check"><input type="checkbox" class="mien-cb" value="mb"> 🏛️ XS Miền Bắc (XSMB)</label>
              <label class="game-check"><input type="checkbox" class="mien-cb" value="mn"> 🌴 XS Miền Nam (XSMN)</label>
              <label class="game-check"><input type="checkbox" class="mien-cb" value="mt"> 🏝️ XS Miền Trung (XSMT)</label>
            </div>

            <!-- Vietlott -->
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:8px">💰 Vietlott (source: GitHub JSON API)</p>
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
                <input type="date" id="crawl-from" value="${new Date().toISOString().slice(0,10)}">
              </div>
              <div class="form-group" style="margin:0">
                <label>Đến ngày</label>
                <input type="date" id="crawl-to" value="${new Date().toISOString().slice(0,10)}">
              </div>
              <button class="btn btn-blue" id="btn-check" onclick="checkMissing()">🔍 Kiểm tra thiếu ngày</button>
              <button class="btn btn-green btn-sm" id="btn-check-inc" onclick="checkIncomplete()">🔧 Kiểm tra số thiếu</button>
              <button class="btn btn-primary" id="btn-crawl" onclick="runCrawl()">🚀 Bắt đầu crawl</button>
            </div>
          </div>
        </div>

        <!-- Chọn Website đích -->
        <div class="card" style="margin-top:16px">
          <div class="card-hd">🌐 Chọn Website nhận dữ liệu crawl</div>
          <div class="card-body">
            <p style="font-size:12px;color:var(--muted);margin-bottom:12px">
              Dữ liệu crawl từ GitHub API sẽ được đẩy đến các website đã chọn bên dưới.
              Mặc định (không chọn gì) = chỉ đẩy đến site đầu tiên.
            </p>
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
              <button class="btn btn-blue btn-sm" onclick="toggleAllDomains(true)">✅ Chọn tất cả</button>
              <button class="btn btn-gray btn-sm" onclick="toggleAllDomains(false)">❌ Bỏ chọn</button>
            </div>
            ${(()=>{
              const sites = cfg.sites || [];
              if (sites.length === 0) {
                return '<div style="color:var(--muted);font-size:13px;padding:10px 0">⚠️ Chưa có site nào. Vào tab Dashboard → thêm site trước.</div>';
              }
              return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">
                ${sites.map((s, i) => `
                <label class="domain-check">
                  <input type="checkbox" class="domain-cb" value="${i}" checked>
                  <div>
                    <div class="d-name">${s.domain.replace(/^https?:\/\//, '')}</div>
                    <div class="d-url">${s.domain}</div>
                  </div>
                </label>`).join('')}
              </div>`;
            })()}
          </div>
        </div>

        <!-- Progress & Log -->
        <div class="card" style="margin-top:16px">
          <div class="card-hd">📊 Tiến trình</div>
          <div class="card-body" id="crawl-progress" style="display:none">
            <div style="background:#111320;border-radius:6px;overflow:hidden;margin-bottom:8px">
              <div id="prog-bar" style="width:0%;height:8px;background:var(--green);transition:width .3s"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)">
              <span id="prog-label">Đang crawl...</span>
              <span id="prog-count"></span>
            </div>
            <div id="crawl-summary" style="display:none;margin-top:8px;font-size:13px"></div>
          </div>
          <div class="card-hd" style="border-top:1px solid var(--border)">📋 Log kết quả</div>
          <div class="card-body" style="padding:12px">
            <div id="crawl-logbox" style="background:#080b14;border-radius:8px;padding:12px;height:260px;overflow-y:auto;font-family:monospace;font-size:12px;line-height:1.6;border:1px solid var(--border)">
              <span style="color:var(--muted)">Chọn loại xổ → chọn website → khoảng ngày → bấm Bắt đầu crawl...</span>
            </div>
          </div>
        </div>

      </div><!-- /panel-crawl -->

    </div><!-- /container -->

    <script>

    // ── Tab switching ──────────────────────────────────────────
    function showTab(name) {
      ['dashboard','botmsg','crawl'].forEach(function(t) {
        document.getElementById('panel-' + t).style.display = t === name ? '' : 'none';
        document.getElementById('tab-' + t).className = 'tab-btn' + (t === name ? ' active' : '');
      });
    }

    // ── Poll status mỗi 5s ─────────────────────────────────────
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
        if (line.includes('đang poll')) { el.textContent='🔴 Live'; el.className='pill pill-on'; }
        else if (line.includes('xong')) { el.textContent='✅ Xong'; el.className='pill pill-done'; }
        else { el.textContent='Dừng'; el.className='pill pill-off'; }
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
        return '<div class="' + cls + '"><span style="color:#3d4566">' + l.ts + '</span> ' + escHtml(l.msg) + '</div>';
      }).join('');
      if (atBottom) box.scrollTop = box.scrollHeight;
    }

    function escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Control ──────────────────────────────────────
    async function ctrl(action, region) {
      const r = await fetch('/api/control', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action, region}) });
      const d = await r.json();
      flash(d.msg || (d.ok ? 'OK' : 'Lỗi'), d.ok);
    }

    async function clearLogs() {
      await fetch('/api/control', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({action:'clear_logs'}) });
      document.getElementById('logbox').innerHTML = '';
    }

    async function pollVietlott() {
      const btn = document.getElementById('btn-poll-vl');
      const msg = document.getElementById('poll-vl-msg');
      btn.disabled = true; btn.textContent = '⏳ Đang gọi...';
      msg.textContent = '';
      try {
        const r = await fetch('/api/poll-vietlott', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({game:'all'}) });
        const d = await r.json();
        if (d.ok) { msg.style.color='#4caf50'; msg.textContent='✅ Đã gọi!'; }
        else       { msg.style.color='#ef5350'; msg.textContent='❌ '+(d.msg||'Lỗi'); }
      } catch(e) { msg.style.color='#ef5350'; msg.textContent='❌ '+e.message; }
      finally {
        btn.disabled = false; btn.textContent = '🔗 Gọi API Vietlott';
        setTimeout(() => { msg.textContent=''; }, 6000);
      }
    }

    function flash(msg, ok = true) {
      const el = document.getElementById('flash');
      el.textContent = (ok ? '✅ ' : '❌ ') + msg;
      el.className = 'alert ' + (ok ? 'alert-ok' : 'alert-err');
      el.style.display = 'block';
      clearTimeout(flash._t);
      flash._t = setTimeout(() => { el.style.display = 'none'; }, 4000);
    }

    document.getElementById('cfg-form').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        telegram_bot_token: fd.get('telegram_bot_token'),
        telegram_chat_id:   fd.get('telegram_chat_id'),
        auto_schedule:      fd.get('auto_schedule') === 'true',
      };
      const r = await fetch('/api/save-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const d = await r.json();
      flash(d.ok ? 'Đã lưu cấu hình! Bot đang restart...' : (d.msg || 'Lỗi'), d.ok);
    });

    // ── Crawl ──────────────────────────────────────────────────
    function toggleAllMien(checked) {
      document.querySelectorAll('.mien-cb').forEach(cb => { cb.checked = checked; });
    }
    function toggleAllDomains(checked) {
      document.querySelectorAll('.domain-cb').forEach(cb => { cb.checked = checked; });
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
      const mienChecked     = Array.from(document.querySelectorAll('.mien-cb:checked')).map(cb => cb.value);
      const vietlottChecked = Array.from(document.querySelectorAll('.game-cb:checked')).map(cb => cb.value);
      const targetSites     = Array.from(document.querySelectorAll('.domain-cb:checked')).map(cb => parseInt(cb.value, 10));
      const from = document.getElementById('crawl-from').value;
      const to   = document.getElementById('crawl-to').value;

      if (!mienChecked.length && !vietlottChecked.length) {
        alert('Vui lòng chọn ít nhất 1 loại xổ số!'); return;
      }
      if (!from || !to) { alert('Vui lòng chọn khoảng ngày!'); return; }
      if (!targetSites.length) {
        if (!confirm('Chưa chọn website nào!\nBấm OK để dùng site đầu tiên, Cancel để chọn lại.')) return;
      }

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
            body: JSON.stringify({ regions: mienChecked, from, to, targetSites }),
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
            body: JSON.stringify({ games: vietlottChecked, from, to, force: false, targetSites }),
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
        // auto
        ['completion-header','completion_header'],
        ['pending-header','pending_header'],
        ['vietlott-header','vietlott_header'],
        ['all-done','all_done'],
        ['push-fail','push_fail'],
        ['schedule-start','schedule_start'],
        // crawl
        ['cmd-start-header','cmd_start_header'],
        ['cmd-chay-all','cmd_chay_all'],
        ['cmd-chay-region','cmd_chay_region'],
        ['cmd-dung-all','cmd_dung_all'],
        ['cmd-dung-region','cmd_dung_region'],
        ['cmd-xem-header','cmd_xem_header'],
        ['cmd-status-header','cmd_status_header'],
        ['cmd-lichxo','cmd_lichxo'],
        ['cmd-cancelbai','cmd_cancelbai'],
        // groq
        ['cmd-keys-header','cmd_keys_header'],
        ['cmd-keys-empty','cmd_keys_empty'],
        ['cmd-resetgroq-ok','cmd_resetgroq_ok'],
        ['cmd-resetgroq-none','cmd_resetgroq_none'],
        ['cmd-resetgroq-empty','cmd_resetgroq_empty'],
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
      if (!confirm('\u0110\u1eb7t v\u1ec1 n\u1ed9i dung m\u1eb7c \u0111\u1ecbnh?')) return;
      try {
        var dfl = JSON.parse(document.getElementById('bot-dfl').textContent);
        var fields = [
          ['completion-header','completion_header'],
          ['pending-header','pending_header'],
          ['vietlott-header','vietlott_header'],
          ['all-done','all_done'],
          ['push-fail','push_fail'],
          ['start-msg','start_msg'],
          ['schedule-start','schedule_start'],
        ];
        fields.forEach(function(f) {
          var el = document.getElementById('bm-' + f[0]);
          if (el && dfl[f[1]] !== undefined) el.value = dfl[f[1]];
        });
      } catch(e) { alert('L\u1ed7i: ' + e.message); }
    }
    </script>
  `, '<script src="/site-mgr.js"></script><script src="/groq-mgr.js"></script><script src="/groq-seo-mgr.js"></script>'));
});

module.exports = router;
module.exports.requireAuth = requireAuth;
