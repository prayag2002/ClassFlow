import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TeacherService } from './teacher.service';
import { Teacher, Course, Offering, Session, OfferingStatus } from '../entities';
import { TimezoneService } from '../common/timezone.service';

describe('TeacherService', () => {
  let service: TeacherService;
  let teacherRepo: jest.Mocked<Repository<Teacher>>;
  let offeringRepo: jest.Mocked<Repository<Offering>>;
  let sessionRepo: jest.Mocked<Repository<Session>>;

  const mockTimezoneService = {
    convertToUTC: (localTime: string) => new Date(localTime),
    convertFromUTC: (utcDate: Date) => utcDate.toISOString(),
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherService,
        { provide: getRepositoryToken(Teacher), useFactory: mockRepo },
        { provide: getRepositoryToken(Course), useFactory: mockRepo },
        { provide: getRepositoryToken(Offering), useFactory: mockRepo },
        { provide: getRepositoryToken(Session), useFactory: mockRepo },
        { provide: TimezoneService, useValue: mockTimezoneService },
      ],
    }).compile();

    service = module.get<TeacherService>(TeacherService);
    teacherRepo = module.get(getRepositoryToken(Teacher));
    offeringRepo = module.get(getRepositoryToken(Offering));
    sessionRepo = module.get(getRepositoryToken(Session));
  });

  describe('addSessions with Teacher-Wide Overlap Check', () => {
    it('should throw BadRequestException if new session overlaps with another active offering taught by the same teacher', async () => {
      const teacherId = 'teacher-1';
      const offeringId = 'offering-1';
      
      teacherRepo.findOne.mockResolvedValue({ id: teacherId, timezone: 'UTC' } as Teacher);
      
      offeringRepo.findOne.mockResolvedValue({
        id: offeringId,
        teacherId,
        status: OfferingStatus.DRAFT,
        sessions: [],
      } as unknown as Offering);

      // Existing session from a DIFFERENT active offering (offering-2) of same teacher
      const existingSessionFromOtherOffering = {
        id: 'session-exist-1',
        offeringId: 'offering-2',
        startTime: new Date('2026-06-06T18:00:00Z'),
        endTime: new Date('2026-06-06T20:00:00Z'),
        offering: {
          id: 'offering-2',
          title: 'Roblox Evening Batch',
          status: OfferingStatus.PUBLISHED,
          course: { title: 'Roblox Coding' },
        },
      } as unknown as Session;

      const mockQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([existingSessionFromOtherOffering]),
      };

      sessionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Attempting to add a session that overlaps: 7:00 PM - 9:00 PM (overlaps 6:00 PM - 8:00 PM)
      const dto = {
        sessions: [
          {
            startTime: '2026-06-06T19:00:00Z',
            endTime: '2026-06-06T21:00:00Z',
          },
        ],
      };

      await expect(
        service.addSessions(teacherId, offeringId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully save sessions if there are no teacher-wide overlaps', async () => {
      const teacherId = 'teacher-1';
      const offeringId = 'offering-1';
      
      teacherRepo.findOne.mockResolvedValue({ id: teacherId, timezone: 'UTC' } as Teacher);
      
      offeringRepo.findOne.mockResolvedValue({
        id: offeringId,
        teacherId,
        status: OfferingStatus.DRAFT,
        sessions: [],
      } as unknown as Offering);

      const mockQueryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), // No active sessions found
      };

      sessionRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      sessionRepo.create.mockImplementation((s) => s as any);
      sessionRepo.save.mockResolvedValue([{ id: 'new-session-1' }] as any);

      const dto = {
        sessions: [
          {
            startTime: '2026-06-06T12:00:00Z',
            endTime: '2026-06-06T14:00:00Z',
          },
        ],
      };

      const result = await service.addSessions(teacherId, offeringId, dto);
      expect(result).toBeDefined();
      expect(sessionRepo.save).toHaveBeenCalled();
    });
  });
});
