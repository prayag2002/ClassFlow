import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [BookingModule],
  controllers: [DemoController],
})
export class DemoModule {}
