/**
 * Unit tests for the time conflict detection algorithm.
 *
 * This is the most critical business logic in the system:
 * Two sessions overlap if: A.start < B.end AND A.end > B.start
 *
 * These tests verify that the algorithm correctly handles:
 * - Clear overlaps
 * - No overlaps
 * - Edge cases (touching boundaries, containment, same time)
 */

interface SessionTime {
  startTime: Date;
  endTime: Date;
}

/**
 * Checks if any session in groupA overlaps with any session in groupB.
 * This is the same algorithm used in BookingService.bookOffering().
 */
function findTimeConflict(
  groupA: SessionTime[],
  groupB: SessionTime[],
): { conflicting: boolean; sessionA?: SessionTime; sessionB?: SessionTime } {
  for (const a of groupA) {
    for (const b of groupB) {
      if (a.startTime < b.endTime && a.endTime > b.startTime) {
        return { conflicting: true, sessionA: a, sessionB: b };
      }
    }
  }
  return { conflicting: false };
}

// Helper to create a Date from an ISO string
const d = (iso: string) => new Date(iso);

describe('Time Conflict Detection', () => {
  describe('Basic overlap scenarios', () => {
    it('should detect overlapping sessions', () => {
      // Session A: 5 PM - 6 PM
      // Session B: 5:30 PM - 6:30 PM (overlaps by 30 min)
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
        [{ startTime: d('2026-06-06T17:30:00Z'), endTime: d('2026-06-06T18:30:00Z') }],
      );
      expect(result.conflicting).toBe(true);
    });

    it('should NOT detect conflict for non-overlapping sessions', () => {
      // Session A: 5 PM - 6 PM
      // Session B: 7 PM - 8 PM
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
        [{ startTime: d('2026-06-06T19:00:00Z'), endTime: d('2026-06-06T20:00:00Z') }],
      );
      expect(result.conflicting).toBe(false);
    });

    it('should detect when one session fully contains another', () => {
      // Session A: 4 PM - 8 PM
      // Session B: 5 PM - 6 PM (contained within A)
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T16:00:00Z'), endTime: d('2026-06-06T20:00:00Z') }],
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
      );
      expect(result.conflicting).toBe(true);
    });

    it('should detect identical sessions', () => {
      // Exact same time
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
      );
      expect(result.conflicting).toBe(true);
    });
  });

  describe('Edge cases: touching boundaries', () => {
    it('should NOT detect conflict when sessions are back-to-back (end == start)', () => {
      // Session A: 5 PM - 6 PM
      // Session B: 6 PM - 7 PM (starts exactly when A ends)
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
        [{ startTime: d('2026-06-06T18:00:00Z'), endTime: d('2026-06-06T19:00:00Z') }],
      );
      expect(result.conflicting).toBe(false);
    });

    it('should detect conflict when there is even 1 second of overlap', () => {
      // Session A ends at 18:00:01, Session B starts at 18:00:00
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:01Z') }],
        [{ startTime: d('2026-06-06T18:00:00Z'), endTime: d('2026-06-06T19:00:00Z') }],
      );
      expect(result.conflicting).toBe(true);
    });
  });

  describe('Multi-session scenarios (realistic)', () => {
    it('should detect conflict when only one out of many sessions overlaps', () => {
      // Booking A: 3 sessions on different weeks
      const existingBookedSessions: SessionTime[] = [
        { startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') },
        { startTime: d('2026-06-13T17:00:00Z'), endTime: d('2026-06-13T18:00:00Z') },
        { startTime: d('2026-06-20T17:00:00Z'), endTime: d('2026-06-20T18:00:00Z') },
      ];

      // New offering: only the June 13 session overlaps
      const newOfferingSessions: SessionTime[] = [
        { startTime: d('2026-06-07T19:00:00Z'), endTime: d('2026-06-07T20:00:00Z') }, // no conflict
        { startTime: d('2026-06-13T17:30:00Z'), endTime: d('2026-06-13T18:30:00Z') }, // CONFLICT!
        { startTime: d('2026-06-21T19:00:00Z'), endTime: d('2026-06-21T20:00:00Z') }, // no conflict
      ];

      const result = findTimeConflict(existingBookedSessions, newOfferingSessions);
      expect(result.conflicting).toBe(true);
    });

    it('should allow booking when no sessions overlap across multiple weeks', () => {
      // Booking A: Saturday 5-6 PM for 3 weeks
      const existingBookedSessions: SessionTime[] = [
        { startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') },
        { startTime: d('2026-06-13T17:00:00Z'), endTime: d('2026-06-13T18:00:00Z') },
        { startTime: d('2026-06-20T17:00:00Z'), endTime: d('2026-06-20T18:00:00Z') },
      ];

      // New offering: Saturday 6-7 PM for 3 weeks (back-to-back, no overlap)
      const newOfferingSessions: SessionTime[] = [
        { startTime: d('2026-06-06T18:00:00Z'), endTime: d('2026-06-06T19:00:00Z') },
        { startTime: d('2026-06-13T18:00:00Z'), endTime: d('2026-06-13T19:00:00Z') },
        { startTime: d('2026-06-20T18:00:00Z'), endTime: d('2026-06-20T19:00:00Z') },
      ];

      const result = findTimeConflict(existingBookedSessions, newOfferingSessions);
      expect(result.conflicting).toBe(false);
    });

    it('should handle the exact scenario from the assignment', () => {
      // Parent books: Minecraft Coding (Saturday Batch)
      // June 7 → 5 PM–6 PM, June 14 → 5 PM–6 PM, June 21 → 5 PM–6 PM
      const minecraftSessions: SessionTime[] = [
        { startTime: d('2026-06-07T17:00:00Z'), endTime: d('2026-06-07T18:00:00Z') },
        { startTime: d('2026-06-14T17:00:00Z'), endTime: d('2026-06-14T18:00:00Z') },
        { startTime: d('2026-06-21T17:00:00Z'), endTime: d('2026-06-21T18:00:00Z') },
      ];

      // Then tries to book: Roblox Game Design
      // June 14 → 5:30 PM–6:30 PM (OVERLAPS with Minecraft June 14)
      const robloxSessions: SessionTime[] = [
        { startTime: d('2026-06-14T17:30:00Z'), endTime: d('2026-06-14T18:30:00Z') },
      ];

      const result = findTimeConflict(minecraftSessions, robloxSessions);
      expect(result.conflicting).toBe(true);
    });
  });

  describe('Cross-day scenarios', () => {
    it('should NOT detect conflict for sessions on different days', () => {
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
        [{ startTime: d('2026-06-07T17:00:00Z'), endTime: d('2026-06-07T18:00:00Z') }],
      );
      expect(result.conflicting).toBe(false);
    });

    it('should detect conflict for sessions spanning midnight', () => {
      // Session A: 11 PM - 1 AM next day
      // Session B: 12:30 AM - 2 AM (overlaps during the night)
      const result = findTimeConflict(
        [{ startTime: d('2026-06-06T23:00:00Z'), endTime: d('2026-06-07T01:00:00Z') }],
        [{ startTime: d('2026-06-07T00:30:00Z'), endTime: d('2026-06-07T02:00:00Z') }],
      );
      expect(result.conflicting).toBe(true);
    });
  });

  describe('Empty sessions', () => {
    it('should NOT detect conflict when one group is empty', () => {
      const result = findTimeConflict(
        [],
        [{ startTime: d('2026-06-06T17:00:00Z'), endTime: d('2026-06-06T18:00:00Z') }],
      );
      expect(result.conflicting).toBe(false);
    });

    it('should NOT detect conflict when both groups are empty', () => {
      const result = findTimeConflict([], []);
      expect(result.conflicting).toBe(false);
    });
  });
});
