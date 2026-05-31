import { Injectable, BadRequestException } from '@nestjs/common';
import { DateTime, IANAZone } from 'luxon';

@Injectable()
export class TimezoneService {
  /**
   * Validates that a timezone string is a valid IANA timezone.
   * @example validateTimezone('Asia/Kolkata') → true
   * @example validateTimezone('Invalid/TZ') → false
   */
  validateTimezone(timezone: string): boolean {
    return IANAZone.isValidZone(timezone);
  }

  /**
   * Ensures a timezone is valid, throws BadRequestException if not.
   */
  assertValidTimezone(timezone: string): void {
    if (!this.validateTimezone(timezone)) {
      throw new BadRequestException(
        `Invalid IANA timezone: "${timezone}". Examples: "America/New_York", "Asia/Kolkata", "Europe/London"`,
      );
    }
  }

  /**
   * Converts a local datetime string (without offset) to a UTC Date object.
   * The local time is interpreted in the given IANA timezone.
   *
   * @param localTimeISO - ISO 8601 string WITHOUT timezone offset, e.g. "2026-06-06T18:00:00"
   * @param timezone - IANA timezone, e.g. "America/New_York"
   * @returns Date object in UTC
   *
   * @example
   * convertToUTC("2026-06-06T18:00:00", "Asia/Kolkata")
   * // → 2026-06-06T12:30:00.000Z (IST is UTC+5:30)
   */
  convertToUTC(localTimeISO: string, timezone: string): Date {
    this.assertValidTimezone(timezone);

    const dt = DateTime.fromISO(localTimeISO, { zone: timezone });

    if (!dt.isValid) {
      throw new BadRequestException(
        `Invalid datetime: "${localTimeISO}". Expected ISO 8601 format, e.g. "2026-06-06T18:00:00"`,
      );
    }

    return dt.toUTC().toJSDate();
  }

  /**
   * Converts a UTC Date to a local ISO string in the given timezone.
   *
   * @param utcDate - Date object (assumed UTC)
   * @param timezone - IANA timezone to convert to
   * @returns ISO 8601 string in the target timezone WITH offset
   *
   * @example
   * convertFromUTC(new Date("2026-06-06T12:30:00Z"), "Asia/Kolkata")
   * // → "2026-06-06T18:00:00.000+05:30"
   */
  convertFromUTC(utcDate: Date, timezone: string): string {
    this.assertValidTimezone(timezone);

    return DateTime.fromJSDate(utcDate, { zone: 'utc' })
      .setZone(timezone)
      .toISO()!;
  }

  /**
   * Formats a UTC Date to a human-readable string in the given timezone.
   *
   * @example
   * formatInTimezone(new Date("2026-06-06T12:30:00Z"), "Asia/Kolkata")
   * // → "Jun 6, 2026, 6:00 PM IST"
   */
  formatInTimezone(utcDate: Date, timezone: string): string {
    this.assertValidTimezone(timezone);

    return DateTime.fromJSDate(utcDate, { zone: 'utc' })
      .setZone(timezone)
      .toLocaleString(DateTime.DATETIME_MED_WITH_WEEKDAY);
  }
}
