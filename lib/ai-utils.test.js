import { describe, it, expect } from 'vitest';
import { parseThaiNumber, detectCategory, extractDataFromOCRText } from './ai-utils';

describe('AI Utilities', () => {
  describe('parseThaiNumber', () => {
    it('should parse standard numbers', () => {
      expect(parseThaiNumber('1,500')).toBe(1500);
      expect(parseThaiNumber('250.50')).toBe(250.5);
    });

    it('should parse Thai word numbers', () => {
      expect(parseThaiNumber('หนึ่งพันสองร้อย')).toBe(1200);
      expect(parseThaiNumber('ห้าแสน')).toBe(500000);
      expect(parseThaiNumber('แปดสิบเก้า')).toBe(89);
    });

    it('should handle mixed numbers and Thai words', () => {
      expect(parseThaiNumber('5 พัน')).toBe(5000);
      expect(parseThaiNumber('1.5 แสน')).toBe(150000);
    });

    it('should handle special cases like "สิบเอ็ด"', () => {
      expect(parseThaiNumber('สิบเอ็ด')).toBe(11);
      expect(parseThaiNumber('ยี่สิบเอ็ด')).toBe(21);
    });
  });

  describe('detectCategory', () => {
    it('should detect food category', () => {
      expect(detectCategory('ไปกินข้าวมันไก่มา')).toBe('อาหาร');
      expect(detectCategory('coffee at starbucks')).toBe('อาหาร');
    });

    it('should detect travel category', () => {
      expect(detectCategory('เติมน้ำมันรถ')).toBe('เดินทาง');
      expect(detectCategory('นั่ง grab ไปทำงาน')).toBe('เดินทาง');
    });

    it('should detect income category', () => {
      expect(detectCategory('เงินเดือนออกแล้ว')).toBe('รายได้');
      expect(detectCategory('ได้โบนัส')).toBe('รายได้');
    });

    it('should fallback to "อื่นๆ"', () => {
      expect(detectCategory('อะไรบางอย่าง')).toBe('อื่นๆ');
    });
  });

  describe('extractDataFromOCRText', () => {
    it('should extract amount from bank slip text', () => {
      const text = 'โอนเงินสำเร็จ\nจำนวนเงิน\n1,250.00\nบาท';
      const result = extractDataFromOCRText(text);
      expect(result.found).toBe(true);
      expect(result.amount).toBe(1250);
    });

    it('should handle signed numbers (+150.00)', () => {
      const text = 'เงินเข้า\n+150.00';
      const result = extractDataFromOCRText(text);
      expect(result.found).toBe(true);
      expect(result.amount).toBe(150);
    });

    it('should ignore balance information', () => {
      const text = 'โอนเงิน 500.00\nยอดเงินคงเหลือ 10,000.00';
      const result = extractDataFromOCRText(text);
      expect(result.found).toBe(true);
      expect(result.amount).toBe(500);
    });
  });
});
