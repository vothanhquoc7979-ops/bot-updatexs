const crypto = require('crypto');
async function f() {
  const ts = Date.now().toString();
  const method = 'GET';
  const path = '/api/public/vietlott/keno?page=1&limit=50';
  const stringToSign = `${ts}:${method}:${path}`;
  const sig = crypto.createHmac('sha256', 'xs365-api-sign-key-2026').update(stringToSign).digest('hex');
  const url = 'https://api.xs365.vn' + path;
  
  try {
    const res = await fetch(url, {
      headers: {
        'X-Ts': ts,
        'X-Sig': sig,
        'User-Agent': 'Mozilla/5.0'
      }
    });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text.substring(0, 100));
  } catch(e) {
    console.log("Fetch Error", e.message);
  }
}
f();
