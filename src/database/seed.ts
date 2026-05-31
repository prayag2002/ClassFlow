import { DataSource } from 'typeorm';
import { Teacher } from '../entities/teacher.entity';
import { Course } from '../entities/course.entity';
import { Offering, OfferingStatus } from '../entities/offering.entity';
import { Session } from '../entities/session.entity';
import { Parent } from '../entities/parent.entity';
import { Booking, BookingStatus } from '../entities/booking.entity';
import { DateTime } from 'luxon';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Seed script to populate the database with realistic demo data.
 *
 * Creates:
 * - 2 Teachers (different timezones)
 * - 4 Courses
 * - 5 Offerings (with sessions spanning multiple weeks)
 * - 2 Parents (different timezones)
 *
 * Run with: npx ts-node src/database/seed.ts
 */
export async function runSeed(dataSource: DataSource): Promise<void> {
  // Clear existing data (in correct order due to FK constraints)
  await dataSource.getRepository(Booking).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Session).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Offering).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Course).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Teacher).createQueryBuilder().delete().execute();
  await dataSource.getRepository(Parent).createQueryBuilder().delete().execute();
  console.log('🧹 Existing data cleared');

  // ────────────────────────────── Teachers ──────────────────────────────
  const teacherRepo = dataSource.getRepository(Teacher);

  const teacher1 = await teacherRepo.save({
    name: 'Sarah Johnson',
    email: 'sarah@undoschool.com',
    timezone: 'America/New_York',
  });

  const teacher2 = await teacherRepo.save({
    name: 'Raj Patel',
    email: 'raj@undoschool.com',
    timezone: 'Asia/Kolkata',
  });

  console.log('👩‍🏫 Teachers created:', teacher1.name, teacher2.name);

  // ────────────────────────────── Courses ──────────────────────────────
  const courseRepo = dataSource.getRepository(Course);

  const course1 = await courseRepo.save({
    title: 'Minecraft Coding',
    description:
      'Learn programming fundamentals through Minecraft mods. Build redstone circuits and write simple scripts.',
  });

  const course2 = await courseRepo.save({
    title: 'Art Drawing Fundamentals',
    description:
      'Master the basics of sketching, shading, and composition. Perfect for beginners aged 8-14.',
  });

  const course3 = await courseRepo.save({
    title: 'Public Speaking for Kids',
    description:
      'Build confidence through structured speaking exercises, storytelling, and debate practice.',
  });

  const course4 = await courseRepo.save({
    title: 'Roblox Game Design',
    description:
      'Create your own Roblox game from scratch using Lua scripting and Roblox Studio.',
  });

  console.log('📚 Courses created');

  // ────────────────────────────── Offerings ──────────────────────────────
  const offeringRepo = dataSource.getRepository(Offering);
  const sessionRepo = dataSource.getRepository(Session);

  // Helper: generate weekly session dates starting from a given date
  const generateWeeklySessions = (
    startDateISO: string,
    startHour: number,
    endHour: number,
    timezone: string,
    weeks: number,
  ): { startTime: Date; endTime: Date }[] => {
    const sessions: { startTime: Date; endTime: Date }[] = [];
    for (let i = 0; i < weeks; i++) {
      const base = DateTime.fromISO(startDateISO, { zone: timezone }).plus({
        weeks: i,
      });
      const start = base.set({ hour: startHour, minute: 0, second: 0 });
      const end = base.set({ hour: endHour, minute: 0, second: 0 });
      sessions.push({
        startTime: start.toUTC().toJSDate(),
        endTime: end.toUTC().toJSDate(),
      });
    }
    return sessions;
  };

  // Helper: generate daily session dates (for summer camp style)
  const generateDailySessions = (
    startDateISO: string,
    startHour: number,
    endHour: number,
    timezone: string,
    days: number,
  ): { startTime: Date; endTime: Date }[] => {
    const sessions: { startTime: Date; endTime: Date }[] = [];
    for (let i = 0; i < days; i++) {
      const base = DateTime.fromISO(startDateISO, { zone: timezone }).plus({
        days: i,
      });
      const start = base.set({ hour: startHour, minute: 0, second: 0 });
      const end = base.set({ hour: endHour, minute: 0, second: 0 });
      sessions.push({
        startTime: start.toUTC().toJSDate(),
        endTime: end.toUTC().toJSDate(),
      });
    }
    return sessions;
  };

  // Offering 1: Minecraft Coding — Saturday Batch (8 weeks)
  const offering1 = await offeringRepo.save({
    courseId: course1.id,
    teacherId: teacher1.id,
    title: 'Saturday Batch',
    maxStudents: 20,
    status: OfferingStatus.PUBLISHED,
  });

  const sessions1 = generateWeeklySessions(
    '2026-06-06',
    18,
    19,
    teacher1.timezone,
    8,
  );
  for (const s of sessions1) {
    await sessionRepo.save({ offeringId: offering1.id, ...s });
  }

  // Offering 2: Art Drawing — Weekday Evening (6 weeks)
  const offering2 = await offeringRepo.save({
    courseId: course2.id,
    teacherId: teacher2.id,
    title: 'Weekday Evening Batch',
    maxStudents: 15,
    status: OfferingStatus.PUBLISHED,
  });

  const sessions2 = generateWeeklySessions(
    '2026-06-10',
    17,
    18,
    teacher2.timezone,
    6,
  );
  for (const s of sessions2) {
    await sessionRepo.save({ offeringId: offering2.id, ...s });
  }

  // Offering 3: Public Speaking — Summer Camp (5 days, Mon-Fri)
  const offering3 = await offeringRepo.save({
    courseId: course3.id,
    teacherId: teacher1.id,
    title: 'Summer Camp Week',
    maxStudents: 12,
    status: OfferingStatus.PUBLISHED,
  });

  const sessions3 = generateDailySessions(
    '2026-06-15',
    10,
    11,
    teacher1.timezone,
    5,
  );
  for (const s of sessions3) {
    await sessionRepo.save({ offeringId: offering3.id, ...s });
  }

  // Offering 4: Roblox Game Design — Saturday Batch (overlaps with Minecraft for conflict testing)
  const offering4 = await offeringRepo.save({
    courseId: course4.id,
    teacherId: teacher2.id,
    title: 'Saturday Batch',
    maxStudents: 25,
    status: OfferingStatus.PUBLISHED,
  });

  // These sessions intentionally overlap with offering1's times for conflict testing
  const sessions4 = generateWeeklySessions(
    '2026-06-13',
    17,
    19, // Changed from 18 to 19 to overlap with Minecraft (18:00 to 19:00 EST)
    teacher1.timezone,
    6,
  );
  for (const s of sessions4) {
    await sessionRepo.save({ offeringId: offering4.id, ...s });
  }

  // Offering 5: Art Drawing — Draft offering (not yet published)
  const offering5 = await offeringRepo.save({
    courseId: course2.id,
    teacherId: teacher2.id,
    title: 'Weekend Morning Batch',
    maxStudents: 10,
    status: OfferingStatus.DRAFT,
  });

  console.log('📅 Offerings and sessions created');

  // ────────────────────────────── Parents ──────────────────────────────
  const parentRepo = dataSource.getRepository(Parent);

  const parent1 = await parentRepo.save({
    name: 'Emily Chen',
    email: 'emily.chen@gmail.com',
    timezone: 'Asia/Tokyo',
  });

  const parent2 = await parentRepo.save({
    name: 'Michael Brown',
    email: 'michael.brown@gmail.com',
    timezone: 'Europe/London',
  });

  console.log('👨‍👩‍👧 Parents created:', parent1.name, parent2.name);

  // ────────────────────────────── Summary ──────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  🌱 SEED DATA CREATED SUCCESSFULLY');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('📋 Quick Reference IDs (for API testing):\n');
  console.log(`  Teacher 1 (Sarah, EST):      ${teacher1.id}`);
  console.log(`  Teacher 2 (Raj, IST):        ${teacher2.id}`);
  console.log(`  Parent 1 (Emily, JST):       ${parent1.id}`);
  console.log(`  Parent 2 (Michael, GMT):      ${parent2.id}`);
  console.log();
  console.log(`  Course: Minecraft Coding:     ${course1.id}`);
  console.log(`  Course: Art Drawing:          ${course2.id}`);
  console.log(`  Course: Public Speaking:      ${course3.id}`);
  console.log(`  Course: Roblox Game Design:   ${course4.id}`);
  console.log();
  console.log(`  Offering: MC Saturday:        ${offering1.id} (PUBLISHED, ${sessions1.length} sessions)`);
  console.log(`  Offering: Art Weekday:        ${offering2.id} (PUBLISHED, ${sessions2.length} sessions)`);
  console.log(`  Offering: Speaking Camp:       ${offering3.id} (PUBLISHED, ${sessions3.length} sessions)`);
  console.log(`  Offering: Roblox Saturday:    ${offering4.id} (PUBLISHED, overlaps with MC)`);
  console.log(`  Offering: Art Weekend:        ${offering5.id} (DRAFT, no sessions)`);

  console.log('\n💡 Test conflict detection:');
  console.log('   1. Book Offering MC Saturday for any parent');
  console.log('   2. Then try to book Roblox Saturday — should get 409 Conflict');
  console.log();
}

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'class_booking',
    entities: [Teacher, Course, Offering, Session, Parent, Booking],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('✅ Database connected');

  await runSeed(dataSource);

  await dataSource.destroy();
  console.log('✅ Done!');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  });
}
