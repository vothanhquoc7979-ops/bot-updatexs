/**
 * bot-manager.js — Khởi động và restart Telegram Bot
 * Tách ra để UI có thể trigger restart khi save config mới
 */
'use strict';

const { Telegraf } = require('telegraf');
const storage = require('./storage');
const logger  = require('./logger');

let botInstance = null;

async function start() {
  const token = storage.get('telegram_bot_token')
    || process.env.TELEGRAM_BOT_TOKEN || '';

  if (!token) {
    logger.log('⚠️ Chưa có Telegram Bot Token — bot Telegram chưa khởi động');
    return null;
  }

  const { Telegraf } = require('telegraf');
  const bot = new Telegraf(token);

  // ── Commands ─────────────────────────────────────────
  const { start: schedStart, stop: schedStop, stopAll, getStatus, getCurrentData } = require('./scheduler');
  const { REGION_NAMES } = require('./config');

  function tgLog(msg) {
    logger.log(msg);
    const chatId = storage.get('telegram_chat_id') || process.env.TELEGRAM_CHAT_ID || '';
    if (chatId) {
      bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' }).catch(() => {});
    }
  }

  function formatResults(results) {
    if (!results || results.length === 0) return 'Chưa có dữ liệu.';
    return results.map(r => {
      const p = r.prizes || {};
      const icon = r.done ? '✅' : '🔄';
      const lines = [
        `${icon} <b>${r.province}</b>`,
        p.prize_db ? `🎯 ĐB: <code>${p.prize_db}</code>` : '🎯 ĐB: --',
        p.prize_1  ? `  G1: ${p.prize_1}` : '',
        p.prize_2  ? `  G2: ${p.prize_2}` : '',
        p.prize_7  ? `  G7: ${p.prize_7}` : '',
        p.prize_8  ? `  G8: ${p.prize_8}` : '',
      ].filter(Boolean);
      return lines.join('\n');
    }).join('\n\n');
  }

  bot.command('start', ctx => ctx.reply(
    '🎰 <b>KQXS Live Bot</b>\n\n' +
    '📊 <b>Crawl & Xổ số:</b>\n' +
    '/chay mb|mn|mt|all — Poll KQXS\n' +
    '/dung [mb|mn|mt] — Dừng poll\n' +
    '/xem mb|mn|mt — Xem KQ\n' +
    '/status — Trạng thái bot\n' +
    '/lichxo — Lịch xổ hôm nay\n\n' +
    '✍️ <b>SEO Content Writer:</b>\n' +
    '/link [url] — Bắt đầu viết bài SEO multi-site\n' +
    '/postall — Chọn tất cả sites\n' +
    '/danhmuc [số] — Chọn danh mục\n' +
    '/upbai — Đăng bài lên tất cả sites\n' +
    '/cancelbai — Hủy phiên làm việc\n\n' +
    '🤖 <b>AI Model:</b>\n' +
    '/model — Xem danh sách models\n' +
    '/setmodel [số] — Đổi model AI',
    { parse_mode: 'HTML' }
  ));

  // ── /model — Xem danh sách model AI ─────────────────────────────────────
  bot.command('model', ctx => {
    const { AVAILABLE_MODELS } = require('./seo-rewriter');
    const cfg     = storage.load();
    const current = cfg.groq_default_model || 'llama-3.3-70b-versatile';
    const apiBase = cfg.groq_api_base || 'https://api.groq.com/openai/v1';

    const list = AVAILABLE_MODELS.map((m, i) =>
      `${i + 1}. ${m.label} ${m.id === current ? '✅ <b>(đang dùng)</b>' : ''}\n` +
      `   <code>${m.id}</code>  <i>[${m.note}]</i>`
    ).join('\n\n');

    ctx.reply(
      `🤖 <b>Danh sách Model AI</b>\n\n${list}\n\n` +
      `🌐 API Base: <code>${apiBase}</code>\n\n` +
      `👉 Đổi model: <code>/setmodel [số]</code>\n` +
      `Ví dụ: <code>/setmodel 2</code>\n\n` +
      `💡 Tip: model Groq dùng API Base mặc định.\n` +
      `Với OpenRouter, đổi API Base trong Dashboard.`,
      { parse_mode: 'HTML' }
    );
  });

  // ── /setmodel — Chọn model AI ────────────────────────────────────────────
  bot.command('setmodel', ctx => {
    const { AVAILABLE_MODELS } = require('./seo-rewriter');
    const idx = parseInt((ctx.message.text.split(' ')[1] || '').trim(), 10) - 1;

    if (isNaN(idx) || idx < 0 || idx >= AVAILABLE_MODELS.length) {
      return ctx.reply(
        `❌ Dùng: <code>/setmodel [1-${AVAILABLE_MODELS.length}]</code>\n\n` +
        `Dùng /model để xem danh sách.`,
        { parse_mode: 'HTML' }
      );
    }

    const m = AVAILABLE_MODELS[idx];
    storage.save({ groq_default_model: m.id });

    ctx.reply(
      `✅ <b>Đã đổi model thành công!</b>\n\n` +
      `${m.label}\n<code>${m.id}</code>\n<i>${m.note}</i>\n\n` +
      `Lần tới dùng /link sẽ tự động dùng model này.`,
      { parse_mode: 'HTML' }
    );
    logger.log(`[setmodel] Đã đổi model → ${m.id}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ✍️  MULTI-STEP SEO CONTENT FLOW
  // ─────────────────────────────────────────────────────────────────────────
  const sessionStore     = require('./session-store');
  const { fetchCategories, fetchImageBase64, extractImages,
          slugify, extractTitle, extractExcerpt,
          publishToSite, getArticlePrefix } = require('./content-publisher');
  const { fetchPageContent, rewriteArticleSEO, AVAILABLE_MODELS } = require('./seo-rewriter');

  // Helper: get bot's public URL for preview links
  function botPublicUrl() {
    const raw = process.env.BOT_PUBLIC_URL
             || (process.env.RAILWAY_PUBLIC_DOMAIN
                  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
                  : null);
    return (raw || '').replace(/\/$/, '');
  }

  // Helper: send / edit progress message
  async function sendProgress(ctx, msg, opts = {}) {
    return ctx.reply(msg, { parse_mode: 'HTML', ...opts });
  }
  async function editProgress(ctx, msgId, text) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, msgId, undefined, text, { parse_mode: 'HTML' });
    } catch (_) {}
  }

  // ── Show site selection after URL is fetched ──────────────────────────────
  async function showSiteSelection(ctx, session) {
    const siteList = session.allSites
      .map((s, i) => `${i + 1}. 🌐 <code>${s.domain.replace(/^https?:\/\//, '')}</code>`)
      .join('\n');

    return ctx.reply(
      `✅ <b>Đã tải bài viết!</b>\n` +
      `📄 <i>${(session.pageData.title || session.url).slice(0, 80)}</i>\n` +
      `🖼️ Tìm thấy ${session.pageData.images?.length || 0} ảnh\n\n` +
      `<b>📋 Chọn website cần đăng bài:</b>\n${siteList}\n\n` +
      `💬 Nhập số (ví dụ: <code>1</code> hoặc <code>1 2</code>)\n` +
      `📤 Đăng tất cả: /postall\n` +
      `❌ Hủy: /cancelbai`,
      { parse_mode: 'HTML' }
    );
  }

  // ── Show category selection for current pending site ─────────────────────
  async function showCategorySelection(ctx, session) {
    const siteIdx = session.pendingCategoryFor;
    const site    = session.allSites[session.selectedSiteIndices[siteIdx]];
    const done    = siteIdx + 1;
    const total   = session.selectedSiteIndices.length;

    let cats;
    try { cats = await fetchCategories(site); }
    catch (_) { cats = require('./content-publisher').STATIC_CATEGORIES; }

    sessionStore.updateSession(ctx.from.id, {
      currentCategories: cats,
      state: 'AWAITING_CATEGORY',
    });

    const catList = cats.map((c, i) => `${i + 1}. <b>${c.name}</b>  <code>/danhmuc ${i + 1}</code>`).join('\n');
    const domain  = site.domain.replace(/^https?:\/\//, '');

    return ctx.reply(
      `📂 <b>[${done}/${total}] Chọn danh mục cho: ${domain}</b>\n\n` +
      `${catList}\n\n` +
      `Gõ số hoặc lệnh trên (ví dụ: <code>/danhmuc 2</code>)`,
      { parse_mode: 'HTML' }
    );
  }

  // ── Generate content + image for all selected sites ───────────────────────
  async function generateAllArticles(ctx, session) {
    sessionStore.updateSession(ctx.from.id, { state: 'GENERATING' });
    const cfg      = storage.load();
    const model    = cfg.groq_default_model || 'llama-3.3-70b-versatile';
    const total    = session.selectedSiteIndices.length;

    const progressMsg = await sendProgress(ctx,
      `⏳ <b>Đang tạo ${total} bài viết...</b>\nModel: <code>${model}</code>\n0/${total} hoàn thành`
    );

    // Lấy ảnh thumbnail từ bài gốc
    let image = null;
    const imgUrls = session.pageData.images || [];
    for (const imgUrl of imgUrls.slice(0, 3)) {
      image = await fetchImageBase64(imgUrl);
      if (image) break;
    }

    const articles = [];
    const previewId = `prev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    for (let i = 0; i < session.selectedSiteIndices.length; i++) {
      const siteIdx  = session.selectedSiteIndices[i];
      const site     = session.allSites[siteIdx];
      const catId    = session.selectedCategories[siteIdx];
      const category = session.currentCatsPerSite?.[siteIdx]?.find(c => c.id === catId)
                    || { id: catId, name: catId };

      await editProgress(ctx, progressMsg.message_id,
        `⏳ <b>Đang tạo ${total} bài viết...</b>\n` +
        `Model: <code>${model}</code>\n` +
        `${i}/${total} hoàn thành — Đang viết bài ${i + 1} cho <i>${site.domain.replace(/^https?:\/\//, '')}</i>...`
      );

      try {
        const result  = await rewriteArticleSEO(session.pageData, model);
        const h1Title = extractTitle(result.html) || result.seo_title || session.pageData.title || 'Bài viết';
        const excerpt = result.meta_description || extractExcerpt(result.html) || session.pageData.description || '';
        const slug    = slugify(h1Title) || `bai-viet-${Date.now()}`;

        articles.push({
          siteIdx,
          site,
          category,
          categoryId       : catId,
          html             : result.html,
          title            : h1Title,
          seoTitle         : result.seo_title         || h1Title,
          metaDescription  : result.meta_description  || excerpt,
          focusKeyword     : result.focus_keyword      || '',
          keywords         : result.keywords           || '',
          excerpt,
          slug,
          image,
          // Tất cả URLs ảnh từ trang nguồn (img[0] là thumbnail, img[1..] inject vào H2)
          pageImages       : session.pageData.images   || [],
          sourceUrl        : session.url,
          model            : result.model,
          keyName          : result.keyName,
          published        : false,
          publishResult    : null,
        });
      } catch (e) {
        articles.push({ siteIdx, site, category, error: e.message });
      }
    }

    // Lưu vào session
    sessionStore.updateSession(ctx.from.id, {
      state    : 'PREVIEW_READY',
      articles,
      previewId,
      image,
    });

    // Build preview links
    const pub  = botPublicUrl();
    const lines = articles.map((a, idx) => {
      const dom = a.site?.domain.replace(/^https?:\/\//, '') || 'site';
      if (a.error) return `❌ Site ${a.siteIdx + 1} (${dom}): ${a.error}`;
      const previewUrl = pub ? `${pub}/preview/${previewId}/${idx}` : '(preview không khả dụng — thiếu BOT_PUBLIC_URL)';
      return `${idx + 1}. 🌐 <b>${dom}</b>\n` +
             `   📂 ${a.category?.name || a.category?.id}\n` +
             `   🔗 <a href="${previewUrl}">Xem trước bài viết</a>`;
    }).join('\n\n');

    await editProgress(ctx, progressMsg.message_id,
      `✅ <b>Đã tạo xong ${articles.filter(a => !a.error).length}/${total} bài!</b>\n\n` +
      `${lines}\n\n` +
      `👉 Xem trước, nếu ổn thì gõ: /upbai\n❌ Hủy: /cancelbai`
    );
  }

  // ── /link ─────────────────────────────────────────────────────────────────
  bot.command('link', async ctx => {
    const url = ctx.message.text.trim().split(/\s+/)[1];
    if (!url?.startsWith('http')) {
      return ctx.reply(
        '❌ <b>Cú pháp:</b> <code>/link https://example.com/bai-viet</code>\n\n' +
        'Bot sẽ:\n1. Tải nội dung bài\n2. Hỏi chọn site\n3. Hỏi danh mục\n4. Viết bài SEO 1500 từ\n5. Cho xem trước\n6. /upbai để đăng',
        { parse_mode: 'HTML' }
      );
    }

    const cfg   = storage.load();
    const sites = cfg.sites || [];
    if (sites.length === 0) {
      return ctx.reply('❌ Chưa có site nào! Thêm site trong Dashboard trước.');
    }

    sessionStore.clearSession(ctx.from.id);
    const prog = await sendProgress(ctx, '⏳ Đang tải nội dung bài viết...');

    try {
      const pageData = await fetchPageContent(url);
      if (!pageData.text || pageData.text.length < 80) {
        return editProgress(ctx, prog.message_id, '❌ Không trích được nội dung từ URL này. Trang cần JS hoặc đã bị chặn bot.');
      }

      sessionStore.setSession(ctx.from.id, {
        state              : 'AWAITING_SITES',
        url,
        pageData,
        allSites           : sites,
        selectedSiteIndices: [],
        selectedCategories : {},
        currentCatsPerSite : {},
        pendingCategoryFor : 0,
        articles           : [],
        previewId          : null,
        image              : null,
      });

      await ctx.telegram.deleteMessage(ctx.chat.id, prog.message_id).catch(() => {});
      await showSiteSelection(ctx, sessionStore.getSession(ctx.from.id));

    } catch (e) {
      await editProgress(ctx, prog.message_id, `❌ Lỗi: ${e.message}`);
      logger.log(`[/link] ${e.message}`);
    }
  });

  // ── /postall — Chọn tất cả sites ─────────────────────────────────────────
  bot.command('postall', async ctx => {
    const session = sessionStore.getSession(ctx.from.id);
    if (!session || session.state !== 'AWAITING_SITES') {
      return ctx.reply('❌ Dùng /link [url] trước để bắt đầu.');
    }
    const allIdx = session.allSites.map((_, i) => i);
    sessionStore.updateSession(ctx.from.id, {
      selectedSiteIndices : allIdx,
      pendingCategoryFor  : 0,
      state               : 'AWAITING_CATEGORY',
    });
    await showCategorySelection(ctx, sessionStore.getSession(ctx.from.id));
  });

  // ── /danhmuc N — Chọn danh mục ───────────────────────────────────────────
  bot.command('danhmuc', async ctx => {
    const session = sessionStore.getSession(ctx.from.id);
    if (!session || session.state !== 'AWAITING_CATEGORY') {
      return ctx.reply('❌ Chưa có phiên làm việc. Dùng /link [url] trước.');
    }
    const n = parseInt(ctx.message.text.split(' ')[1], 10) - 1;
    await handleCategoryChoice(ctx, session, n);
  });

  async function handleCategoryChoice(ctx, session, catIndex) {
    const cats = session.currentCategories || require('./content-publisher').STATIC_CATEGORIES;
    if (isNaN(catIndex) || catIndex < 0 || catIndex >= cats.length) {
      return ctx.reply(`❌ Nhập số từ 1-${cats.length}`);
    }

    const cat     = cats[catIndex];
    const siteIdx = session.selectedSiteIndices[session.pendingCategoryFor];

    // Lưu danh mục cho site này
    const newSelectedCats    = { ...session.selectedCategories, [siteIdx]: cat.id };
    const newCatsPerSite     = { ...session.currentCatsPerSite, [siteIdx]: cats };
    const nextPending        = session.pendingCategoryFor + 1;
    const total              = session.selectedSiteIndices.length;

    sessionStore.updateSession(ctx.from.id, {
      selectedCategories : newSelectedCats,
      currentCatsPerSite : newCatsPerSite,
      pendingCategoryFor : nextPending,
    });

    const updatedSession = sessionStore.getSession(ctx.from.id);

    await ctx.reply(`✅ Đã chọn: <b>${cat.name}</b> cho site ${session.pendingCategoryFor + 1}/${total}`, { parse_mode: 'HTML' });

    if (nextPending < total) {
      // Còn site khác cần chọn danh mục
      await showCategorySelection(ctx, updatedSession);
    } else {
      // Đủ hết → generate content
      await generateAllArticles(ctx, updatedSession);
    }
  }

  // ── /upbai — Đăng tất cả bài lên các site ────────────────────────────────
  bot.command('upbai', async ctx => {
    const session = sessionStore.getSession(ctx.from.id);
    if (!session || session.state !== 'PREVIEW_READY') {
      return ctx.reply('❌ Chưa có bài nào sẵn sàng. Dùng /link [url] để bắt đầu.');
    }

    const articles = session.articles.filter(a => !a.error && !a.published);
    if (articles.length === 0) {
      return ctx.reply('❌ Không có bài nào để đăng hoặc đã đăng hết rồi!');
    }

    sessionStore.updateSession(ctx.from.id, { state: 'PUBLISHING' });
    const prog = await sendProgress(ctx, `📤 <b>Đang đăng ${articles.length} bài...</b>`, {});

    const results = [];
    for (let i = 0; i < articles.length; i++) {
      const a    = articles[i];
      const dom  = a.site.domain.replace(/^https?:\/\//, '');
      await editProgress(ctx, prog.message_id,
        `📤 <b>Đăng bài ${i + 1}/${articles.length}...</b>\n🌐 ${dom}`
      );
      try {
        const res = await publishToSite(a.site, a);
        a.published    = true;
        a.publishResult = res;
        results.push(`✅ <b>${dom}</b>\n   🔗 <a href="${res.url}">${res.url}</a>`);
      } catch (e) {
        results.push(`❌ <b>${dom}</b>: ${e.message}`);
      }
    }

    // Update session
    sessionStore.updateSession(ctx.from.id, { articles: session.articles, state: 'IDLE' });

    await editProgress(ctx, prog.message_id,
      `✅ <b>Hoàn thành đăng bài!</b>\n\n${results.join('\n\n')}\n\n` +
      `Dùng /link [url] để bắt đầu bài mới.`
    );

    logger.log(`[/upbai] Đã đăng ${articles.length} bài cho user ${ctx.from.id}`);
  });

  // ── /cancelbai ────────────────────────────────────────────────────────────
  bot.command('cancelbai', ctx => {
    sessionStore.clearSession(ctx.from.id);
    ctx.reply('🗑️ Đã hủy phiên làm việc hiện tại.\nDùng /link [url] để bắt đầu mới.');
  });

  // ── Text handler: số cho site/category selection ──────────────────────────
  bot.on('text', async ctx => {
    if (ctx.message.text.startsWith('/')) return; // lệnh đã xử lý riêng
    const session = sessionStore.getSession(ctx.from.id);
    if (!session) return;

    const text = ctx.message.text.trim();

    if (session.state === 'AWAITING_SITES') {
      // Parse danh sách số: "1", "1 2", "1,2", "1,3"
      const nums = text.split(/[\s,]+/)
        .map(n => parseInt(n, 10) - 1)
        .filter(n => !isNaN(n) && n >= 0 && n < session.allSites.length);

      if (nums.length === 0) {
        return ctx.reply(
          `❌ Nhập số hợp lệ (ví dụ: <code>1</code> hoặc <code>1 2</code>)\n` +
          `hoặc /postall để chọn tất cả.`,
          { parse_mode: 'HTML' }
        );
      }

      const unique = [...new Set(nums)];
      sessionStore.updateSession(ctx.from.id, {
        selectedSiteIndices: unique,
        pendingCategoryFor : 0,
        state              : 'AWAITING_CATEGORY',
      });
      await showCategorySelection(ctx, sessionStore.getSession(ctx.from.id));

    } else if (session.state === 'AWAITING_CATEGORY') {
      const n = parseInt(text, 10) - 1;
      await handleCategoryChoice(ctx, session, n);
    }
  });

  bot.command('chay', ctx => {
    const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';
    if (arg === 'all') {
      ['mn', 'mt', 'mb'].forEach(r => schedStart(r, tgLog, true));
      return ctx.reply('🚀 Đã bắt đầu poll cả 3 miền!');
    }
    if (!['mb','mn','mt'].includes(arg)) return ctx.reply('❌ Dùng: /chay mb | mn | mt | all');
    schedStart(arg, tgLog, true);
    ctx.reply(`🚀 Bắt đầu poll ${REGION_NAMES[arg]}...`);
  });

  bot.command('dung', ctx => {
    const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';
    if (!arg || arg === 'all') { stopAll(tgLog); return ctx.reply('⏹ Đã dừng tất cả.'); }
    if (!['mb','mn','mt'].includes(arg)) return ctx.reply('❌ Dùng: /dung | /dung mb|mn|mt');
    schedStop(arg, tgLog);
    ctx.reply(`⏹ Đã dừng ${REGION_NAMES[arg]}`);
  });

  bot.command('xem', ctx => {
    const arg = ctx.message.text.split(' ')[1]?.toLowerCase() || '';
    if (!['mb','mn','mt'].includes(arg)) return ctx.reply('❌ Dùng: /xem mb | mn | mt');
    const data = getCurrentData(arg);
    if (!data) return ctx.reply(`ℹ️ Chưa có dữ liệu. Dùng /chay ${arg} trước.`);
    ctx.reply(`📊 <b>KQ ${REGION_NAMES[arg]}</b>\n\n` + formatResults(data), { parse_mode: 'HTML' });
  });

  bot.command('status', ctx => {
    ctx.reply('📊 <b>Trạng thái:</b>\n\n' + getStatus(), { parse_mode: 'HTML' });
  });

  bot.command('lichxo', ctx => {
    ctx.reply(
      '📅 <b>Lịch xổ hôm nay</b>\n\n' +
      '🟢 Miền Nam / Miền Trung: 16:00 – 17:30\n' +
      '🔴 Miền Bắc: 18:30 – 19:15',
      { parse_mode: 'HTML' }
    );
  });

  bot.catch(err => logger.log(`[Bot Error] ${err.message}`));

  try {
    await bot.launch();
    logger.log('✅ Telegram Bot đã khởi động');
    botInstance = bot;

    // Bật auto-schedule
    const cfg = storage.load();
    if (cfg.auto_schedule !== false) {
      const { startAutoSchedule } = require('./scheduler');
      startAutoSchedule(tgLog);
    }
  } catch (e) {
    logger.log(`❌ Không thể khởi động bot: ${e.message}`);
    botInstance = null;
  }

  return botInstance;
}

async function restart() {
  if (botInstance) {
    try { botInstance.stop('restart'); } catch (_) {}
    botInstance = null;
    logger.log('[BotManager] Bot cũ đã dừng, đang restart...');
    await new Promise(r => setTimeout(r, 1000));
  }
  await start();
}

function getInstance() { return botInstance; }

module.exports = { start, restart, getInstance };
