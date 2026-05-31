import { Module, Global } from '@nestjs/common';
import { TimezoneService } from './timezone.service';

@Global()
@Module({
  providers: [TimezoneService],
  exports: [TimezoneService],
})
export class CommonModule {}
