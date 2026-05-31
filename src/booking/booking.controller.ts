import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto';

@ApiTags('Parent / Booking')
@Controller('parents')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @Get(':parentId/available-offerings')
  @ApiOperation({
    summary: 'Get available offerings',
    description:
      'Returns all published offerings with their sessions. Session times are automatically converted to the parent\'s local timezone.',
  })
  @ApiParam({ name: 'parentId', description: 'UUID of the parent' })
  @ApiResponse({ status: 200, description: 'List of available offerings' })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  async getAvailableOfferings(
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ) {
    return this.bookingService.getAvailableOfferings(parentId);
  }

  @Post(':parentId/bookings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Book an offering',
    description:
      'Books an entire offering (all sessions) for a parent. Checks for time conflicts with existing bookings and enforces capacity limits. Uses advisory locks + serializable transactions for concurrency safety.',
  })
  @ApiParam({ name: 'parentId', description: 'UUID of the parent' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({
    status: 409,
    description: 'Time conflict with existing booking or offering is full',
  })
  @ApiResponse({
    status: 422,
    description: 'Offering is not available for booking',
  })
  async bookOffering(
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookingService.bookOffering(parentId, dto);
  }

  @Get(':parentId/bookings')
  @ApiOperation({
    summary: 'Get parent bookings',
    description:
      'Returns all confirmed bookings for a parent with offering details and session times in the parent\'s local timezone.',
  })
  @ApiParam({ name: 'parentId', description: 'UUID of the parent' })
  @ApiResponse({ status: 200, description: 'List of bookings' })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  async getParentBookings(
    @Param('parentId', ParseUUIDPipe) parentId: string,
  ) {
    return this.bookingService.getParentBookings(parentId);
  }
}
