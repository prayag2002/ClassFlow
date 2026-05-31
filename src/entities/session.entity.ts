import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { Offering } from './offering.entity';

@Entity('sessions')
@Check(`"end_time" > "start_time"`)
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'offering_id' })
  offeringId!: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime!: Date;

  @ManyToOne(() => Offering, (offering) => offering.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offering_id' })
  offering!: Offering;
}
