# Global Class Offering Booking System

A production-ready backend service for a global live-learning platform where teachers create course offerings with sessions, and parents book them across timezones — with full concurrency safety and conflict detection.

## Documentation and Manuals

* **[Architecture Decision Log](DECISION.md)**: Details the rationale for choosing NestJS (TypeScript/Node.js) over Spring Boot (Java) for this implementation.
* **[Testing and Verification Manual](TESTING_MANUAL.md)**: Detailed instructions on running the Jest test suite, the CLI automated verification script, and navigating the web-based verification dashboard.

## Key Features

- **Full Timezone Support** — Teachers create sessions in their local timezone, parents view in theirs. All stored as UTC internally.
- **Concurrent Booking Safety** — PostgreSQL advisory locks (per-parent) + SERIALIZABLE transactions prevent race conditions.
- **Time Conflict Detection** — Prevents parents from booking overlapping sessions with detailed conflict error responses.
- **Capacity Management** — Max students per offering with atomic enforcement.
- **Interactive API Docs** — Swagger UI at `/api/docs` for instant testing.
- **Comprehensive Tests** — Unit tests for conflict detection and timezone conversion.
- **Verification Dashboard** — Single-page UI at `/` for real-time validation of booking rules, time zones, and concurrency locks.

## Verification Dashboard

An interactive Single-Page Application is served directly at the root path (`/`) to simplify testing and verification of the system's boundary conditions:

- **Parents Booking Portal**: Switch active parent profiles (e.g., Tokyo vs London) to see schedules dynamically translated to their local timezone. Test slot limits, book classes, and check for overlap conflict alerts.
- **Teachers Management Portal**: Create course offerings, add sessions (local teacher timezone), publish drafts, and view real-time student booking rosters.
- **Lock Safety & Conflict Laboratory**: Trigger sandboxes to audit the backend response parameters:
  - *Conflict Detection Sandbox*: Attempts overlapping bookings and validates the 409 Conflict response containing the overlapping session details and a visual timeline diagram.
  - *Concurrency Safety Sandbox*: Fires 10 concurrent requests at the exact same millisecond for a single parent to verify the advisory lock guarantees exactly 1 success and 9 grace-blocked requests.

## Architecture

```
NestJS (TypeScript) → TypeORM → PostgreSQL
     │
     ├── Teacher Module (offerings, sessions)
     ├── Booking Module (conflict detection, advisory locks)
     ├── Course Module (course management)
     └── Common Module (timezone service, exception filter)
```

### Concurrency Strategy

```
Parent A books offering → Advisory Lock (per parent) → Check conflicts → Insert booking → Release
Parent B books offering → Different lock key → Proceeds independently
Parent A fires 2 requests → Same lock key → Serialized, one at a time
```

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **PostgreSQL** >= 14 (or use Docker)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start PostgreSQL

**Option A: Docker (recommended)**
```bash
docker-compose up -d
```

**Option B: Local PostgreSQL**
Create a database named `class_booking`:
```sql
CREATE DATABASE class_booking;
```

### 3. Configure Environment

The default `.env` is pre-configured for Docker. Update if your PostgreSQL credentials differ:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=class_booking
```

### 4. Seed the Database

```bash
npm run seed
```

This creates sample teachers, courses, offerings, sessions, and parents with realistic data. It will print out UUIDs you can use for API testing.

### 5. Start the Server

```bash
npm run start:dev
```

The server runs at `http://localhost:3000`
Swagger API docs at `http://localhost:3000/api/docs`

## API Reference

