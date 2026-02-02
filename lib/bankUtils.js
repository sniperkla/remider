
export const BANK_DATA = {
  kbank: { code: 'kbank', name: 'Kasikorn', color: '#138f2d', keywords: ['kbank', 'กสิกร'], logo: '/banklogos/กสิกร.png' },
  scb: { code: 'scb', name: 'SCB', color: '#4e2583', keywords: ['scb', 'ไทยพาณิชย์', 'แม่มณี'], logo: '/banklogos/ไทยพาณิชย์ SCB.png' },
  ktb: { code: 'ktb', name: 'Krungthai', color: '#1ba5e1', keywords: ['ktb', 'กรุงไทย', 'เป๋าตัง'], logo: '/banklogos/กรุงไทย.png' },
  bbl: { code: 'bbl', name: 'Bangkok Bank', color: '#1e4598', keywords: ['bbl', 'กรุงเทพ', 'bangkok bank'], logo: '/banklogos/กรุงเทพ.png' },
  ttb: { code: 'ttb', name: 'TTB', color: '#0056b3', keywords: ['ttb', 'tmb', 'ทหารไทย', 'ธนชาต'], logo: '/banklogos/ttb.png' },
  gsb: { code: 'gsb', name: 'GSB', color: '#eb198d', keywords: ['gsb', 'ออมสิน'], logo: '/banklogos/ออมสิน.png' },
  krungsri: { code: 'krungsri', name: 'Krungsri', color: '#fcd901', keywords: ['kma', 'krungsri', 'กรุงศรี'], logo: '/banklogos/กรุงศรี.png' },
  cimb: { code: 'cimb', name: 'CIMB', color: '#7e2f36', keywords: ['cimb', 'ซีไอเอ็มบี'], logo: '/banklogos/Cimb.png' },
  uob: { code: 'uob', name: 'UOB', color: '#0b3979', keywords: ['uob', 'ยูโอบี'], logo: '/banklogos/UOB.png' },
  ghb: { code: 'ghb', name: 'GH Bank', color: '#f57d23', keywords: ['ghb', 'อาคารสงเคราะห์'], logo: '/banklogos/ธอส.png' },
  truemoney: { code: 'truemoney', name: 'TrueMoney', color: '#ff930f', keywords: ['true', 'wallet', 'ทรู'], logo: '/banklogos/ทรูวอเลต.png' },
  tisco: { code: 'tisco', name: 'TISCO', color: '#0f4c81', keywords: ['tisco', 'ทิสโก้'], logo: '/banklogos/ทิสโก้.png' },
  kkp: { code: 'kkp', name: 'Kiatnakin', color: '#694d86', keywords: ['kkp', 'เกียรตินาคิน'], logo: '/banklogos/เกียรตินาคิน.png' },
  lh: { code: 'lh', name: 'LH Bank', color: '#6f7a87', keywords: ['lh', 'แลนด์'], logo: '/banklogos/แลนด์แลนด์เฮ้าท์ .png' },
  baac: { code: 'baac', name: 'BAAC', color: '#4b9b3e', keywords: ['baac', 'ธกส'], logo: '/banklogos/ธนาคาร ธกส.png' },
  icbc: { code: 'icbc', name: 'ICBC', color: '#c4161c', keywords: ['icbc'], logo: '/banklogos/ICBC.png' },
};

export const detectBank = (text) => {
  if (!text) return { code: 'other', name: 'Bank', color: '#64748b' }; // Default
  const lower = text.toLowerCase();
  for (const key in BANK_DATA) {
    if (BANK_DATA[key].keywords.some(kw => lower.includes(kw))) {
      return BANK_DATA[key];
    }
  }
  return { code: 'other', name: text.length > 20 ? text.substring(0, 20) + '...' : text, color: '#64748b' };
};
