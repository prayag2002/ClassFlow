import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { OfferingStatus } from '../../entities';

export class PublishOfferingDto {
  @ApiProperty({
    description: 'New status for the offering',
    enum: OfferingStatus,
    example: OfferingStatus.PUBLISHED,
  })
  @IsEnum(OfferingStatus)
  @IsOptional()
  status!: OfferingStatus;
}
