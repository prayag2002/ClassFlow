import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // ─── Global Validation Pipe ───────────────────────────────────────
  // Automatically validates incoming DTOs using class-validator decorators
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in the DTO
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transform: true, // Auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── Global Exception Filter ─────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── CORS ─────────────────────────────────────────────────────────
  app.enableCors();

  // ─── Swagger API Documentation ────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Class Booking System API')
    .setDescription(
      `## Global Class Offering Booking System

A production-ready backend for a live-learning platform where:
- **Teachers** create course offerings with sessions in their local timezone
- **Parents** view and book offerings in their own timezone
- **Concurrency** is handled via PostgreSQL advisory locks + serializable transactions
- **Conflict detection** prevents overlapping session bookings

### Key Features
- Full timezone support (IANA timezones, UTC storage)
- Concurrent booking safety (advisory locks per parent)
- Time conflict detection with detailed error responses
- Capacity management per offering
- Auto-generated API documentation (this page!)
`,
    )
    .setVersion('1.0.0')
    .addTag('Teacher', 'APIs for teachers to manage offerings and sessions')
    .addTag(
      'Parent / Booking',
      'APIs for parents to view offerings and make bookings',
    )
    .addTag('Course', 'APIs for course management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // ─── Start Server ─────────────────────────────────────────────────
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`Application running on http://localhost:${port}`);
  logger.log(
    `Swagger API docs at http://localhost:${port}/api/docs`,
  );
}

bootstrap();
