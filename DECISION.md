# Framework Selection Decision: NestJS over Spring Boot

This document presents the architectural rationale for choosing NestJS (TypeScript/Node.js) instead of Spring Boot (Java) as the core framework for the Global Class Offering Booking System.

---

## Rationale and Benefits

Selecting the right framework determines the velocity of feature delivery, the ease of code verification, and the runtime efficiency of the system. While Spring Boot is a robust enterprise standard, NestJS was selected as the optimal choice for this implementation.

### 1. Unified Ecosystem and Development Velocity
Using TypeScript (modern JavaScript) allows the entire project to share a single, consistent programming language. 
* **Seamless Integration**: The backend service, database migrations, automated E2E tests, CLI verification scripts, and the web-based verification interface are all written in the same language.
* **Reduced Friction**: A single-language stack removes context switching, simplifies package management, and speeds up the development cycle, allowing the entire system to be built, tested, and validated quickly.

### 2. High-Performance Asynchronous Concurrency
Class booking systems are highly I/O-bound, requiring frequent database lookups, schedule overlap checks, and transactional updates.
* **Non-Blocking Runtime**: Node.js handles I/O operations asynchronously using a single-threaded event loop. This non-blocking model allows the application to handle thousands of concurrent requests with minimal overhead.
* **Resource Optimization**: In contrast, traditional Spring Boot architectures allocate a dedicated thread per HTTP request. Under heavy concurrent booking loads, this leads to significant memory consumption and CPU context-switching overhead. NestJS keeps runtime memory usage extremely low (typically under 80MB) while maintaining high responsiveness.

### 3. Enterprise Structure Without Verbose Boilerplate
NestJS is heavily inspired by Spring Boot's design patterns, bringing Java's architectural discipline to the Node.js ecosystem.
* **Architectural Cleanliness**: The project uses a modular design with clear boundaries between Controllers, Services, and Repositories. It utilizes a built-in Dependency Injection container, ensuring the code is fully decoupled, structured, and easily testable.
* **Readability**: I get the benefit of a strongly typed, enterprise-grade architecture while writing clean, modern, and highly readable TypeScript code without the verbose syntax and boilerplate typically associated with Java.

### 4. Efficient Timezone and Schedule Manipulation
A core requirement of this platform is translating class schedules across varying global timezones (e.g., Eastern Time, India Standard Time, Japan Standard Time) on the fly.
* **Modern Datetime Ecosystem**: TypeScript's ecosystem offers libraries like Luxon, which provide direct, performant support for IANA timezones and parsing. This allows for straightforward timezone shifting and formatting without the heavy, verbose configuration patterns often required in JVM-based timezone serialization.

### 5. Unified Verification Tools
Serving the web-based visual verification dashboard directly from the root path (`/`) was highly simplified using NestJS. It allows serving static templates and API routes from a single, unified controller context, making validation immediate and self-contained.

---

## Rationale Matrix

| Evaluation Criteria | NestJS (Chosen) | Spring Boot (Alternative) |
|---|---|---|
| **Programming Language** | TypeScript | Java |
| **Concurrency Model** | Single-threaded, Async Event Loop | Multi-threaded, Thread-per-request |
| **Startup Time** | Under 1 second | 5 to 15 seconds |
| **Memory Footprint** | Extremely low (~40-80MB) | Medium-High (~250-512MB+) |
| **Code Verbosity** | Concise and readable | Verbose with boilerplate |
| **Project Unity** | Unified (backend, test scripts, and UI in TS) | Split (Java backend, separate JS for frontend) |
