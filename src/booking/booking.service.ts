import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Parent,
  Offering,
  Session,
  Booking,
  BookingStatus,
  OfferingStatus,
} from '../entities';
import { TimezoneService } from '../common/timezone.service';
import { CreateBookingDto } from './dto';

/**
 * Represents a detected time conflict between two sessions.
 */
interface TimeConflict {
  existingSession: {
    offeringId: string;
    offeringTitle: string;
    startTime: string;
    endTime: string;
  };
  conflictingSession: {
    offeringId: string;
    offeringTitle: string;
    startTime: string;
    endTime: string;
  };
}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,

    @InjectRepository(Offering)
    private readonly offeringRepo: Repository<Offering>,

    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,

    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,

    private readonly dataSource: DataSource,
    private readonly timezoneService: TimezoneService,
  ) {}

  /**
   * Finds a parent by ID, throwing 404 if not found.
   */
  private async findParentOrFail(parentId: string): Promise<Parent> {
    const parent = await this.parentRepo.findOne({ where: { id: parentId } });
    if (!parent) {
      throw new NotFoundException(`Parent with ID "${parentId}" not found`);
    }
    return parent;
  }

  /**
   * Returns all PUBLISHED offerings with their sessions.
   * Session times are converted to the parent's local timezone.
   */
  async getAvailableOfferings(parentId: string): Promise<{
    parent: { id: string; name: string; timezone: string };
    offerings: Array<{
      id: string;
      title: string;
      courseName: string;
      courseDescription: string | null;
      teacherName: string;
      maxStudents: number;
      availableSlots: number;
      sessions: Array<{
        id: string;
        startTime: string;
        endTime: string;
        startTimeFormatted: string;
        endTimeFormatted: string;
      }>;
    }>;
  }> {
    const parent = await this.findParentOrFail(parentId);

    const offerings = await this.offeringRepo
      .createQueryBuilder('offering')
      .leftJoinAndSelect('offering.sessions', 'session')
      .leftJoinAndSelect('offering.course', 'course')
      .leftJoinAndSelect('offering.teacher', 'teacher')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('bookings', 'b')
          .where('b.offering_id = offering.id')
          .andWhere('b.status = :bookingStatus', { bookingStatus: BookingStatus.CONFIRMED });
      }, 'booking_count')
      .where('offering.status = :status', { status: OfferingStatus.PUBLISHED })
      .orderBy('session.startTime', 'ASC')
      .getRawAndEntities();

    // Build booking count map
    const bookingCountMap = new Map<string, number>();
    for (const row of offerings.raw) {
      const offeringId = row.offering_id;
      if (offeringId && !bookingCountMap.has(offeringId)) {
        bookingCountMap.set(offeringId, parseInt(row.booking_count, 10) || 0);
      }
    }

    return {
      parent: {
        id: parent.id,
        name: parent.name,
        timezone: parent.timezone,
      },
      offerings: offerings.entities.map((offering: Offering) => {
        const bookingCount = bookingCountMap.get(offering.id) ?? 0;
        return {
          id: offering.id,
          title: offering.title,
          courseName: offering.course?.title ?? '',
          courseDescription: offering.course?.description ?? null,
          teacherName: offering.teacher?.name ?? '',
          maxStudents: offering.maxStudents,
          availableSlots: offering.maxStudents - bookingCount,
          sessions: (offering.sessions ?? []).map((session: Session) => ({
            id: session.id,
            startTime: this.timezoneService.convertFromUTC(
              session.startTime,
              parent.timezone,
            ),
            endTime: this.timezoneService.convertFromUTC(
              session.endTime,
              parent.timezone,
            ),
            startTimeFormatted: this.timezoneService.formatInTimezone(
              session.startTime,
              parent.timezone,
            ),
            endTimeFormatted: this.timezoneService.formatInTimezone(
              session.endTime,
              parent.timezone,
            ),
          })),
        };
      }),
    };
  }

  /**
   * Books an offering for a parent with FULL concurrency safety.
   *
   * Concurrency strategy:
   * 1. PostgreSQL advisory lock (per parent) — serializes this parent's booking
   *    requests so they can't fire two conflicting bookings simultaneously.
   *    Other parents are NOT blocked.
   * 2. SERIALIZABLE transaction isolation — catches phantom reads where another
   *    transaction inserts a conflicting booking between our check and insert.
   *
   * Conflict detection:
   * - Fetches all sessions of the target offering
   * - Fetches all sessions of the parent's existing CONFIRMED bookings
   * - Checks for ANY time overlap between them
   * - Two sessions overlap if: A.start < B.end AND A.end > B.start
   */
  async bookOffering(
    parentId: string,
    dto: CreateBookingDto,
  ): Promise<Booking> {
    const parent = await this.findParentOrFail(parentId);

    // Use a transaction with SERIALIZABLE isolation for maximum safety
    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      // 1. Acquire an advisory lock scoped to this parent.
      //    This serializes concurrent booking attempts by the SAME parent.
      //    Other parents proceed without contention.
      //    We use pg_advisory_xact_lock which auto-releases on transaction end.
      const lockKey = this.parentIdToLockKey(parentId);
      await manager.query(`SELECT pg_advisory_xact_lock($1)`, [lockKey]);

      this.logger.log(
        `Advisory lock acquired for parent ${parentId} (key: ${lockKey})`,
      );

      // 2. Fetch the target offering and validate
      const offering = await manager.findOne(Offering, {
        where: { id: dto.offeringId },
        relations: { sessions: true, course: true },
      });

      if (!offering) {
        throw new NotFoundException(
          `Offering with ID "${dto.offeringId}" not found`,
        );
      }

      if (offering.status !== OfferingStatus.PUBLISHED) {
        throw new UnprocessableEntityException(
          `Offering "${offering.title}" is not available for booking (status: ${offering.status})`,
        );
      }

      if (!offering.sessions || offering.sessions.length === 0) {
        throw new UnprocessableEntityException(
          `Offering "${offering.title}" has no sessions`,
        );
      }

      // 3. Check if parent already booked this offering
      const existingBooking = await manager.findOne(Booking, {
        where: {
          parentId,
          offeringId: dto.offeringId,
          status: BookingStatus.CONFIRMED,
        },
      });

      if (existingBooking) {
        throw new ConflictException(
          `You have already booked offering "${offering.title}"`,
        );
      }

      // 4. Check capacity
      const confirmedBookingCount = await manager.count(Booking, {
        where: {
          offeringId: dto.offeringId,
          status: BookingStatus.CONFIRMED,
        },
      });

      if (confirmedBookingCount >= offering.maxStudents) {
        throw new ConflictException(
          `Offering "${offering.title}" is full (${confirmedBookingCount}/${offering.maxStudents} students)`,
        );
      }

      // 5. Time conflict detection — the heart of the system
      //    Fetch ALL sessions from ALL of this parent's CONFIRMED bookings
      const parentBookedSessions = await manager
        .createQueryBuilder(Session, 'session')
        .innerJoin(
          Booking,
          'booking',
          'booking.offering_id = session.offering_id AND booking.parent_id = :parentId AND booking.status = :bStatus',
          { parentId, bStatus: BookingStatus.CONFIRMED },
        )
        .innerJoin(Offering, 'offering', 'offering.id = session.offering_id')
        .select([
          'session.id',
          'session.startTime',
          'session.endTime',
          'session.offeringId',
        ])
        .addSelect('offering.title', 'offeringTitle')
        .getRawMany();

      // Check for time conflicts
      const targetSessions = offering.sessions;

      for (const targetSession of targetSessions) {
        for (const rawRow of parentBookedSessions) {
          const bookedStart = new Date(rawRow.session_start_time);
          const bookedEnd = new Date(rawRow.session_end_time);

          // Two sessions overlap if: A.start < B.end AND A.end > B.start
          if (
            targetSession.startTime < bookedEnd &&
            targetSession.endTime > bookedStart
          ) {
            const conflict: TimeConflict = {
              existingSession: {
                offeringId: rawRow.session_offering_id,
                offeringTitle: rawRow.offeringTitle,
                startTime: this.timezoneService.convertFromUTC(
                  bookedStart,
                  parent.timezone,
                ),
                endTime: this.timezoneService.convertFromUTC(
                  bookedEnd,
                  parent.timezone,
                ),
              },
              conflictingSession: {
                offeringId: offering.id,
                offeringTitle: offering.title,
                startTime: this.timezoneService.convertFromUTC(
                  targetSession.startTime,
                  parent.timezone,
                ),
                endTime: this.timezoneService.convertFromUTC(
                  targetSession.endTime,
                  parent.timezone,
                ),
              },
            };

            throw new ConflictException({
              message: `Booking conflicts with an existing session. "${offering.title}" session overlaps with your booked "${rawRow.offeringTitle}" session.`,
              error: 'Conflict',
              statusCode: 409,
              details: conflict,
            });
          }
        }
      }

      // 6. All checks passed — create the booking
      const booking = manager.create(Booking, {
        parentId,
        offeringId: dto.offeringId,
        status: BookingStatus.CONFIRMED,
      });

      const savedBooking = await manager.save(booking);

      this.logger.log(
        `Booking created: parent=${parentId}, offering=${dto.offeringId}, booking=${savedBooking.id}`,
      );

      return savedBooking;
    });
  }

  /**
   * Returns all confirmed bookings for a parent with offering and session details.
   * Session times are converted to the parent's local timezone.
   */
  async getParentBookings(parentId: string): Promise<{
    parent: { id: string; name: string; timezone: string };
    bookings: Array<{
      bookingId: string;
      bookedAt: string;
      status: BookingStatus;
      offering: {
        id: string;
        title: string;
        courseName: string;
        teacherName: string;
        sessions: Array<{
          id: string;
          startTime: string;
          endTime: string;
          startTimeFormatted: string;
          endTimeFormatted: string;
        }>;
      };
    }>;
  }> {
    const parent = await this.findParentOrFail(parentId);

    const bookings = await this.bookingRepo.find({
      where: { parentId, status: BookingStatus.CONFIRMED },
      relations: {
        offering: {
          sessions: true,
          course: true,
          teacher: true,
        },
      },
      order: { bookedAt: 'DESC' },
    });

    return {
      parent: {
        id: parent.id,
        name: parent.name,
        timezone: parent.timezone,
      },
      bookings: bookings.map((booking: Booking) => ({
        bookingId: booking.id,
        bookedAt: booking.bookedAt.toISOString(),
        status: booking.status,
        offering: {
          id: booking.offering.id,
          title: booking.offering.title,
          courseName: booking.offering.course?.title ?? '',
          teacherName: booking.offering.teacher?.name ?? '',
          sessions: (booking.offering.sessions ?? [])
            .sort(
              (a: Session, b: Session) => a.startTime.getTime() - b.startTime.getTime(),
            )
            .map((session: Session) => ({
              id: session.id,
              startTime: this.timezoneService.convertFromUTC(
                session.startTime,
                parent.timezone,
              ),
              endTime: this.timezoneService.convertFromUTC(
                session.endTime,
                parent.timezone,
              ),
              startTimeFormatted: this.timezoneService.formatInTimezone(
                session.startTime,
                parent.timezone,
              ),
              endTimeFormatted: this.timezoneService.formatInTimezone(
                session.endTime,
                parent.timezone,
              ),
            })),
        },
      })),
    };
  }

  /**
   * Converts a UUID to a numeric hash suitable for pg_advisory_xact_lock.
   * Advisory locks require a bigint key. We hash the UUID to get a stable number.
   *
   * This ensures the lock is scoped to a specific parent — different parents
   * get different lock keys, so they don't block each other.
   */
  private parentIdToLockKey(parentId: string): number {
    // Simple hash: sum of char codes with prime multiplier
    let hash = 0;
    for (let i = 0; i < parentId.length; i++) {
      hash = (hash * 31 + parentId.charCodeAt(i)) | 0; // | 0 keeps it 32-bit int
    }
    // Ensure positive value for advisory lock
    return Math.abs(hash);
  }
}
