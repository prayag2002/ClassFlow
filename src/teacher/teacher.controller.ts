import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
import { CreateOfferingDto, AddSessionsDto, PublishOfferingDto } from './dto';

@ApiTags('Teacher')
@Controller('teachers')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post(':teacherId/offerings')
  @ApiOperation({
    summary: 'Create a new offering',
    description:
      'Creates a new offering (section) for a course under this teacher. The offering starts in DRAFT status.',
  })
  @ApiParam({ name: 'teacherId', description: 'UUID of the teacher' })
  @ApiResponse({ status: 201, description: 'Offering created successfully' })
  @ApiResponse({ status: 404, description: 'Teacher or Course not found' })
  async createOffering(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Body() dto: CreateOfferingDto,
  ) {
    return this.teacherService.createOffering(teacherId, dto);
  }

  @Post(':teacherId/offerings/:offeringId/sessions')
  @ApiOperation({
    summary: 'Add sessions to an offering',
    description:
      'Adds one or more sessions to an offering. Times should be in the teacher\'s local timezone (no UTC offset). The service converts to UTC automatically.',
  })
  @ApiParam({ name: 'teacherId', description: 'UUID of the teacher' })
  @ApiParam({ name: 'offeringId', description: 'UUID of the offering' })
  @ApiResponse({ status: 201, description: 'Sessions added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid session times or overlapping sessions' })
  @ApiResponse({ status: 404, description: 'Teacher or Offering not found' })
  async addSessions(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Param('offeringId', ParseUUIDPipe) offeringId: string,
    @Body() dto: AddSessionsDto,
  ) {
    return this.teacherService.addSessions(teacherId, offeringId, dto);
  }

  @Patch(':teacherId/offerings/:offeringId/status')
  @ApiOperation({
    summary: 'Update offering status',
    description:
      'Changes the status of an offering (e.g., DRAFT → PUBLISHED). An offering must have at least one session before it can be published.',
  })
  @ApiParam({ name: 'teacherId', description: 'UUID of the teacher' })
  @ApiParam({ name: 'offeringId', description: 'UUID of the offering' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 422, description: 'Invalid state transition' })
  async updateOfferingStatus(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Param('offeringId', ParseUUIDPipe) offeringId: string,
    @Body() dto: PublishOfferingDto,
  ) {
    return this.teacherService.updateOfferingStatus(
      teacherId,
      offeringId,
      dto.status,
    );
  }

  @Get(':teacherId/offerings')
  @ApiOperation({
    summary: 'Get teacher offerings',
    description:
      'Returns all offerings for a teacher with their sessions. Session times are shown in the teacher\'s local timezone.',
  })
  @ApiParam({ name: 'teacherId', description: 'UUID of the teacher' })
  @ApiQuery({
    name: 'upcomingOnly',
    required: false,
    description: 'If true, only returns offerings with upcoming sessions',
  })
  @ApiResponse({ status: 200, description: 'List of offerings with sessions' })
  @ApiResponse({ status: 404, description: 'Teacher not found' })
  async getTeacherOfferings(
    @Param('teacherId', ParseUUIDPipe) teacherId: string,
    @Query('upcomingOnly', new DefaultValuePipe(false), ParseBoolPipe)
    upcomingOnly: boolean,
  ) {
    return this.teacherService.getTeacherOfferings(teacherId, upcomingOnly);
  }
}
