# Testing & Verification Manual

This document provides step-by-step instructions to test and verify the core requirements of the Class Booking System, including timezone conversion, conflict detection, capacity management, and concurrency safety.

Reviewers can verify the application using four different methods:
1. **Interactive Web Dashboard** (Highly Recommended for Non-Technical Evaluators)
2. **CLI Automated Verification Script** (Recommended for Command Line Evaluators)
3. **Interactive Swagger UI Endpoint** (For API Developer Evaluation)
4. **Automated Test Suite** (For Code Quality Evaluation)

---

## Prerequisites

Before testing, ensure you have:
1. Installed project dependencies:
   ```bash
   npm install
   ```
2. Started the PostgreSQL database:
   * **Using Docker**: `docker-compose up -d`
   * **Using Local Postgres**: Ensure you have a database named `class_booking` and your credentials in `.env` match.

---

## 1. Interactive Web Dashboard (Visual Testing)

An interactive Single-Page Application (SPA) dashboard is served directly by the backend at the root path (`/`). It is designed in a clean, professional **light mode** theme. It provides a visual playground to test and verify both Teacher and Parent APIs across timezones.

### Steps to Run:
1. Seed the database with sample data:
   ```bash
   npm run seed
   ```
2. Start the NestJS backend:
   ```bash
   npm run start:dev
   ```
3. Open your web browser and navigate to:
   ```
   http://localhost:3000/
   ```

### Tabs & Functional Portals:

#### A. Parents Booking Portal
* **Active Parent Selection**: Switch between **Emily Chen (Tokyo JST)** and **Michael Brown (London GMT)**. Notice how available class session times automatically shift to display in their local timezone.
* **Book Classes**: Book any available batch with a single click. The capacity slots decrement atomically, and the class appears in the parent's "Confirmed Bookings" section in their local timezone.
* **Overlap Alert Dialog**: Try booking overlapping classes. The backend blocks it with a `409 Conflict` and displays a detailed conflict dialog showing the specific booked session and the conflicting session that caused the overlap.

#### B. Teachers Management Portal
* **Active Teacher Selection**: Switch between **Sarah Johnson (New York EST)** and **Raj Patel (India IST)**.
* **Create Offering**: Create a new class batch (starts in DRAFT status) selecting from the available courses.
* **Add Sessions**: Add weekly sessions to any class batch. Select dates and times in the teacher's local timezone. The backend automatically translates these to UTC before database insertion.
* **Publish/Cancel Offerings**: Change offering status. DRAFT offerings are not visible to parents until they have at least one session and are published.

#### C. Lock Safety & Conflict Lab (Verification Sandbox)
* **Verify Overlap Conflict Detection**: Resets the database and attempts to book overlapping sessions. Validates that the backend math catches overlaps and throws a 409 status with conflict details.
* **Verify Concurrency & Advisory Lock Safety**: Resets the database and fires 10 parallel booking requests at the same millisecond for a parent. Validates that the advisory lock successfully serializes them, resulting in exactly 1 successful booking and 9 blocked requests (failures due to either advisory locks or serializable transaction boundaries).

---

## 2. CLI Automated Verification Script

A terminal-based verification script is provided to automate the entire testing sequence. It makes HTTP requests, prints step-by-step instructions, and validates the outputs.

### Steps to Run:
1. Make sure the backend server is running in a terminal window (`npm run start:dev`).
2. Open a new terminal window and run:
   ```bash
   npm run demo:cli
   ```

### Verification Flow Performed by the Script:
1. **Pings the Server**: Verifies the NestJS API is online.
2. **Resets Database**: Clears and seeds the database to guarantee clean conditions.
3. **Retrieves Seed Data**: Fetches the generated parent profiles.
4. **Validates Timezone Shifting**: Fetches class times for **Emily Chen (JST)** and **Michael Brown (GMT)**, showing how a Saturday class at 18:00 (Teacher timezone) shifts to 07:00 JST (+13h) and 23:00 GMT (+5h) respectively.
5. **Validates Conflict Detection**: Books the Minecraft Saturday Batch, attempts to book the overlapping Roblox Saturday Batch, and asserts that a `409 Conflict` is returned with full overlap details.
6. **Validates Advisory Lock Concurrency**: Fires 10 concurrent requests to book the same class for the same parent. Asserts that exactly 1 booking succeeds and 9 fail with a `409 Conflict`, logging latency and request numbers.

---

## 3. Interactive Swagger UI (Developer API Testing)

Swagger UI is configured to provide an interactive interface to execute raw API calls.

### Steps to Run:
1. Ensure the server is running (`npm run start:dev`).
2. Open your browser and navigate to:
   ```
   http://localhost:3000/api/docs
   ```

---

## 4. Automated Jest Test Suite

The codebase contains unit and integration tests covering the core business rules: conflict detection boundaries, UTC conversions, and session offsets.

### Run Unit Tests:
```bash
npm run test
```

### Run Tests with Code Coverage:
```bash
npm run test:cov
```
The Jest configuration is refined to exclude boilerplate code (entities, DTOs, modules, seeder/runner scripts), generating a clean, high-coverage report focusing exclusively on services and business logic algorithms.
