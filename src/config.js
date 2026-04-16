/**
 * config.js — Hằng số và cấu hình toàn cục
 */
'use strict';

const BASE_URL = 'https://s2.kqxs.tube/str/ttkq';

// Tất cả server có thể dùng (thứ tự ưu tiên)
const ALL_SERVERS = ['s2', 's7', 's5', 's3'];

// Build URL với server cụ thể
function buildUrls(region) {
  return ALL_SERVERS.map(s =>
    `https://${s}.kqxs.tube/str/ttkq/str_kq${region}/`
  );
}

module.exports = {
  API: {
    mb: buildUrls('mb'),
    mn: buildUrls('mn'),
    mt: buildUrls('mt'),
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

  // Lịch tỉnh theo ngày (0=CN, 1=T2 ... 6=T7)
  PROVINCE_SCHEDULE: {
    mn: {
      1: ['TP. HCM', 'Đồng Tháp', 'Cà Mau'],
      2: ['Bến Tre', 'Vũng Tàu', 'Bạc Liêu'],
      3: ['Đồng Nai', 'Cần Thơ', 'Sóc Trăng'],
      4: ['Tây Ninh', 'An Giang', 'Bình Thuận'],
      5: ['Vĩnh Long', 'Bình Dương', 'Trà Vinh'],
      6: ['TP. HCM', 'Long An', 'Bình Phước', 'Hậu Giang'],
      0: ['Tiền Giang', 'Kiên Giang', 'Đà Lạt'],
    },
    mt: {
      1: ['Thừa Thiên Huế', 'Phú Yên'],
      2: ['Đắk Lắk', 'Quảng Nam'],
      3: ['Đà Nẵng', 'Khánh Hòa'],
      4: ['Bình Định', 'Quảng Bình', 'Quảng Trị'],
      5: ['Gia Lai', 'Ninh Thuận'],
      6: ['Đắk Nông', 'Quảng Ngãi', 'Đà Nẵng'],
      0: ['Khánh Hòa', 'Kon Tum'],
    },
    mb: {
      0: ['Hà Nội'], 1: ['Hà Nội'], 2: ['Hà Nội'],
      3: ['Hà Nội'], 4: ['Hà Nội'], 5: ['Hà Nội'], 6: ['Hà Nội'],
    },
  },

  // Lịch Vietlott theo ngày (0=CN, 1=T2 ... 6=T7)
  VIETLOTT_SCHEDULE: {
    mega  : [1, 3, 5],   // T2, T4, T6
    power : [2, 4, 6],   // T3, T5, T7
    max3d : [1, 3, 5],
    max3dpro: [1, 3, 5],
  },

  // Tên game Vietlott
  VIETLOTT_NAMES: {
    mega    : 'Mega 6/45',
    power   : 'Power 6/55',
    max3d   : 'Max 3D',
    max3dpro: 'Max 3D Pro',
  },
};
