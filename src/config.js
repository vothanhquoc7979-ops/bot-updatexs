/**
 * config.js — Hằng số và cấu hình toàn cục
 */
'use strict';

const API_HASH = '612affdcd84288de1cc87429738c4b34';
const BASE_URL = 'https://s2.kqxs.tube/str/ttkq';

module.exports = {
  API: {
    mb: `${BASE_URL}/str_kqmb/${API_HASH}`,
    mn: `${BASE_URL}/str_kqmn/${API_HASH}`,
    mt: `${BASE_URL}/str_kqmt/${API_HASH}`,
  },

  // Lịch xổ (giờ VN, format HH:MM) bắt đầu quét sớm 15 phút trước giờ xổ thực
  SCHEDULE: {
    mn: { start: '16:00', end: '17:00' },
    mt: { start: '17:00', end: '18:00' },
    mb: { start: '18:00', end: '19:00' },
  },

  // Interval poll khi đang trong giờ xổ (ms)
  POLL_INTERVAL_ACTIVE: 15 * 1000, // 15 giây

  // Interval poll ngoài giờ xổ (khi force chạy tay)
  POLL_INTERVAL_IDLE: 60 * 1000, // 1 phút

  // Tên vùng cho hiển thị
  REGION_NAMES: {
    mb: 'Miền Bắc',
    mn: 'Miền Nam',
    mt: 'Miền Trung',
  },

  // Map code tỉnh từ API sang tên đầy đủ
  PROVINCE_MAP: {
    // Miền Nam
    VL: 'Vĩnh Long',   BD: 'Bình Dương',  TV: 'Trà Vinh',
    CT: 'Cần Thơ',     LA: 'Long An',     HCM: 'TP. HCM',
    DN: 'Đồng Nai',    ST: 'Sóc Trăng',   CM: 'Cà Mau',
    TG: 'Tiền Giang',  AG: 'An Giang',    BL: 'Bạc Liêu',
    VT: 'Vũng Tàu',    BT: 'Bến Tre',     DT: 'Đồng Tháp',
    KG: 'Kiên Giang',  BP: 'Bình Phước',  HG: 'Hậu Giang',
    TN: 'Tây Ninh',    BTH: 'Bình Thuận', DL: 'Đà Lạt',
    // Miền Trung
    DNG: 'Đà Nẵng',    KH: 'Khánh Hòa',   TTH: 'TT. Huế',
    PY: 'Phú Yên',     DLK: 'Đắk Lắk',    QNM: 'Quảng Nam',
    BDI: 'Bình Định',  QB: 'Quảng Bình',   QT: 'Quảng Trị',
    GL: 'Gia Lai',     NT: 'Ninh Thuận',   DNO: 'Đắk Nông',
    QNG: 'Quảng Ngãi', KT: 'Kon Tum',
  },
};
