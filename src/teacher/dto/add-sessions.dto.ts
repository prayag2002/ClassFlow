import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export class SessionDto {
  @ApiProperty({
    description:
      'Start time in ISO 8601 format (local time in teacher timezone, WITHOUT offset). e.g. "2026-06-06T18:00:00"',
    example: '2026-06-06T18:00:00',
  })
  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    description:
      'End time in ISO 8601 format (local time in teacher timezone, WITHOUT offset). e.g. "2026-06-06T19:00:00"',
    example: '2026-06-06T19:00:00',
  })
  @IsString()
  @IsNotEmpty()
  endTime!: string;
}

export class AddSessionsDto {
  @ApiProperty({
    description: 'Array of sessions to add to the offering',
    type: [SessionDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SessionDto)
  sessions!: SessionDto[];
}
