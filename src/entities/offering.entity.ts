import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { Teacher } from './teacher.entity';
import { Session } from './session.entity';
import { Booking } from './booking.entity';

export enum OfferingStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
}

@Entity('offerings')
export class Offering {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id' })
  courseId!: string;

  @Column({ name: 'teacher_id' })
  teacherId!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ name: 'max_students', default: 30 })
  maxStudents!: number;

  @Column({
    type: 'enum',
    enum: OfferingStatus,
    default: OfferingStatus.DRAFT,
  })
  status!: OfferingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => Course, (course) => course.offerings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @ManyToOne(() => Teacher, (teacher) => teacher.offerings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher!: Teacher;

  @OneToMany(() => Session, (session) => session.offering, { cascade: true })
  sessions!: Session[];

  @OneToMany(() => Booking, (booking) => booking.offering)
  bookings!: Booking[];
}
