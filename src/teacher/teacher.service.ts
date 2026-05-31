import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Teacher, Course, Offering, Session, OfferingStatus, BookingStatus } from '../entities';
import { TimezoneService } from '../common/timezone.service';
import { CreateOfferingDto, AddSessionsDto } from './dto';

@Injectable()
export class TeacherService {
  constructor(
    @InjectRepository(Teacher)
    private readonly teacherRepo: Repository<Teacher>,

    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,

    @InjectRepository(Offering)
    private readonly offeringRepo: Repository<Offering>,

    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,

    private readonly timezoneService: TimezoneService,
  ) {}

  /**
   * Finds a teacher by ID, throwing 404 if not found.
   */
  async findTeacherOrFail(teacherId: string): Promise<Teacher> {
    const teacher = await this.teacherRepo.findOne({ where: { id: teacherId } });
    if (!teacher) {
      throw new NotFoundException(`Teacher with ID "${teacherId}" not found`);
    }
    return teacher;
  }

  /**
   * Creates a new offering for a course under a teacher.
   * The offering starts in DRAFT status — teacher should publish it after adding sessions.
   */
  async createOffering(
    teacherId: string,
    dto: CreateOfferingDto,
  ): Promise<Offering> {
    const teacher = await this.findTeacherOrFail(teacherId);

    const course = await this.courseRepo.findOne({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException(`Course with ID "${dto.courseId}" not found`);
    }

    const offering = this.offeringRepo.create({
      courseId: dto.courseId,
      teacherId: teacher.id,
      title: dto.title,
      maxStudents: dto.maxStudents ?? 30,
      status: OfferingStatus.DRAFT,
    });

    const saved = await this.offeringRepo.save(offering);

    // Return with course relation loaded for a richer response
    return this.offeringRepo.findOneOrFail({
      where: { id: saved.id },
      relations: { course: true, sessions: true },
    });
  }

  /**
   * Adds sessions to an existing offering.
   * Teacher sends times in their LOCAL timezone — we convert to UTC before storing.
   * 
   * Validates:
   * - Offering exists and belongs to this teacher
   * - Offering is not CANCELLED
   * - Each session's endTime > startTime
   * - Sessions don't overlap with each other within this offering
   */
  async addSessions(
    teacherId: string,
    offeringId: string,
    dto: AddSessionsDto,
  ): Promise<Session[]> {
    const teacher = await this.findTeacherOrFail(teacherId);

    const offering = await this.offeringRepo.findOne({
      where: { id: offeringId, teacherId: teacher.id },
      relations: { sessions: true },
    });

    if (!offering) {
      throw new NotFoundException(
        `Offering with ID "${offeringId}" not found for teacher "${teacherId}"`,
      );
    }

    if (offering.status === OfferingStatus.CANCELLED) {
      throw new UnprocessableEntityException(
        'Cannot add sessions to a cancelled offering',
      );
    }

    // Convert local times to UTC using the teacher's timezone
    const newSessions: { startTime: Date; endTime: Date }[] = [];

    for (const sessionDto of dto.sessions) {
      const startTime = this.timezoneService.convertToUTC(
        sessionDto.startTime,
        teacher.timezone,
      );
      const endTime = this.timezoneService.convertToUTC(
        sessionDto.endTime,
        teacher.timezone,
      );

      if (endTime <= startTime) {
        throw new BadRequestException(
          `Session end time (${sessionDto.endTime}) must be after start time (${sessionDto.startTime})`,
        );
      }

      newSessions.push({ startTime, endTime });
    }

    // Check for overlaps among new sessions themselves
    for (let i = 0; i < newSessions.length; i++) {
      for (let j = i + 1; j < newSessions.length; j++) {
        if (
          newSessions[i].startTime < newSessions[j].endTime &&
          newSessions[i].endTime > newSessions[j].startTime
        ) {
          throw new BadRequestException(
            `Sessions overlap: session ${i + 1} (${dto.sessions[i].startTime} - ${dto.sessions[i].endTime}) conflicts with session ${j + 1} (${dto.sessions[j].startTime} - ${dto.sessions[j].endTime})`,
          );
        }
      }
    }

    // Check for overlaps with existing sessions in this offering
    for (let i = 0; i < newSessions.length; i++) {
      for (const existing of offering.sessions) {
        if (
          newSessions[i].startTime < existing.endTime &&
          newSessions[i].endTime > existing.startTime
        ) {
          throw new BadRequestException(
            `New session ${i + 1} (${dto.sessions[i].startTime} - ${dto.sessions[i].endTime}) overlaps with an existing session in this offering`,
          );
        }
      }
    }

    // Create and save sessions
    const sessionEntities = newSessions.map((s) =>
      this.sessionRepo.create({
        offeringId: offering.id,
        startTime: s.startTime,
        endTime: s.endTime,
      }),
    );

    return this.sessionRepo.save(sessionEntities);
  }

  /**
   * Updates offering status (e.g., DRAFT → PUBLISHED).
   */
  async updateOfferingStatus(
    teacherId: string,
    offeringId: string,
    status: OfferingStatus,
  ): Promise<Offering> {
    const teacher = await this.findTeacherOrFail(teacherId);

    const offering = await this.offeringRepo.findOne({
      where: { id: offeringId, teacherId: teacher.id },
      relations: { sessions: true, course: true },
    });

    if (!offering) {
      throw new NotFoundException(
        `Offering with ID "${offeringId}" not found for teacher "${teacherId}"`,
      );
    }

    // Validate state transitions
    if (offering.status === OfferingStatus.CANCELLED) {
      throw new UnprocessableEntityException(
        'Cannot change the status of a cancelled offering',
      );
    }

    if (
      status === OfferingStatus.PUBLISHED &&
      offering.sessions.length === 0
    ) {
      throw new UnprocessableEntityException(
        'Cannot publish an offering with no sessions. Add at least one session first.',
      );
    }

    offering.status = status;
    return this.offeringRepo.save(offering);
  }

  /**
   * Returns all offerings for a teacher with their sessions.
   * Session times are converted to the teacher's local timezone for display.
   * 
   * Optionally filters to only upcoming offerings (offerings with at least
   * one session in the future).
   */
  async getTeacherOfferings(
    teacherId: string,
    upcomingOnly = false,
  ): Promise<{
    teacher: { id: string; name: string; timezone: string };
    offerings: Array<{
      id: string;
      title: string;
      courseName: string;
      status: OfferingStatus;
      maxStudents: number;
      bookingCount: number;
      sessions: Array<{
        id: string;
        startTime: string;
        endTime: string;
        startTimeFormatted: string;
        endTimeFormatted: string;
      }>;
    }>;
  }> {
    const teacher = await this.findTeacherOrFail(teacherId);

    const queryBuilder = this.offeringRepo
      .createQueryBuilder('offering')
      .leftJoinAndSelect('offering.sessions', 'session')
      .leftJoinAndSelect('offering.course', 'course')
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)')
          .from('bookings', 'b')
          .where('b.offering_id = offering.id')
          .andWhere('b.status = :bookingStatus', { bookingStatus: BookingStatus.CONFIRMED });
      }, 'booking_count')
      .where('offering.teacherId = :teacherId', { teacherId })
      .orderBy('offering.createdAt', 'DESC')
      .addOrderBy('session.startTime', 'ASC');

    if (upcomingOnly) {
      queryBuilder.andWhere(
        'EXISTS (SELECT 1 FROM sessions s WHERE s.offering_id = offering.id AND s.start_time > NOW())',
      );
    }

    const { entities: offerings, raw } = await queryBuilder.getRawAndEntities();

    // Build a map of offering id -> booking count from raw results
    const bookingCountMap = new Map<string, number>();
    for (const row of raw) {
      const offeringId = row.offering_id;
      if (offeringId && !bookingCountMap.has(offeringId)) {
        bookingCountMap.set(offeringId, parseInt(row.booking_count, 10) || 0);
      }
    }

    // Convert session times to teacher's local timezone
    return {
      teacher: {
        id: teacher.id,
        name: teacher.name,
        timezone: teacher.timezone,
      },
      offerings: offerings.map((offering: Offering) => ({
        id: offering.id,
        title: offering.title,
        courseName: offering.course?.title ?? '',
        status: offering.status,
        maxStudents: offering.maxStudents,
        bookingCount: bookingCountMap.get(offering.id) ?? 0,
        sessions: (offering.sessions ?? []).map((session: Session) => ({
          id: session.id,
          startTime: this.timezoneService.convertFromUTC(
            session.startTime,
            teacher.timezone,
          ),
          endTime: this.timezoneService.convertFromUTC(
            session.endTime,
            teacher.timezone,
          ),
          startTimeFormatted: this.timezoneService.formatInTimezone(
            session.startTime,
            teacher.timezone,
          ),
          endTimeFormatted: this.timezoneService.formatInTimezone(
            session.endTime,
            teacher.timezone,
          ),
        })),
      })),
    };
  }
}
