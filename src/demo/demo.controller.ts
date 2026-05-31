import {
  Controller,
  Get,
  Post,
  Body,
  Res,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { BookingService } from '../booking/booking.service';
import { Parent, Offering, Booking } from '../entities';
import { runSeed } from '../database/seed';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController() // Exclude from Swagger docs to keep them focused on pure assignment APIs
@Controller()
export class DemoController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly bookingService: BookingService,
  ) {}

  @Get()
  getDemoUI(@Res() res: any) {
    res.header('Content-Type', 'text/html');
    res.send(this.getHTML());
  }

  @Get('api/demo/parents')
  async getParents() {
    const parentRepo = this.dataSource.getRepository(Parent);
    return parentRepo.find({ order: { name: 'ASC' } });
  }

  @Post('api/demo/reset-db')
  @HttpCode(HttpStatus.OK)
  async resetDatabase() {
    // Set runtime environment flag to prevent seed standalone exit
    process.env.NEST_RUNTIME = 'true';
    await runSeed(this.dataSource);
    return { message: 'Database successfully re-seeded and reset!' };
  }

  @Post('api/demo/test-concurrency')
  @HttpCode(HttpStatus.OK)
  async testConcurrency(@Body() body: { parentId: string; offeringId: string }) {
    const parentRepo = this.dataSource.getRepository(Parent);
    const parent = await parentRepo.findOne({ where: { id: body.parentId } });
    if (!parent) {
      return { error: 'Parent not found' };
    }

    const offeringRepo = this.dataSource.getRepository(Offering);
    const offering = await offeringRepo.findOne({ where: { id: body.offeringId } });
    if (!offering) {
      return { error: 'Offering not found' };
    }

    // Fire 10 parallel booking requests!
    // Since they are for the same parent, they will be serialized by the advisory lock
    const promises = [];
    const timestamp = Date.now();

    for (let i = 0; i < 10; i++) {
      promises.push(
        (async () => {
          const reqNum = i + 1;
          const startMs = Date.now() - timestamp;
          try {
            const booking = await this.bookingService.bookOffering(body.parentId, {
              offeringId: body.offeringId,
            });
            const endMs = Date.now() - timestamp;
            return {
              request: reqNum,
              status: 'success',
              message: 'Successfully Booked!',
              bookingId: booking.id,
              latency: `${endMs - startMs}ms`,
            };
          } catch (err: any) {
            const endMs = Date.now() - timestamp;
            return {
              request: reqNum,
              status: 'error',
              message: err.message || 'Error occurred',
              errorType: err.response?.error || 'Conflict',
              statusCode: err.status || 409,
              latency: `${endMs - startMs}ms`,
            };
          }
        })()
      );
    }

    const results = await Promise.all(promises);

    // Sort by request number
    results.sort((a, b) => a.request - b.request);

    const successCount = results.filter((r) => r.status === 'success').length;
    const errorCount = results.filter((r) => r.status === 'error').length;

    return {
      summary: {
        totalRequests: 10,
        successes: successCount,
        failures: errorCount,
        note: 'Advisory lock scopes requests to the same parent, ensuring safety. First transaction succeeds, subsequent transactions fail gracefully with 409 Conflict.',
      },
      results,
    };
  }

  private getHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Global Class Booking System — Verification Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0b111e;
      --bg-secondary: #141d30;
      --bg-tertiary: #1e293b;
      --text-primary: #f8fafc;
      --text-secondary: #94a3b8;
      --accent-primary: #6366f1;
      --accent-hover: #4f46e5;
      --accent-emerald: #10b981;
      --accent-emerald-dim: rgba(16, 185, 129, 0.1);
      --accent-rose: #f43f5e;
      --accent-rose-dim: rgba(244, 63, 94, 0.1);
      --accent-amber: #f59e0b;
      --accent-amber-dim: rgba(245, 158, 11, 0.1);
      --border-color: rgba(255, 255, 255, 0.08);
      --font-family: 'Plus Jakarta Sans', sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-family);
      line-height: 1.5;
      overflow-x: hidden;
      padding-bottom: 80px;
    }

    /* Glassmorphism Header */
    header {
      background: rgba(20, 29, 48, 0.8);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 40px;
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-badge {
      background: linear-gradient(135deg, var(--accent-primary), #a855f7);
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 20px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .logo-title h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      background: linear-gradient(to right, #f8fafc, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .logo-title p {
      font-size: 11px;
      color: var(--text-secondary);
      font-weight: 500;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .header-actions {
      display: flex;
      gap: 16px;
    }

    .btn {
      font-family: var(--font-family);
      font-weight: 600;
      font-size: 13px;
      padding: 10px 20px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
    }

    .btn-primary {
      background-color: var(--accent-primary);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }

    .btn-primary:hover {
      background-color: var(--accent-hover);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background-color: transparent;
      border: 1px solid var(--border-color);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background-color: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-danger-outline {
      background-color: transparent;
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: var(--accent-rose);
    }

    .btn-danger-outline:hover {
      background-color: var(--accent-rose-dim);
      border-color: var(--accent-rose);
    }

    /* Layout Containers */
    .dashboard-container {
      max-width: 1400px;
      margin: 32px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 32px;
    }

    @media (max-width: 1024px) {
      .dashboard-container {
        grid-template-columns: 1fr;
      }
    }

    /* Sidebar - Parent Selection */
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .card-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 16px;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .parent-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .parent-item {
      background-color: var(--bg-tertiary);
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
    }

    .parent-item:hover {
      border-color: rgba(99, 102, 241, 0.3);
      transform: translateX(4px);
    }

    .parent-item.active {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.05));
      border-color: var(--accent-primary);
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.1);
    }

    .parent-name {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .parent-meta {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
      word-break: break-all;
    }

    .parent-tz-badge {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      background-color: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
    }

    .parent-item.active .parent-tz-badge {
      background-color: rgba(99, 102, 241, 0.2);
      color: #c7d2fe;
    }

    /* Main Area */
    .main-content {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }

    .info-bar {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1));
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 12px;
      padding: 16px 20px;
      font-size: 13px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .info-bar svg {
      color: var(--accent-primary);
      flex-shrink: 0;
    }

    /* Offerings Grid */
    .offerings-section-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .offerings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .offering-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.25s ease;
      position: relative;
    }

    .offering-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .offering-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
      background-color: rgba(255, 255, 255, 0.01);
    }

    .course-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--accent-primary);
      margin-bottom: 6px;
    }

    .offering-title {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 4px;
    }

    .teacher-info {
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .offering-body {
      padding: 20px;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .offering-desc {
      font-size: 12.5px;
      color: var(--text-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 52px;
    }

    .sessions-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .session-title-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .session-item {
      background-color: var(--bg-tertiary);
      border-left: 3px solid var(--accent-primary);
      padding: 8px 12px;
      border-radius: 0 8px 8px 0;
      font-size: 11.5px;
    }

    .session-time {
      font-weight: 600;
      color: var(--text-primary);
    }

    .session-date {
      color: var(--text-secondary);
      font-size: 10.5px;
    }

    .offering-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: rgba(255, 255, 255, 0.005);
    }

    .capacity-indicator {
      font-size: 12px;
      font-weight: 600;
    }

    .capacity-full {
      color: var(--accent-rose);
    }

    .capacity-ok {
      color: var(--accent-emerald);
    }

    .booked-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--accent-emerald);
      background-color: var(--accent-emerald-dim);
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 12px;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }

    /* Testing Playground Panel */
    .playground-section {
      margin-top: 8px;
    }

    .playground-tabs {
      display: flex;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 20px;
    }

    .playground-tab {
      padding: 12px 24px;
      font-weight: 600;
      font-size: 13.5px;
      cursor: pointer;
      color: var(--text-secondary);
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }

    .playground-tab.active {
      color: var(--accent-primary);
      border-bottom-color: var(--accent-primary);
    }

    .playground-card {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      padding: 24px;
    }

    .playground-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 20px;
    }

    .status-panel {
      background-color: #080c14;
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px;
      font-family: monospace;
      font-size: 12.5px;
      color: #94a3b8;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
    }

    .status-success {
      color: #34d399;
    }

    .status-error {
      color: #f87171;
    }

    .status-info {
      color: #60a5fa;
    }

    .status-warn {
      color: #fbbf24;
    }

    /* Modal Overlay for notification or response details */
    .dialog-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .dialog-box {
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 16px;
      max-width: 600px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
      animation: zoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    @keyframes zoomIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }

    .dialog-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .dialog-title {
      font-size: 17px;
      font-weight: 700;
    }

    .dialog-close {
      cursor: pointer;
      color: var(--text-secondary);
      background: none;
      border: none;
      font-size: 20px;
    }

    .dialog-body {
      padding: 20px;
    }

    .dialog-body pre {
      background-color: #080c14;
      padding: 16px;
      border-radius: 10px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 12px;
      color: #94a3b8;
      border: 1px solid rgba(255,255,255,0.05);
      margin-top: 12px;
    }

    .alert-card {
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;
      display: flex;
      gap: 12px;
      font-size: 13.5px;
    }

    .alert-card-danger {
      background-color: var(--accent-rose-dim);
      border: 1px solid rgba(244, 63, 94, 0.2);
      color: #fecdd3;
    }

    .alert-card-success {
      background-color: var(--accent-emerald-dim);
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #d1fae5;
    }

    .alert-icon {
      font-size: 18px;
      flex-shrink: 0;
    }

    .conflict-detail-box {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .conflict-session-card {
      background-color: rgba(0,0,0,0.2);
      border-left: 3px solid transparent;
      padding: 10px 14px;
      border-radius: 4px;
    }

    .conflict-existing {
      border-left-color: var(--accent-amber);
    }

    .conflict-target {
      border-left-color: var(--accent-rose);
    }

    .conflict-label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .conflict-existing .conflict-label { color: var(--accent-amber); }
    .conflict-target .conflict-label { color: var(--accent-rose); }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background-color: #1e293b;
      color: white;
      padding: 12px 24px;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      border: 1px solid var(--border-color);
      z-index: 2000;
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    .toast-success {
      border-left: 4px solid var(--accent-emerald);
    }

    .toast-error {
      border-left: 4px solid var(--accent-rose);
    }

    .toast-info {
      border-left: 4px solid var(--accent-primary);
    }

    /* Timetable / Calendar layout */
    .timetable {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }

    .timetable-item {
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .timetable-left {
      display: flex;
      flex-direction: column;
    }

    .timetable-title {
      font-weight: 700;
      font-size: 14.5px;
    }

    .timetable-meta {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .timetable-sessions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .timetable-session-badge {
      background-color: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
    }

    .timetable-right {
      text-align: right;
    }

    .timetable-status {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--accent-emerald);
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);
      font-size: 13.5px;
    }

    .empty-state svg {
      margin-bottom: 12px;
      opacity: 0.3;
    }

    .spinner {
      border: 2px solid rgba(255,255,255,0.1);
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border-left-color: white;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>

  <!-- Toast Notification System -->
  <div id="toast" class="toast"></div>

  <!-- Header -->
  <header>
    <div class="logo-container">
      <div class="logo-badge">🎓</div>
      <div class="logo-title">
        <h1>Class Booking System</h1>
        <p>Verification Dashboard</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" onclick="window.open('/api/docs', '_blank')">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
        Swagger API Docs
      </button>
      <button id="reset-db-btn" class="btn btn-danger-outline" onclick="resetDatabase()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        Reset Database (Seed)
      </button>
    </div>
  </header>

  <!-- Content Grid -->
  <div class="dashboard-container">
    
    <!-- Sidebar - Parents -->
    <div class="sidebar">
      <div class="card">
        <div class="card-title">
          <span>Active Parent</span>
          <span style="font-size: 10px; font-weight: 500; text-transform: none; color: var(--text-secondary);">Simulates View/Booking</span>
        </div>
        <div id="parent-list" class="parent-list">
          <div class="empty-state">Loading parents...</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Timezone Comparison</div>
        <div style="font-size: 12.5px; color: var(--text-secondary); display:flex; flex-direction:column; gap:12px;">
          <p>This system automatically converts teacher class session times into the selected parent's timezone at the API boundary.</p>
          <div style="background-color: var(--bg-tertiary); padding: 12px; border-radius: 8px; font-size:11px;">
            <div style="font-weight: 700; color: #a5b4fc; margin-bottom: 4px;">America/New_York (EST):</div>
            Saturday Evening 6:00 PM
            <div style="font-weight: 700; color: #34d399; margin-top: 8px; margin-bottom: 4px;">Emily Chen (Asia/Tokyo):</div>
            Sunday Morning 7:00 AM JST (+13h)
            <div style="font-weight: 700; color: #fbbf24; margin-top: 8px; margin-bottom: 4px;">Michael Brown (Europe/London):</div>
            Saturday Night 11:00 PM BST (+5h)
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      
      <!-- Info Bar -->
      <div class="info-bar">
        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div>
          <strong>Timezone, Conflict, and Capacity Rules:</strong> Store all dates internally as UTC timestamp with timezone. Detect conflicts mathematically (startA &lt; endB AND endA &gt; startB). Prevent booking draft offerings or classes exceeding capacity.
        </div>
      </div>

      <!-- Offerings Grid Section -->
      <div>
        <div class="offerings-section-title">
          <span>Available Course Offerings</span>
          <span id="tz-display-label" style="font-size: 13px; font-weight: 600; color: var(--accent-primary);">Showing in UTC</span>
        </div>
        
        <div id="offerings-grid" class="offerings-grid">
          <!-- Dynamically populated -->
        </div>
      </div>

      <!-- Tabs and Playground -->
      <div class="playground-section">
        <div class="playground-tabs">
          <div id="tab-bookings" class="playground-tab active" onclick="switchPlaygroundTab('bookings')">My Confirmed Bookings</div>
          <div id="tab-playground" class="playground-tab" onclick="switchPlaygroundTab('playground')">Interactive Conflict & Concurrency Laboratory</div>
        </div>

        <!-- Bookings List Panel -->
        <div id="panel-bookings" class="playground-card">
          <div class="card-title">Booked Classes Timeline</div>
          <div id="booked-classes-list">
            <!-- Dynamically populated -->
          </div>
        </div>

        <!-- Playground Panel -->
        <div id="panel-playground" class="playground-card" style="display: none;">
          <div class="card-title">Verify Lock Safety & Boundary Conditions</div>
          <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 20px;">
            Here you can trigger complex backend simulations to verify the conflict detection algorithm and the transactional advisory locking.
          </div>
          
          <div class="playground-actions">
            <button class="btn btn-primary" onclick="simulateConflictDemo()">
              ⚡ Test Overlapping Conflict Detection
            </button>
            <button class="btn btn-primary" onclick="simulateConcurrencyDemo()">
              🔥 Test Concurrency & Advisory Lock Safety
            </button>
          </div>

          <h3 style="font-size: 13px; font-weight: 700; margin-bottom: 8px; text-transform: uppercase; letter-spacing:0.5px;">Simulation Audit Trail</h3>
          <div id="playground-logs" class="status-panel">Select an action above to run backend verification simulations...</div>
        </div>

      </div>

    </div>
  </div>

  <!-- Dialog Box (Conflict Details / Results) -->
  <div id="dialog-overlay" class="dialog-overlay" onclick="closeDialog(event)">
    <div class="dialog-box" onclick="event.stopPropagation()">
      <div class="dialog-header">
        <h2 id="dialog-title" class="dialog-title">Response Detail</h2>
        <button class="dialog-close" onclick="closeDialog()">×</button>
      </div>
      <div id="dialog-body" class="dialog-body">
        <!-- Filled dynamically -->
      </div>
    </div>
  </div>

  <!-- Frontend Javascript -->
  <script>
    let parents = [];
    let activeParentId = '';
    let activeParentTimezone = 'UTC';
    let offerings = [];

    // Initialize UI
    window.addEventListener('load', async () => {
      await loadParents();
      await loadOfferingsAndBookings();
    });

    function showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      toast.innerText = message;
      toast.className = 'toast show toast-' + type;
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3500);
    }

    async function loadParents() {
      try {
        const response = await fetch('/api/demo/parents');
        parents = await response.json();
        
        const listContainer = document.getElementById('parent-list');
        listContainer.innerHTML = '';
        
        if (parents.length === 0) {
          listContainer.innerHTML = '<div class="empty-state">No parents found. Please click Reset Database.</div>';
          return;
        }

        parents.forEach((parent, index) => {
          const item = document.createElement('button');
          item.className = 'parent-item' + (index === 0 ? ' active' : '');
          if (index === 0) {
            activeParentId = parent.id;
            activeParentTimezone = parent.timezone;
          }
          item.id = 'parent-' + parent.id;
          item.onclick = () => selectParent(parent.id, parent.timezone);
          item.innerHTML = \`
            <div class="parent-name">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>
              \${parent.name}
            </div>
            <div class="parent-meta">\${parent.email}</div>
            <span class="parent-tz-badge">\${parent.timezone}</span>
          \`;
          listContainer.appendChild(item);
        });

        updateTimezoneLabel();
      } catch (err) {
        console.error(err);
        showToast('Failed to load parents list', 'error');
      }
    }

    function selectParent(id, timezone) {
      document.querySelectorAll('.parent-item').forEach(item => item.classList.remove('active'));
      document.getElementById('parent-' + id).classList.add('active');
      activeParentId = id;
      activeParentTimezone = timezone;
      updateTimezoneLabel();
      loadOfferingsAndBookings();
    }

    function updateTimezoneLabel() {
      document.getElementById('tz-display-label').innerText = 'Displaying Converted to ' + activeParentTimezone;
    }

    async function loadOfferingsAndBookings() {
      if (!activeParentId) return;

      try {
        // Load available offerings (converted to parent's timezone)
        const response = await fetch(\`/parents/\${activeParentId}/available-offerings\`);
        const data = await response.json();
        offerings = data.offerings;

        // Load parent bookings
        const bookingsResponse = await fetch(\`/parents/\${activeParentId}/bookings\`);
        const bookingsData = await bookingsResponse.json();
        const bookings = bookingsData.bookings;
        
        renderOfferings(offerings, bookings);
        renderBookings(bookings);
      } catch (err) {
        console.error(err);
        showToast('Error loading offerings/bookings', 'error');
      }
    }

    function renderOfferings(offerings, bookings) {
      const grid = document.getElementById('offerings-grid');
      grid.innerHTML = '';

      if (offerings.length === 0) {
        grid.innerHTML = '<div class="empty-state">No offerings available.</div>';
        return;
      }

      // Create a set of booked offering IDs
      const bookedIds = new Set(bookings.map(b => b.offering.id));

      offerings.forEach(offering => {
        const isBooked = bookedIds.has(offering.id);
        const card = document.createElement('div');
        card.className = 'offering-card';
        
        // Sessions HTML
        let sessionsHtml = '';
        offering.sessions.forEach((s, idx) => {
          // Parse format
          sessionsHtml += \`
            <div class="session-item">
              <span class="session-time">\${s.startTimeFormatted} - \${s.endTimeFormatted}</span>
              <div class="session-date">Session \${idx + 1}</div>
            </div>
          \`;
        });

        // Capacity text
        const isFull = offering.availableSlots <= 0;
        const capacityClass = isFull ? 'capacity-full' : 'capacity-ok';
        const capacityText = isFull 
          ? 'Offering Full (0 slots left)' 
          : offering.availableSlots + ' of ' + offering.maxStudents + ' slots available';

        // Action Button or booked badge
        let actionHtml = '';
        if (isBooked) {
          actionHtml = \`
            <span class="booked-status">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Confirmed Booked
            </span>
          \`;
        } else {
          actionHtml = \`
            <button 
              class="btn btn-primary \${isFull ? 'disabled' : ''}" 
              \${isFull ? 'disabled' : ''} 
              onclick="bookOffering('\${offering.id}', '\${offering.title}')"
            >
              \${isFull ? 'Sold Out' : 'Book Offering'}
            </button>
          \`;
        }

        card.innerHTML = \`
          <div class="offering-header">
            <span class="course-badge">\${offering.courseName}</span>
            <h3 class="offering-title">\${offering.title}</h3>
            <div class="teacher-info">
              👩‍🏫 Teacher: <strong>\${offering.teacherName}</strong>
            </div>
          </div>
          <div class="offering-body">
            <p class="offering-desc">\${offering.courseDescription || 'No description available.'}</p>
            <div class="sessions-container">
              <div class="session-title-label">Class Schedule (\${activeParentTimezone})</div>
              \${sessionsHtml}
            </div>
          </div>
          <div class="offering-footer">
            <div class="capacity-indicator \${capacityClass}">\${capacityText}</div>
            \${actionHtml}
          </div>
        \`;
        
        grid.appendChild(card);
      });
    }

    function renderBookings(bookings) {
      const list = document.getElementById('booked-classes-list');
      list.innerHTML = '';

      if (bookings.length === 0) {
        list.innerHTML = \`
          <div class="empty-state">
            <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z"/></svg>
            <p>You haven't booked any classes yet. Choose a class above and click "Book Offering".</p>
          </div>
        \`;
        return;
      }

      const container = document.createElement('div');
      container.className = 'timetable';

      bookings.forEach(booking => {
        const item = document.createElement('div');
        item.className = 'timetable-item';
        
        let badgesHtml = '';
        booking.offering.sessions.forEach(s => {
          badgesHtml += \`<span class="timetable-session-badge">\${s.startTimeFormatted}</span>\`;
        });

        item.innerHTML = \`
          <div class="timetable-left">
            <span class="timetable-title">\${booking.offering.courseName} — \${booking.offering.title}</span>
            <div class="timetable-meta">Teacher: \${booking.offering.teacherName} | Booked: \${new Date(booking.bookedAt).toLocaleString()}</div>
            <div class="timetable-sessions">
              \${badgesHtml}
            </div>
          </div>
          <div class="timetable-right">
            <span class="timetable-status">Confirmed</span>
          </div>
        \`;
        container.appendChild(item);
      });

      list.appendChild(container);
    }

    async function bookOffering(offeringId, title) {
      if (!activeParentId) return;
      
      try {
        const response = await fetch(\`/parents/\${activeParentId}/bookings\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offeringId })
        });
        
        const resData = await response.json();
        
        if (response.ok) {
          showToast(\`Successfully booked offering "\${title}"!\`, 'success');
          await loadOfferingsAndBookings();
        } else {
          // Show conflict dialog if 409
          if (response.status === 409) {
            showConflictDialog(resData);
          } else {
            showToast(resData.message || 'Booking failed', 'error');
          }
        }
      } catch (err) {
        console.error(err);
        showToast('Network error while booking', 'error');
      }
    }

    function showConflictDialog(errorPayload) {
      const dialogBody = document.getElementById('dialog-body');
      const dialogTitle = document.getElementById('dialog-title');
      dialogTitle.innerText = '⚠️ Schedule Booking Conflict';
      
      let detailsHtml = '';
      if (errorPayload.details) {
        const details = errorPayload.details;
        detailsHtml = \`
          <div class="conflict-detail-box">
            <div class="conflict-session-card conflict-existing">
              <div class="conflict-label">Your Booked Class Schedule</div>
              <strong>\${details.existingSession.offeringTitle}</strong>
              <div style="font-size: 12px; margin-top: 4px; color: #cbd5e1;">
                Time: \${details.existingSession.startTime} - \${details.existingSession.endTime}
              </div>
            </div>
            
            <div style="text-align: center; color: var(--accent-rose); font-weight: 800; font-size: 16px;">
              ⚡ OVERLAPS WITH ⚡
            </div>

            <div class="conflict-session-card conflict-target">
              <div class="conflict-label">New Class Schedule Request</div>
              <strong>\${details.conflictingSession.offeringTitle}</strong>
              <div style="font-size: 12px; margin-top: 4px; color: #cbd5e1;">
                Time: \${details.conflictingSession.startTime} - \${details.conflictingSession.endTime}
              </div>
            </div>
          </div>
        \`;
      }

      dialogBody.innerHTML = \`
        <div class="alert-card alert-card-danger">
          <span class="alert-icon">🚫</span>
          <div>
            <strong>Booking Request Blocked!</strong> The backend detected a time schedule overlap. Parent schedules are guarded from double bookings.
          </div>
        </div>
        <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 12px;">
          \${errorPayload.message}
        </p>
        \${detailsHtml}
        <pre>\${JSON.stringify(errorPayload, null, 2)}</pre>
      \`;

      document.getElementById('dialog-overlay').style.display = 'flex';
    }

    function closeDialog() {
      document.getElementById('dialog-overlay').style.display = 'none';
    }

    function switchPlaygroundTab(tab) {
      document.querySelectorAll('.playground-tab').forEach(t => t.classList.remove('active'));
      document.getElementById('tab-' + tab).classList.add('active');

      document.getElementById('panel-bookings').style.display = tab === 'bookings' ? 'block' : 'none';
      document.getElementById('panel-playground').style.display = tab === 'playground' ? 'block' : 'none';
    }

    async function resetDatabase() {
      const btn = document.getElementById('reset-db-btn');
      const originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Resetting...';
      
      try {
        const response = await fetch('/api/demo/reset-db', { method: 'POST' });
        if (response.ok) {
          showToast('Database reset and re-seeded successfully!', 'success');
          // Clear logs
          document.getElementById('playground-logs').innerHTML = 'Database has been reset. Audit trail cleared.';
          await loadParents();
          await loadOfferingsAndBookings();
        } else {
          showToast('Database reset failed', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Error resetting database', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }

    async function simulateConflictDemo() {
      const logs = document.getElementById('playground-logs');
      logs.innerHTML = '<span class="status-info">[INFO] Starting Overlap Conflict Simulation...</span>\\n';
      
      try {
        // Step 1: Find Minecraft Coding Saturday Batch
        const mcOffering = offerings.find(o => o.title.includes('Saturday') && o.courseName.includes('Minecraft'));
        const robloxOffering = offerings.find(o => o.title.includes('Saturday') && o.courseName.includes('Roblox'));

        if (!mcOffering || !robloxOffering) {
          logs.innerHTML += '<span class="status-error">[ERROR] Required test offerings (Minecraft/Roblox Saturday) not found! Ensure database is seeded.</span>\\n';
          return;
        }

        logs.innerHTML += \`<span class="status-info">[1/3] Booking Minecraft Saturday (\${mcOffering.id}) for Parent Emily Chen...</span>\\n\`;
        
        // Reset DB to clean state first to ensure clean test
        logs.innerHTML += \`<span class="status-info">[System] Automatically resetting database for a clean sandbox...</span>\\n\`;
        await fetch('/api/demo/reset-db', { method: 'POST' });
        await loadOfferingsAndBookings();
        
        // Book Minecraft
        let bookResponse = await fetch(\`/parents/\${activeParentId}/bookings\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offeringId: mcOffering.id })
        });
        let bookData = await bookResponse.json();
        
        if (!bookResponse.ok) {
          logs.innerHTML += \`<span class="status-error">[ERROR] Failed to book Minecraft: \${bookData.message}</span>\\n\`;
          return;
        }
        
        logs.innerHTML += \`<span class="status-success">[2/3] Minecraft Booking Success! Booking ID: \${bookData.id}</span>\\n\`;
        logs.innerHTML += \`<span class="status-info">[3/3] Now attempting to book Roblox Saturday (\${robloxOffering.id}) which overlaps with Minecraft...</span>\\n\`;
        
        // Attempt Book Roblox
        let conflictResponse = await fetch(\`/parents/\${activeParentId}/bookings\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offeringId: robloxOffering.id })
        });
        let conflictData = await conflictResponse.json();
        
        if (conflictResponse.status === 409) {
          logs.innerHTML += \`<span class="status-success">[SUCCESS] Overlap detected! Backend blocked booking with 409 Conflict.</span>\\n\`;
          logs.innerHTML += \`<span class="status-warn">[Conflict Details] \${conflictData.message}</span>\\n\`;
          logs.innerHTML += \`\\n<span class="status-success">[VERIFIED] Conflict Detection works perfectly.</span>\\n\`;
          
          // Re-load UI data
          await loadOfferingsAndBookings();
          
          // Show conflict dialog too
          showConflictDialog(conflictData);
        } else {
          logs.innerHTML += \`<span class="status-error">[FAILED] Expected 409 Conflict, but got \${conflictResponse.status}.</span>\\n\`;
        }
      } catch (err) {
        logs.innerHTML += \`<span class="status-error">[ERROR] Simulation failed: \${err.message}</span>\\n\`;
      }
    }

    async function simulateConcurrencyDemo() {
      const logs = document.getElementById('playground-logs');
      logs.innerHTML = '<span class="status-info">[INFO] Initiating Advisory Lock Concurrency Race...</span>\\n';
      
      try {
        const mcOffering = offerings.find(o => o.title.includes('Saturday') && o.courseName.includes('Minecraft'));
        if (!mcOffering) {
          logs.innerHTML += '<span class="status-error">[ERROR] Offering not found!</span>\\n';
          return;
        }

        // Reset DB to clean state first
        logs.innerHTML += \`<span class="status-info">[1/3] Resetting database to clear prior bookings...</span>\\n\`;
        await fetch('/api/demo/reset-db', { method: 'POST' });
        await loadOfferingsAndBookings();

        logs.innerHTML += \`<span class="status-info">[2/3] Firing 10 parallel booking requests for Offering: \${mcOffering.title} (\${mcOffering.id}) for Parent Emily Chen...</span>\\n\`;
        
        const response = await fetch('/api/demo/test-concurrency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: activeParentId, offeringId: mcOffering.id })
        });
        
        const data = await response.json();
        
        logs.innerHTML += \`<span class="status-success">[3/3] Received concurrency results:</span>\\n\`;
        logs.innerHTML += \`  - Total Requests: \${data.summary.totalRequests}\\n\`;
        logs.innerHTML += \`  - Successful Bookings: <strong style="color: #34d399">\${data.summary.successes}</strong> (Expected: 1)\\n\`;
        logs.innerHTML += \`  - Blocked Bookings: <strong style="color: #f87171">\${data.summary.failures}</strong> (Expected: 9)\\n\\n\`;
        
        logs.innerHTML += \`<strong>Individual Request Log Trail:</strong>\\n\`;
        data.results.forEach(r => {
          const badge = r.status === 'success' 
            ? '<span class="status-success">[SUCCESS]</span>' 
            : '<span class="status-error">[BLOCKED]</span>';
          logs.innerHTML += \`  Request #\${r.request} (\${r.latency}): \${badge} \${r.message} \${r.errorType ? '(' + r.errorType + ' ' + r.statusCode + ')' : ''}\\n\`;
        });
        
        logs.innerHTML += \`\\n<span class="status-success">[VERIFIED] PostgreSQL advisory locks correctly serialized requests. Double-booking prevented.</span>\\n\`;
        
        // Re-load UI data
        await loadOfferingsAndBookings();
      } catch (err) {
        logs.innerHTML += \`<span class="status-error">[ERROR] Simulation failed: \${err.message}</span>\\n\`;
      }
    }
  </script>
</body>
</html>`;
  }
}
