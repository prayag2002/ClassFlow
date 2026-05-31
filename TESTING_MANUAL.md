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

An interactive Single-Page Application (SPA) dashboard is served directly by the backend. It lets you test the system visually without configuring API clients or copying UUIDs.

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

### What You Can Test in the Dashboard:
* **Timezone Conversions**: Switch between the active parents in the left sidebar (**Emily Chen** in Tokyo JST and **Michael Brown** in London GMT). Notice how the session times for the classes under "Available Course Offerings" automatically shift to match the selected parent's timezone.
* **Booking Offerings**: Click **"Book Offering"** on any available class. The booking is confirmed instantly, slots are decremented, and the class is added to the **"My Confirmed Bookings"** tab.
* **Conflict Detection**: Book **"Minecraft Coding - Saturday Batch"** for Emily Chen, then attempt to book **"Roblox Game Design - Saturday Batch"**. The dashboard will display a red alert card showing the overlapping sessions, along with the raw 409 Conflict JSON response from the server.
* **Concurrency & Lock Safety**: Switch to the **"Interactive Conflict & Concurrency Laboratory"** tab and click **"Test Concurrency & Advisory Lock Safety"**. This triggers 10 parallel booking requests to the server at the exact same millisecond. The audit trail logs show that the first request succeeds while the other 9 are serialized and rejected with a 409 conflict, demonstrating active advisory lock protection.
* **Reset Database**: Click the red **"Reset Database (Seed)"** button in the header at any time to clear bookings and return the data to its initial pristine state.

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

### How to Test Endpoint Flows:
1. Run `npm run seed` to print the UUIDs for Teachers, Offerings, and Parents to your console.
2. Use the **Parent APIs** section in Swagger:
   * **Get Available Offerings**: `GET /parents/{parentId}/available-offerings` using a parent's UUID.
   * **Book an Offering**: `POST /parents/{parentId}/bookings` with the payload:
     ```json
     {
       "offeringId": "OFFERING-UUID-HERE"
     }
     ```
   * **Get Booked Classes**: `GET /parents/{parentId}/bookings` to view confirmed bookings.

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
This will output a code coverage report confirming the integrity of the timezone conversions and schedule overlap algorithms.
