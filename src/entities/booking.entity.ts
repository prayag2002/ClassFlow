import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Parent } from './parent.entity';
import { Offering } from './offering.entity';

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('bookings')
@Unique('UQ_parent_offering_active', ['parentId', 'offeringId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'parent_id' })
  parentId!: string;

  @Column({ name: 'offering_id' })
  offeringId!: string;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.CONFIRMED,
  })
  status!: BookingStatus;

  @CreateDateColumn({ name: 'booked_at' })
  bookedAt!: Date;

  @ManyToOne(() => Parent, (parent) => parent.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent!: Parent;

  @ManyToOne(() => Offering, (offering) => offering.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offering_id' })
  offering!: Offering;
}
