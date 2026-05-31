## **Backend Engineering Assignment** 

## **Global Class Offering Booking System** 

You are building a simplified backend service for a global live-learning platform where teachers conduct online classes for students across different countries and timezones. 

Each course/class can have multiple offerings (sections), and each offering contains multiple sessions. 

## **Problem Statement** 

## **Examples** 

## **Example 1 — Weekly Course** 

An 8-week course may have: 

- Every Saturday, 6 PM–7 PM for 8 weeks 

## **Example 2 — Summer Camp** 

A 5-day summer camp may have: 

- Monday–Friday, 5 PM–6 PM during the same week 

Teachers create offerings in their own timezone, while parents/students should view schedules in their local timezone. 

Your task is to design and implement a production-ready backend service for this workflow. 

## **Core Concepts** 

## **1. Course/Class** 

Examples: 

- Python Coding 

- Art Drawing Class 

- Public Speaking 

## **2. Offering / Section** 

A schedulable version of a course. 

Examples: 

- Saturday Batch 

- Weekday Summer Camp 

- Evening Batch 

Each offering contains multiple sessions. 

## **3. Sessions** 

Actual meeting times belonging to an offering. 

## **Example** 

Offering: 

- Minecraft Coding — Saturday Batch 

Sessions: 

- June 6 → 6 PM–7 PM 

- June 13 → 6 PM–7 PM 

- June 20 → 6 PM–7 PM 

## **Functional Requirements** 

## **1. Teacher APIs** 

Teachers should be able to: 

- Create an offering 

- Add sessions to the offering 

- View upcoming offerings and sessions 

Each session should contain: 

- Offering ID 

- Teacher ID 

- Start time 

- End time 

## **2. Parent APIs** 

Parents/students should be able to: 

- View available offerings 

- Book an offering 

- View booked offerings 

## **Important** 

Parents may belong to a different timezone than the teacher. 

Session timings shown to parents should appear correctly in the parent’s local timezone. 

## **Booking Rules** 

## **Rule 1 — Booking Happens at Offering Level** 

Parents book the entire offering, not individual sessions. 

## **Example** 

Booking an 8-week course means booking all 8 sessions together. 

## **Rule 2 — Time Conflict Locking** 

Once a parent books an offering, all session times belonging to that offering should become locked for that parent. 

The parent should NOT be able to book another offering that overlaps with ANY session timing already booked. 

## **Example** 

Parent books: 

- Minecraft Coding (Saturday Batch) 

- June 7 → 5 PM–6 PM 

- June 14 → 5 PM–6 PM 

- June 21 → 5 PM–6 PM 

Then the parent should NOT be able to book: 

- Roblox Game Design 

- June 14 → 5:30 PM–6:30 PM 

because one or more sessions overlap. 

## **Rule 3 — Concurrent Booking Handling** 

The system should correctly handle simultaneous booking attempts. 

## **Examples** 

- Multiple parents booking the same offering simultaneously 

- A parent attempting overlapping bookings through multiple requests 

Your solution should ensure: 

- Data consistency 

- Prevention of invalid bookings 

- Proper concurrency handling 

## **Technical Requirements** 

You may use: 

## **Preferred** 

- Java + Spring Boot 

## **OR** 

- Node.js / NestJS 

## **Database** 

- PostgreSQL 

- OR MySQL 

## **Expected APIs** 

## **Teacher APIs** 

- Create offering 

- Add sessions to offering 

- Get teacher offerings 

## **Parent APIs** 

- Get available offerings 

- Book offering 

- Get bookings 

## **Expectations** 

We are not looking for a very large project. 

We care more about: 

- Clean backend design 

- Correct handling of concurrency 

- Good database design 

- Proper timezone handling 

- Thoughtful error handling 

## **Evaluation Criteria** 

Your solution will be evaluated on: 

- API correctness 

- Database design 

- Code structure and readability 

- Handling of simultaneous booking requests 

- Timezone handling 

- Conflict detection logic 

- Error handling and validations 

- Overall engineering approach 

**Submission Guidelines -** - - https://docs.google.com/document/d/17Vxr4twczr3WwOqeyzjLBe8s WmylrI_a89 Eif4nX4/edit?tab=t.0 