### Teacher APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/teachers/:teacherId/offerings` | Create a new offering |
| `POST` | `/teachers/:teacherId/offerings/:offeringId/sessions` | Add sessions (in teacher's timezone) |
| `PATCH` | `/teachers/:teacherId/offerings/:offeringId/status` | Publish/cancel offering |
| `GET` | `/teachers/:teacherId/offerings` | View offerings with sessions |

### Parent APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/parents/:parentId/available-offerings` | View published offerings (in parent's timezone) |
| `POST` | `/parents/:parentId/bookings` | Book an offering (with conflict & capacity checks) |
| `GET` | `/parents/:parentId/bookings` | View booked offerings |

### Course APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/courses` | List all courses |
| `POST` | `/courses` | Create a course |

## Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:cov
```

### Test Coverage

- **Timezone Service** — UTC conversions, round-trips, cross-timezone display, edge cases
- **Conflict Detection** — Overlapping sessions, boundary cases, assignment scenarios, midnight crossings

## Key Design Decisions

### 1. UTC Storage
All timestamps stored as `TIMESTAMP WITH TIME ZONE` in UTC. Timezone conversion happens only at the API boundary via `TimezoneService`. This means:
- Conflict detection is a simple numeric comparison
- No DST ambiguity in stored data
- Cross-timezone queries just work

### 2. Advisory Locks (Not Row-Level Locks)
```sql
SELECT pg_advisory_xact_lock($parentIdHash)
```
- **Per-parent scoping**: Different parents are never blocked by each other
- **Auto-release**: Lock releases when transaction ends (commit or rollback)
- **No table-level contention**: Unlike `SELECT FOR UPDATE` on offerings

### 3. SERIALIZABLE Isolation
Prevents phantom reads: if another transaction inserts a conflicting booking between our conflict-check and our INSERT, the transaction will fail and retry.

### 4. Overlap Detection Formula
```
Two sessions overlap if: A.startTime < B.endTime AND A.endTime > B.startTime
```
Back-to-back sessions (A.end === B.start) do NOT conflict.

### 5. Framework Choice: NestJS over Spring Boot
I chose NestJS (TypeScript/Node.js) over Spring Boot (Java). NestJS mirrors Spring Boot's modular architecture (Controllers, Services, Modules) and Dependency Injection features, providing the same enterprise-level code organization. However, NestJS offers higher development velocity, a single-language ecosystem (enabling the backend, frontend dashboard, and scripting all to be written in TypeScript), and an asynchronous non-blocking runtime that is highly efficient for concurrent I/O-bound operations like scheduling and booking. For a deeper breakdown of the decision, see **[DECISION.md](DECISION.md)**.

## Project Structure

```
src/
├── main.ts                          # Bootstrap, Swagger, pipes
├── app.module.ts                    # Root module with TypeORM config
├── common/
│   ├── common.module.ts             # Global module
│   ├── timezone.service.ts          # UTC ↔ local timezone conversion
│   ├── timezone.service.spec.ts     # Timezone tests
│   └── filters/
│       └── http-exception.filter.ts # Standardized error responses
├── entities/
│   ├── teacher.entity.ts
│   ├── course.entity.ts
│   ├── offering.entity.ts           # DRAFT/PUBLISHED/CANCELLED status
│   ├── session.entity.ts            # timestamptz, CHECK constraint
│   ├── parent.entity.ts
│   ├── booking.entity.ts            # Unique constraint on parent+offering
│   └── index.ts
├── teacher/
│   ├── teacher.module.ts
│   ├── teacher.controller.ts        # Swagger-documented endpoints
│   ├── teacher.service.ts           # Session TZ conversion on create
│   └── dto/
├── booking/
│   ├── booking.module.ts
│   ├── booking.controller.ts
│   ├── booking.service.ts           # Advisory locks + conflict detection
│   ├── conflict-detection.spec.ts   # Conflict algorithm tests
│   └── dto/
├── course/
│   ├── course.module.ts
│   ├── course.controller.ts
│   └── course.service.ts
└── database/
    └── seed.ts                      # Realistic demo data
```

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | NestJS | Modular architecture, TypeScript-first |
| ORM | TypeORM | Decorator-based, migration support |
| Database | PostgreSQL | Advisory locks, SERIALIZABLE isolation |
| Timezone | luxon | IANA timezone support, lightweight |
| Validation | class-validator | DTO-based, integrates with NestJS pipes |
| API Docs | Swagger | Auto-generated, interactive testing |
