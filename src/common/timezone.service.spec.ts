import { TimezoneService } from '../common/timezone.service';
import { BadRequestException } from '@nestjs/common';

describe('TimezoneService', () => {
  let service: TimezoneService;

  beforeEach(() => {
    service = new TimezoneService();
  });

  describe('validateTimezone', () => {
    it('should return true for valid IANA timezones', () => {
      expect(service.validateTimezone('Asia/Kolkata')).toBe(true);
      expect(service.validateTimezone('America/New_York')).toBe(true);
      expect(service.validateTimezone('Europe/London')).toBe(true);
      expect(service.validateTimezone('Asia/Tokyo')).toBe(true);
      expect(service.validateTimezone('UTC')).toBe(true);
    });

    it('should return false for invalid timezones', () => {
      expect(service.validateTimezone('Invalid/Timezone')).toBe(false);
      expect(service.validateTimezone('Foo/Bar')).toBe(false);
      expect(service.validateTimezone('')).toBe(false);
      expect(service.validateTimezone('NotATimezone')).toBe(false);
    });
  });

  describe('convertToUTC', () => {
    it('should convert IST (Asia/Kolkata, UTC+5:30) to UTC correctly', () => {
      const result = service.convertToUTC('2026-06-06T18:00:00', 'Asia/Kolkata');
      // 18:00 IST = 12:30 UTC
      expect(result.toISOString()).toBe('2026-06-06T12:30:00.000Z');
    });

    it('should convert EST (America/New_York, UTC-4 in summer) to UTC correctly', () => {
      const result = service.convertToUTC('2026-06-06T18:00:00', 'America/New_York');
      // 18:00 EDT (summer) = 22:00 UTC
      expect(result.toISOString()).toBe('2026-06-06T22:00:00.000Z');
    });

    it('should convert JST (Asia/Tokyo, UTC+9) to UTC correctly', () => {
      const result = service.convertToUTC('2026-06-06T18:00:00', 'Asia/Tokyo');
      // 18:00 JST = 09:00 UTC
      expect(result.toISOString()).toBe('2026-06-06T09:00:00.000Z');
    });

    it('should handle midnight crossing (UTC time is next day)', () => {
      const result = service.convertToUTC('2026-06-06T23:00:00', 'America/New_York');
      // 23:00 EDT = 03:00 UTC next day
      expect(result.toISOString()).toBe('2026-06-07T03:00:00.000Z');
    });

    it('should throw for invalid datetime', () => {
      expect(() => {
        service.convertToUTC('not-a-date', 'Asia/Kolkata');
      }).toThrow(BadRequestException);
    });

    it('should throw for invalid timezone', () => {
      expect(() => {
        service.convertToUTC('2026-06-06T18:00:00', 'Invalid/TZ');
      }).toThrow(BadRequestException);
    });
  });

  describe('convertFromUTC', () => {
    it('should convert UTC to IST correctly', () => {
      const utcDate = new Date('2026-06-06T12:30:00.000Z');
      const result = service.convertFromUTC(utcDate, 'Asia/Kolkata');
      expect(result).toContain('2026-06-06T18:00:00.000');
      expect(result).toContain('+05:30');
    });

    it('should convert UTC to JST correctly', () => {
      const utcDate = new Date('2026-06-06T12:30:00.000Z');
      const result = service.convertFromUTC(utcDate, 'Asia/Tokyo');
      expect(result).toContain('2026-06-06T21:30:00.000');
      expect(result).toContain('+09:00');
    });

    it('should handle date boundary crossing', () => {
      const utcDate = new Date('2026-06-06T22:00:00.000Z');
      const result = service.convertFromUTC(utcDate, 'Asia/Tokyo');
      // 22:00 UTC = 07:00 JST next day
      expect(result).toContain('2026-06-07T07:00:00.000');
    });
  });

  describe('Timezone round-trip', () => {
    it('should preserve time through convert-to-UTC and back', () => {
      const originalLocal = '2026-06-06T18:00:00';
      const timezone = 'Asia/Kolkata';

      // Convert to UTC
      const utcDate = service.convertToUTC(originalLocal, timezone);
      // Convert back to local
      const backToLocal = service.convertFromUTC(utcDate, timezone);

      expect(backToLocal).toContain('2026-06-06T18:00:00.000');
    });

    it('should correctly show the same UTC time in different timezones', () => {
      // A teacher in New York creates a session at 6 PM ET
      const utcTime = service.convertToUTC('2026-06-06T18:00:00', 'America/New_York');
      
      // A parent in Tokyo should see it as 7 AM next day
      const tokyoTime = service.convertFromUTC(utcTime, 'Asia/Tokyo');
      expect(tokyoTime).toContain('2026-06-07T07:00:00.000');

      // A parent in London should see it as 11 PM same day (BST in summer)
      const londonTime = service.convertFromUTC(utcTime, 'Europe/London');
      expect(londonTime).toContain('2026-06-06T23:00:00.000');
    });
  });
});
