/**
 * check-groq-usage.js
 * Kiểm tra Groq API key: rate limit, remaining tokens, và usage của request hiện tại.
 * 
 * Groq KHÔNG có endpoint riêng để xem tổng token đã dùng trong ngày.
 * Cách tốt nhất: đọc header x-ratelimit-* từ mỗi response để biết:
 *   - Đã dùng bao nhiêu token/phút
 *   - Còn lại bao nhiêu token/phút
 *   - Còn bao nhiêu request/ngày
 * 
 * Chạy: node check-groq-usage.js [API_KEY]
 */

const API_KEY = process.argv[2] || process.env.GROQ_API_KEY || '';
const MODEL   = 'llama-3.1-8b-instant'; // Model nhẹ nhất để tiết kiệm token khi test

async function checkGroqKey(apiKey) {
  console.log('═══════════════════════════════════════════');
  console.log('         GROQ API KEY CHECKER');
  console.log('═══════════════════════════════════════════');
  console.log(`🔑 Key: ${apiKey.slice(0, 10)}...${apiKey.slice(-6)}`);
  console.log(`🤖 Model test: ${MODEL}`);
  console.log('───────────────────────────────────────────');

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5, // Cực nhỏ để tốn ít token nhất
      }),
    });

    // ── Parse headers ──────────────────────────────────────────────────────
    const headers = {
      // Rate limit tokens (per minute)
      limitTokens      : res.headers.get('x-ratelimit-limit-tokens'),
      remainingTokens  : res.headers.get('x-ratelimit-remaining-tokens'),
      resetTokens      : res.headers.get('x-ratelimit-reset-tokens'),

      // Rate limit requests (per day)
      limitRequests    : res.headers.get('x-ratelimit-limit-requests'),
      remainingRequests: res.headers.get('x-ratelimit-remaining-requests'),
      resetRequests    : res.headers.get('x-ratelimit-reset-requests'),

      // Retry-after (chỉ có khi bị 429)
      retryAfter       : res.headers.get('retry-after'),
    };

    const statusIcon = res.ok ? '✅' : (res.status === 429 ? '⚠️' : '❌');
    console.log(`${statusIcon} HTTP Status: ${res.status} ${res.statusText}`);
    console.log('');

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const errMsg  = errBody?.error?.message || JSON.stringify(errBody);
      console.log(`❌ Lỗi API: ${errMsg}`);

      if (res.status === 429) {
        console.log(`⏳ Retry-After: ${headers.retryAfter || 'N/A'} giây`);
      } else if (res.status === 401) {
        console.log('🔒 API Key không hợp lệ hoặc đã bị thu hồi!');
      }
    } else {
      const data  = await res.json();
      const usage = data.usage || {};

      // Request này dùng bao nhiêu token
      console.log('📊 TOKEN DÙNG TRONG REQUEST NÀY:');
      console.log(`   Prompt tokens    : ${usage.prompt_tokens    ?? 'N/A'}`);
      console.log(`   Completion tokens: ${usage.completion_tokens ?? 'N/A'}`);
      console.log(`   Total tokens     : ${usage.total_tokens      ?? 'N/A'}`);
      console.log('');
    }

    // ── Rate limit headers ─────────────────────────────────────────────────
    console.log('📈 RATE LIMIT (TOKEN PER MINUTE - TPM):');
    if (headers.limitTokens) {
      const used = parseInt(headers.limitTokens) - parseInt(headers.remainingTokens);
      const pct  = ((used / parseInt(headers.limitTokens)) * 100).toFixed(1);
      console.log(`   Giới hạn/phút   : ${Number(headers.limitTokens).toLocaleString()} tokens`);
      console.log(`   Đã dùng/phút    : ${used.toLocaleString()} tokens (${pct}%)`);
      console.log(`   Còn lại/phút    : ${Number(headers.remainingTokens).toLocaleString()} tokens`);
      console.log(`   Reset sau       : ${headers.resetTokens || 'N/A'}`);
    } else {
      console.log('   (Không có thông tin rate limit token)');
    }

    console.log('');
    console.log('📋 RATE LIMIT (REQUEST PER DAY - RPD):');
    if (headers.limitRequests) {
      const usedReq = parseInt(headers.limitRequests) - parseInt(headers.remainingRequests);
      const pctReq  = ((usedReq / parseInt(headers.limitRequests)) * 100).toFixed(1);
      console.log(`   Giới hạn/ngày   : ${Number(headers.limitRequests).toLocaleString()} requests`);
      console.log(`   Đã dùng/ngày    : ${usedReq.toLocaleString()} requests (${pctReq}%)`);
      console.log(`   Còn lại/ngày    : ${Number(headers.remainingRequests).toLocaleString()} requests`);
      console.log(`   Reset sau       : ${headers.resetRequests || 'N/A'}`);
    } else {
      console.log('   (Không có thông tin rate limit request)');
    }

    console.log('');
    console.log('💡 LƯU Ý:');
    console.log('   - "Đã dùng/phút" = được reset mỗi 1 phút (KHÔNG phải tổng ngày)');
    console.log('   - Groq không cung cấp API xem tổng token đã dùng cả ngày');
    console.log('   - Để xem tổng: vào https://console.groq.com/usage');
    console.log('   - Hoặc tự log usage.total_tokens từ mỗi request vào DB');

  } catch (e) {
    console.log(`❌ Lỗi kết nối: ${e.message}`);
  }

  console.log('═══════════════════════════════════════════');
}

checkGroqKey(API_KEY);
