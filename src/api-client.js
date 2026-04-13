'use strict';

const cache = new Map();

async function fetchJsonApi(dateStr) {
  if (cache.has(dateStr)) return cache.get(dateStr);
  const [y, m, d] = dateStr.split('-');
  const url = `https://raw.githubusercontent.com/vothanhquoc7979-ops/kho-dulieu-xoso/main/data/${y}/${m}/${d}.json`;
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
       cache.set(dateStr, null);
       return null;
    }
    const json = await res.json();
    cache.set(dateStr, json);
    return json;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

module.exports = { fetchJsonApi };
