/**
 * test-crawler.js — Test nhanh crawler Vietlott
 * Chạy: node test-crawler.js
 */
require('dotenv').config();

const {
  fetchMega, fetchPower, fetchMax3D, fetchMax3DPro, fetchKeno
} = require('./crawler-vietlott');

async function main() {
  const testDate = '2026-04-08';

  console.log('\n========== TEST MEGA 6/45 ==========');
  const mega = await fetchMega(testDate);
  console.log(JSON.stringify(mega, null, 2));

  console.log('\n========== TEST POWER 6/55 ==========');
  const power = await fetchPower('2026-04-07');
  console.log(JSON.stringify(power, null, 2));

  console.log('\n========== TEST MAX 3D ==========');
  const max3d = await fetchMax3D(testDate);
  console.log(JSON.stringify(max3d, null, 2));

  console.log('\n========== TEST MAX 3D PRO ==========');
  const max3dpro = await fetchMax3DPro('2026-04-07');
  console.log(JSON.stringify(max3dpro, null, 2));

  console.log('\n========== TEST KENO ==========');
  const keno = await fetchKeno(testDate);
  console.log('Số kỳ:', keno.length);
  if (keno.length > 0) {
    console.log('Kỳ 1:', JSON.stringify(keno[0]));
    console.log('Kỳ 2:', JSON.stringify(keno[1]));
  }
}

main().catch(console.error);
