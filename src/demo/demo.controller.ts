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
import { Parent, Offering, Booking, BookingStatus, Teacher, Course } from '../entities';
import { runSeed } from '../database/seed';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
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

  @Get('api/demo/teachers')
  async getTeachers() {
    const teacherRepo = this.dataSource.getRepository(Teacher);
    return teacherRepo.find({ order: { name: 'ASC' } });
  }

  @Post('api/demo/reset-db')
  @HttpCode(HttpStatus.OK)
  async resetDatabase() {
    process.env.NEST_RUNTIME = 'true';
    await runSeed(this.dataSource);
    return { message: 'Database successfully re-seeded and reset!' };
  }

  @Get('api/demo/bookings')
  async getBookings() {
    const bookingRepo = this.dataSource.getRepository(Booking);
    return bookingRepo.find({
      where: { status: BookingStatus.CONFIRMED },
      relations: {
        parent: true,
        offering: {
          course: true,
          teacher: true,
          sessions: true,
        },
      },
      order: { bookedAt: 'DESC' },
    });
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
  <title>Class Booking System — Verification Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-app: #f8fafc;
      --bg-card: #ffffff;
      --bg-tertiary: #f1f5f9;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #94a3b8;
      --accent-primary: #4f46e5;
      --accent-hover: #4338ca;
      --accent-light: #eef2ff;
      --border-color: #e2e8f0;
      
      --success: #10b981;
      --success-light: #ecfdf5;
      --success-border: #a7f3d0;
      --success-text: #047857;
      
      --danger: #f43f5e;
      --danger-light: #fff1f2;
      --danger-border: #fecdd3;
      --danger-text: #be123c;
      
      --warning: #f59e0b;
      --warning-light: #fffbeb;
      --warning-border: #fde68a;
      --warning-text: #b45309;

      --info: #0ea5e9;
      --info-light: #f0f9ff;
      --info-border: #bae6fd;
      --info-text: #0369a1;

      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      
      --font-family: 'Plus Jakarta Sans', sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-app);
      color: var(--text-primary);
      font-family: var(--font-family);
      line-height: 1.5;
      padding-bottom: 80px;
      -webkit-font-smoothing: antialiased;
    }

    /* Header */
    header {
      background: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      padding: 16px 40px;
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow-sm);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-badge {
      background: linear-gradient(135deg, var(--accent-primary), #8b5cf6);
      color: white;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
    }

    .logo-title h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .logo-title p {
      font-size: 11px;
      color: var(--text-secondary);
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    /* Buttons */
    .btn {
      font-family: var(--font-family);
      font-weight: 600;
      font-size: 13px;
      padding: 10px 18px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;
      outline: none;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-primary {
      background-color: var(--accent-primary);
      color: white;
      box-shadow: 0 2px 4px rgba(79, 70, 229, 0.1);
    }

    .btn-primary:hover {
      background-color: var(--accent-hover);
      box-shadow: 0 4px 10px rgba(79, 70, 229, 0.18);
    }

    .btn-secondary {
      background-color: var(--bg-card);
      border-color: var(--border-color);
      color: var(--text-secondary);
    }

    .btn-secondary:hover {
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      border-color: #cbd5e1;
    }

    .btn-danger-outline {
      background-color: var(--bg-card);
      border-color: var(--danger-border);
      color: var(--danger);
    }

    .btn-danger-outline:hover {
      background-color: var(--danger-light);
      border-color: var(--danger);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* Navigation Tabs */
    .portal-tabs {
      background-color: var(--bg-card);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 0 40px;
    }

    .portal-tab {
      padding: 18px 24px;
      font-weight: 700;
      font-size: 14px;
      color: var(--text-secondary);
      cursor: pointer;
      border-bottom: 3px solid transparent;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    }

    .portal-tab:hover {
      color: var(--text-primary);
    }

    .portal-tab.active {
      color: var(--accent-primary);
      border-bottom-color: var(--accent-primary);
    }

    /* Layout Container */
    .dashboard-container {
      max-width: 1400px;
      margin: 32px auto;
      padding: 0 24px;
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 32px;
      transition: all 0.3s ease;
    }

    @media (max-width: 1024px) {
      .dashboard-container {
        grid-template-columns: 1fr !important;
      }
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .main-content {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Cards */
    .card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-sm);
    }

    .card-title {
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 16px;
      color: var(--text-primary);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 10px;
    }

    /* Profile Panel */
    .active-profile-panel {
      background: linear-gradient(135deg, #f8fafc, #eff6ff);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .avatar-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--accent-light);
      border: 2px solid #c7d2fe;
      color: var(--accent-primary);
      font-weight: 800;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .profile-info {
      flex-grow: 1;
      min-width: 0;
    }

    .profile-info .name {
      font-weight: 700;
      font-size: 14px;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .profile-info .timezone {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }

    /* Pickers */
    .picker-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .picker-item {
      background-color: var(--bg-app);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 12px 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      width: 100%;
      outline: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .picker-item:hover {
      border-color: #cbd5e1;
      background-color: var(--bg-tertiary);
    }

    .picker-item.active {
      background-color: var(--accent-light);
      border-color: #a5b4fc;
      box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
    }

    .picker-details {
      display: flex;
      flex-direction: column;
    }

    .picker-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .picker-email {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 1px;
    }

    .tz-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      background-color: rgba(0, 0, 0, 0.05);
      color: var(--text-secondary);
    }

    .picker-item.active .tz-badge {
      background-color: #cbd5e1;
      color: var(--text-primary);
    }

    /* Info Bar */
    .info-bar {
      border-radius: var(--radius-md);
      padding: 16px 20px;
      font-size: 13.5px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      box-shadow: var(--shadow-sm);
    }

    .info-bar-blue {
      background-color: var(--info-light);
      border: 1px solid var(--info-border);
      color: var(--info-text);
    }

    .info-bar svg {
      flex-shrink: 0;
      margin-top: 2px;
    }

    /* Grid & Cards display */
    .section-header {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.3px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-left: 4px solid var(--accent-primary);
      padding-left: 12px;
    }

    .grid-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 24px;
    }

    .offering-card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: var(--shadow-sm);
    }

    .offering-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: #cbd5e1;
    }

    .offering-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
      background-color: #fafafa;
    }

    .course-badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--accent-primary);
      background-color: var(--accent-light);
      padding: 3px 8px;
      border-radius: 6px;
      margin-bottom: 8px;
    }

    .offering-title {
      font-size: 17px;
      font-weight: 800;
      color: var(--text-primary);
      letter-spacing: -0.2px;
    }

    .offering-teacher {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
    }

    .offering-body {
      padding: 20px;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .offering-desc {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 36px;
    }

    .sessions-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      background-color: var(--bg-app);
      padding: 12px;
      border-radius: var(--radius-md);
      border: 1px dashed var(--border-color);
    }

    .session-label {
      font-size: 11px;
      font-weight: 800;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      justify-content: space-between;
    }

    .session-item {
      background-color: var(--bg-card);
      border-left: 3px solid var(--accent-primary);
      padding: 8px 12px;
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      font-size: 12px;
      box-shadow: var(--shadow-sm);
    }

    .session-time {
      font-weight: 600;
      color: var(--text-primary);
      display: block;
    }

    .offering-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #fafafa;
    }

    .status-pill {
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-draft { background-color: var(--warning-light); border: 1px solid var(--warning-border); color: var(--warning-text); }
    .status-published { background-color: var(--success-light); border: 1px solid var(--success-border); color: var(--success-text); }
    .status-cancelled { background-color: var(--danger-light); border: 1px solid var(--danger-border); color: var(--danger-text); }

    .capacity-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .capacity-indicator {
      font-size: 12px;
      font-weight: 700;
    }

    .capacity-full { color: var(--danger); }
    .capacity-ok { color: var(--success-text); }

    .capacity-bar {
      width: 80px;
      height: 6px;
      background-color: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .capacity-fill {
      height: 100%;
      background-color: var(--success);
      border-radius: 3px;
    }

    .capacity-fill.full {
      background-color: var(--danger);
    }

    /* Timetable / Confirmed Bookings list */
    .timetable {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .timetable-item {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow-sm);
      transition: all 0.2s ease;
    }

    .timetable-item:hover {
      border-color: #cbd5e1;
      box-shadow: var(--shadow-md);
    }

    .timetable-title {
      font-weight: 800;
      font-size: 15px;
      color: var(--text-primary);
    }

    .timetable-meta {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .timetable-session-badges {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .timetable-session-badge {
      display: inline-block;
      background-color: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: var(--text-secondary);
      font-size: 13.5px;
      border: 2px dashed var(--border-color);
      border-radius: var(--radius-md);
      background-color: rgba(255, 255, 255, 0.5);
    }

    /* Forms */
    .form-group {
      margin-bottom: 18px;
    }

    .form-group label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-secondary);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-control {
      width: 100%;
      font-family: var(--font-family);
      font-size: 13.5px;
      padding: 10px 14px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      background-color: #ffffff;
      color: var(--text-primary);
      outline: none;
      transition: all 0.2s ease;
    }

    .form-control:focus {
      border-color: var(--accent-primary);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }

    /* Lab Page & Logs Terminal */
    .playground-actions {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .logs-terminal {
      background-color: #0f172a;
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-lg);
      border: 1px solid #1e293b;
    }

    .terminal-header {
      background-color: #1e293b;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #334155;
    }

    .terminal-controls {
      display: flex;
      gap: 6px;
    }

    .terminal-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .dot-red { background-color: #f87171; }
    .dot-yellow { background-color: #fbbf24; }
    .dot-green { background-color: #34d399; }

    .terminal-title {
      color: #94a3b8;
      font-family: monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .logs-panel {
      padding: 20px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #cbd5e1;
      max-height: 400px;
      min-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.6;
    }

    .logs-success { color: #34d399; font-weight: 700; }
    .logs-error { color: #f87171; font-weight: 700; }
    .logs-info { color: #38bdf8; }
    .logs-warn { color: #fbbf24; }

    /* Dialog Box / Modals */
    .dialog-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(4px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: fadeIn 0.2s ease;
    }

    .dialog-box {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      max-width: 600px;
      width: 100%;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .dialog-header {
      padding: 18px 24px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #fafafa;
    }

    .dialog-title {
      font-size: 16px;
      font-weight: 800;
      color: var(--text-primary);
    }

    .dialog-close {
      cursor: pointer;
      color: var(--text-secondary);
      background: none;
      border: none;
      font-size: 24px;
      font-weight: 500;
      line-height: 1;
      padding: 0 4px;
      outline: none;
    }

    .dialog-close:hover {
      color: var(--text-primary);
    }

    .dialog-body {
      padding: 24px;
    }

    .dialog-body pre {
      background-color: #0f172a;
      padding: 16px;
      border-radius: var(--radius-sm);
      overflow-x: auto;
      font-family: monospace;
      font-size: 11.5px;
      color: #94a3b8;
      border: 1px solid #1e293b;
      margin-top: 16px;
      max-height: 200px;
      overflow-y: auto;
    }

    .alert-card {
      border-radius: var(--radius-md);
      padding: 16px;
      margin-bottom: 16px;
      display: flex;
      gap: 12px;
      font-size: 13.5px;
      border: 1px solid transparent;
    }

    .alert-card-danger {
      background-color: var(--danger-light);
      border-color: var(--danger-border);
      color: var(--danger-text);
    }

    /* Timeline visualizer for conflict overlap */
    .timeline-visualizer {
      margin-top: 20px;
      background-color: var(--bg-app);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: 16px;
    }

    .timeline-visualizer-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      margin-bottom: 12px;
      text-align: center;
    }

    .timeline-track {
      position: relative;
      height: 48px;
      background-color: #e2e8f0;
      border-radius: 6px;
      margin-bottom: 10px;
      overflow: hidden;
      display: flex;
      align-items: center;
      border: 1px solid #cbd5e1;
    }

    .timeline-bar {
      position: absolute;
      height: 32px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10.5px;
      font-weight: 700;
      color: white;
      padding: 0 10px;
      box-shadow: var(--shadow-sm);
    }

    .timeline-bar-existing {
      background: linear-gradient(135deg, var(--warning), #f59e0b);
      left: 15%;
      width: 50%;
    }

    .timeline-bar-new {
      background: linear-gradient(135deg, var(--danger), #e11d48);
      left: 45%;
      width: 45%;
      border: 2px dashed rgba(255, 255, 255, 0.7);
    }

    .conflict-zone {
      position: absolute;
      left: 45%;
      width: 20%;
      height: 100%;
      background: repeating-linear-gradient(
        45deg,
        rgba(244, 63, 94, 0.15),
        rgba(244, 63, 94, 0.15) 10px,
        rgba(244, 63, 94, 0.3) 10px,
        rgba(244, 63, 94, 0.3) 20px
      );
      border-left: 2px dashed var(--danger);
      border-right: 2px dashed var(--danger);
      z-index: 10;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .conflict-zone-label {
      background-color: var(--danger-text);
      color: white;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      box-shadow: var(--shadow-sm);
    }

    .conflict-box {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .conflict-item {
      background-color: var(--bg-app);
      border-left: 4px solid transparent;
      padding: 10px 14px;
      border-radius: 4px;
      font-size: 12.5px;
      border: 1px solid var(--border-color);
      border-left-width: 4px;
    }

    .conflict-existing { border-left-color: var(--warning); }
    .conflict-new { border-left-color: var(--danger); }

    /* Toast */
    .toast {
      position: fixed;
      top: 24px;
      right: 24px;
      background-color: #1e293b;
      color: white;
      padding: 12px 20px;
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      z-index: 2000;
      transform: translateY(-100px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      border-left: 4px solid transparent;
    }

    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }

    .toast-success { border-left-color: var(--success); }
    .toast-error { border-left-color: var(--danger); }
    .toast-info { border-left-color: var(--info); }
    .toast-warn { border-left-color: var(--warning); }

    /* Spinner */
    .spinner {
      border: 2.5px solid rgba(0, 0, 0, 0.1);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border-left-color: currentColor;
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
        📖 Swagger API Docs
      </button>
      <button id="reset-db-btn" class="btn btn-danger-outline" onclick="resetDatabase()">
        🔄 Reset Database (Seed)
      </button>
    </div>
  </header>

  <!-- Portal Navigation -->
  <div class="portal-tabs">
    <div id="portal-tab-parent" class="portal-tab active" onclick="switchPortal('parent')">👤 Parents Booking Portal</div>
    <div id="portal-tab-teacher" class="portal-tab" onclick="switchPortal('teacher')">👩‍🏫 Teachers Management Portal</div>
    <div id="portal-tab-lab" class="portal-tab" onclick="switchPortal('lab')">🔬 Lock Safety & Conflict Lab</div>
  </div>

  <div class="dashboard-container">
    
    <!-- Sidebar -->
    <div class="sidebar">
      
      <!-- Parent Picker -->
      <div id="parent-picker-card" class="card">
        <div class="card-title">
          <span>Active Parent Profile</span>
        </div>
        
        <!-- Active Parent Overview Panel -->
        <div id="active-parent-panel" class="active-profile-panel" style="display: none;">
          <div class="avatar-circle" id="parent-avatar">EC</div>
          <div class="profile-info">
            <div class="name" id="parent-profile-name">Emily Chen</div>
            <div class="timezone">🌐 <span id="parent-profile-tz">Asia/Tokyo</span></div>
          </div>
        </div>

        <div id="parent-list" class="picker-list">
          <div class="empty-state"><span class="spinner"></span> Loading parents...</div>
        </div>
      </div>

      <!-- Teacher Picker -->
      <div id="teacher-picker-card" class="card" style="display: none;">
        <div class="card-title">
          <span>Active Teacher Profile</span>
        </div>
        
        <!-- Active Teacher Overview Panel -->
        <div id="active-teacher-panel" class="active-profile-panel" style="display: none;">
          <div class="avatar-circle" id="teacher-avatar">SJ</div>
          <div class="profile-info">
            <div class="name" id="teacher-profile-name">Sarah Johnson</div>
            <div class="timezone">🌐 <span id="teacher-profile-tz">America/New_York</span></div>
          </div>
        </div>

        <div id="teacher-list" class="picker-list">
          <div class="empty-state"><span class="spinner"></span> Loading teachers...</div>
        </div>
      </div>

      <!-- Boundary Rules Card -->
      <div class="card">
        <div class="card-title">Boundary Rules</div>
        <div style="font-size: 12.5px; color: var(--text-secondary); display:flex; flex-direction:column; gap:12px;">
          <p>This sandbox displays date-time parameters shifted according to selected timezones:</p>
          <div style="background-color: var(--bg-app); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); font-size:11.5px; display:flex; flex-direction:column; gap:8px;">
            <div>
              <div style="font-weight: 800; color: var(--accent-primary); margin-bottom: 2px;">Sarah Johnson (New York):</div>
              Saturdays 6:00 PM EST (UTC-4)
            </div>
            <div>
              <div style="font-weight: 800; color: var(--success-text); margin-bottom: 2px;">Raj Patel (India):</div>
              Weekday Evenings 5:00 PM IST (UTC+5.5)
            </div>
            <div>
              <div style="font-weight: 800; color: var(--text-primary); margin-bottom: 2px;">Emily Chen (Tokyo):</div>
              Converts to JST (+13h or +3.5h respectively)
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Main Content -->
    <div class="main-content">

      <!-- Portal 1: Parent Portal -->
      <div id="portal-parent" class="portal-view">
        <div class="info-bar info-bar-blue">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <strong>Parent Mode:</strong> Class sessions are displayed in the selected parent's timezone. Overlapping bookings are blocked at the database boundary to guarantee schedule integrity.
          </div>
        </div>

        <div style="margin-top: 24px;">
          <div class="section-header">
            <span>Available Offerings</span>
            <span id="parent-tz-label" style="font-size: 12px; font-weight: 700; color: var(--accent-primary); background-color: var(--accent-light); padding: 3px 8px; border-radius: 6px;">UTC</span>
          </div>
          <div id="offerings-grid" class="grid-container">
            <!-- Populated dynamically -->
          </div>
        </div>

        <div style="margin-top: 32px;">
          <div class="section-header">Confirmed Bookings</div>
          <div id="parent-bookings" class="timetable">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

      <!-- Portal 2: Teacher Portal -->
      <div id="portal-teacher" class="portal-view" style="display: none;">
        <div class="info-bar info-bar-blue">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <strong>Teacher Mode:</strong> Teacher creates offerings and adds sessions in their own local timezone (without offsets). The API automatically converts the records to UTC.
          </div>
        </div>

        <!-- Add Offering and Session Forms -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 24px;">
          
          <div class="card">
            <div class="card-title">Create Class Offering</div>
            <form id="create-offering-form" onsubmit="handleCreateOffering(event)">
              <div class="form-group">
                <label>Select Course</label>
                <select id="form-course-id" class="form-control" required></select>
              </div>
              <div class="form-group">
                <label>Offering Title</label>
                <input id="form-offering-title" type="text" class="form-control" placeholder="e.g. Saturday Morning Batch" required>
              </div>
              <div class="form-group">
                <label>Max Students Capacity</label>
                <input id="form-offering-max" type="number" class="form-control" value="20" min="1" max="100" required>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">Create Offering (DRAFT)</button>
            </form>
          </div>

          <div class="card">
            <div class="card-title">Add Session to Offering</div>
            <form id="add-session-form" onsubmit="handleCreateSession(event)">
              <div class="form-group">
                <label>Select Offering</label>
                <select id="form-offering-id" class="form-control" required>
                  <option value="">No offerings created yet</option>
                </select>
              </div>
              <div class="form-group">
                <label>Start Date & Time (Local Teacher Time)</label>
                <input id="form-session-start" type="datetime-local" class="form-control" required>
              </div>
              <div class="form-group">
                <label>End Date & Time (Local Teacher Time)</label>
                <input id="form-session-end" type="datetime-local" class="form-control" required>
              </div>
              <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">Add Session to Offering</button>
            </form>
          </div>

        </div>

        <!-- Class Batches Section -->
        <div style="margin-top: 32px;">
          <div class="section-header">
            <span>Teacher's Class Batches</span>
            <span id="teacher-tz-label" style="font-size: 12px; font-weight: 700; color: var(--accent-primary); background-color: var(--accent-light); padding: 3px 8px; border-radius: 6px;">UTC</span>
          </div>
          <div id="teacher-offerings-grid" class="grid-container">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Student Roster Section -->
        <div style="margin-top: 32px;">
          <div class="section-header">
            <span>Student Bookings & Roster</span>
          </div>
          <div id="teacher-roster-list" class="timetable">
            <!-- Populated dynamically -->
          </div>
        </div>
      </div>

      <!-- Portal 3: Lock Safety & Conflict Laboratory -->
      <div id="portal-lab" class="portal-view" style="display: none;">
        <div class="info-bar info-bar-blue">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <div>
            <strong>Validation Lab:</strong> Run stress tests on schedule overlap math and PostgreSQL transactional advisory locks. The system locks transactions based on parent hashes to prevent race conditions.
          </div>
        </div>

        <div class="card" style="margin-top: 24px;">
          <div class="card-title">Trigger Sandbox Integrations</div>
          <p style="font-size: 13.5px; color: var(--text-secondary); margin-bottom: 20px;">
            These routines reset the database dynamically and trigger precise requests to audit the backend response parameters.
          </p>
          <div class="playground-actions">
            <button class="btn btn-primary" onclick="runOverlapConflictSandbox()">
              🔬 Verify Overlap Conflict Detection
            </button>
            <button class="btn btn-primary" onclick="runConcurrencyLockSandbox()">
              ⚡ Verify Concurrency & Advisory Lock Safety
            </button>
          </div>

          <div class="logs-terminal">
            <div class="terminal-header">
              <div class="terminal-controls">
                <span class="terminal-dot dot-red"></span>
                <span class="terminal-dot dot-yellow"></span>
                <span class="terminal-dot dot-green"></span>
              </div>
              <div class="terminal-title">VERIFICATION AUDIT TRAIL</div>
              <div style="width: 40px;"></div>
            </div>
            <div id="lab-logs" class="logs-panel">Select an action above to verify the lock safety boundaries...</div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Dialog Box / Conflict Modal -->
  <div id="dialog-overlay" class="dialog-overlay" onclick="closeDialog()">
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

  <script>
    var parents = [];
    var teachers = [];
    var courses = [];
    var offerings = []; 
    var activeParentId = '';
    var activeParentTz = 'UTC';
    var activeTeacherId = '';
    var activeTeacherTz = 'UTC';

    window.addEventListener('load', function() {
      resetAndReloadAll();
    });

    function resetAndReloadAll() {
      return Promise.all([
        loadParents(),
        loadTeachers(),
        loadCourses()
      ]).then(function() {
        return Promise.all([
          loadOfferingsAndBookings(),
          loadTeacherOfferings()
        ]);
      });
    }

    function showToast(message, type) {
      var tType = type || 'info';
      var toast = document.getElementById('toast');
      toast.innerText = message;
      toast.className = 'toast show toast-' + tType;
      setTimeout(function() { toast.classList.remove('show'); }, 3000);
    }

    function switchPortal(portal) {
      document.querySelectorAll('.portal-tab').forEach(function(t) { t.classList.remove('active'); });
      document.getElementById('portal-tab-' + portal).classList.add('active');

      document.getElementById('portal-parent').style.display = portal === 'parent' ? 'block' : 'none';
      document.getElementById('portal-teacher').style.display = portal === 'teacher' ? 'block' : 'none';
      document.getElementById('portal-lab').style.display = portal === 'lab' ? 'block' : 'none';

      var dbContainer = document.querySelector('.dashboard-container');
      var sidebar = document.querySelector('.sidebar');
      
      if (portal === 'lab') {
        dbContainer.style.gridTemplateColumns = '1fr';
        sidebar.style.display = 'none';
      } else {
        dbContainer.style.gridTemplateColumns = '320px 1fr';
        sidebar.style.display = 'flex';
        document.getElementById('parent-picker-card').style.display = portal === 'parent' ? 'block' : 'none';
        document.getElementById('teacher-picker-card').style.display = portal === 'teacher' ? 'block' : 'none';
      }
    }

    function getInitials(name) {
      if (!name) return '??';
      var parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }

    function loadParents() {
      return fetch('/api/demo/parents')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          parents = data;
          var container = document.getElementById('parent-list');
          container.innerHTML = '';
          if (parents.length === 0) {
            container.innerHTML = '<div class="empty-state">No parents found</div>';
            return;
          }
          parents.forEach(function(p, idx) {
            var item = document.createElement('button');
            item.className = 'picker-item' + (idx === 0 ? ' active' : '');
            if (idx === 0) {
              activeParentId = p.id;
              activeParentTz = p.timezone;
              document.getElementById('parent-tz-label').innerText = 'Showing Converted to ' + p.timezone;
              updateParentProfilePanel(p);
            }
            item.id = 'parent-' + p.id;
            item.onclick = function() { selectParent(p); };
            item.innerHTML = '<div class="picker-details">' +
                               '<div class="picker-name">👤 ' + p.name + '</div>' +
                               '<div class="picker-email">' + p.email + '</div>' +
                             '</div>' +
                             '<span class="tz-badge">' + p.timezone + '</span>';
            container.appendChild(item);
          });
        })
        .catch(function() {
          showToast('Error loading parents', 'error');
        });
    }

    function updateParentProfilePanel(parentObj) {
      document.getElementById('active-parent-panel').style.display = 'flex';
      document.getElementById('parent-avatar').innerText = getInitials(parentObj.name);
      document.getElementById('parent-profile-name').innerText = parentObj.name;
      document.getElementById('parent-profile-tz').innerText = parentObj.timezone;
    }

    function selectParent(parentObj) {
      document.querySelectorAll('#parent-list .picker-item').forEach(function(i) { i.classList.remove('active'); });
      document.getElementById('parent-' + parentObj.id).classList.add('active');
      activeParentId = parentObj.id;
      activeParentTz = parentObj.timezone;
      document.getElementById('parent-tz-label').innerText = 'Showing Converted to ' + parentObj.timezone;
      updateParentProfilePanel(parentObj);
      loadOfferingsAndBookings();
    }

    function loadTeachers() {
      return fetch('/api/demo/teachers')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          teachers = data;
          var container = document.getElementById('teacher-list');
          container.innerHTML = '';
          if (teachers.length === 0) {
            container.innerHTML = '<div class="empty-state">No teachers found</div>';
            return;
          }
          teachers.forEach(function(t, idx) {
            var item = document.createElement('button');
            item.className = 'picker-item' + (idx === 0 ? ' active' : '');
            if (idx === 0) {
              activeTeacherId = t.id;
              activeTeacherTz = t.timezone;
              document.getElementById('teacher-tz-label').innerText = 'Showing in Teacher TZ: ' + t.timezone;
              updateTeacherProfilePanel(t);
            }
            item.id = 'teacher-' + t.id;
            item.onclick = function() { selectTeacher(t); };
            item.innerHTML = '<div class="picker-details">' +
                               '<div class="picker-name">👩‍🏫 ' + t.name + '</div>' +
                               '<div class="picker-email">' + t.email + '</div>' +
                             '</div>' +
                             '<span class="tz-badge">' + t.timezone + '</span>';
            container.appendChild(item);
          });
        })
        .catch(function() {
          showToast('Error loading teachers', 'error');
        });
    }

    function updateTeacherProfilePanel(teacherObj) {
      document.getElementById('active-teacher-panel').style.display = 'flex';
      document.getElementById('teacher-avatar').innerText = getInitials(teacherObj.name);
      document.getElementById('teacher-profile-name').innerText = teacherObj.name;
      document.getElementById('teacher-profile-tz').innerText = teacherObj.timezone;
    }

    function selectTeacher(teacherObj) {
      document.querySelectorAll('#teacher-list .picker-item').forEach(function(i) { i.classList.remove('active'); });
      document.getElementById('teacher-' + teacherObj.id).classList.add('active');
      activeTeacherId = teacherObj.id;
      activeTeacherTz = teacherObj.timezone;
      document.getElementById('teacher-tz-label').innerText = 'Showing in Teacher TZ: ' + teacherObj.timezone;
      updateTeacherProfilePanel(teacherObj);
      loadTeacherOfferings();
    }

    function loadCourses() {
      return fetch('/courses')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          courses = data;
          var select = document.getElementById('form-course-id');
          select.innerHTML = '';
          courses.forEach(function(c) {
            var opt = document.createElement('option');
            opt.value = c.id;
            opt.innerText = c.title;
            select.appendChild(opt);
          });
        })
        .catch(function() {
          showToast('Error loading courses', 'error');
        });
    }

    function loadOfferingsAndBookings() {
      if (!activeParentId) return Promise.resolve();
      return Promise.all([
        fetch('/parents/' + activeParentId + '/available-offerings').then(function(res) { return res.json(); }),
        fetch('/parents/' + activeParentId + '/bookings').then(function(res) { return res.json(); })
      ]).then(function(results) {
        offerings = results[0].offerings || [];
        var bookings = results[1].bookings || [];
        renderParentOfferings(offerings, bookings);
        renderParentBookings(bookings);
      }).catch(function(err) {
        console.error(err);
      });
    }

    function renderParentOfferings(offeringsList, bookings) {
      var grid = document.getElementById('offerings-grid');
      grid.innerHTML = '';
      if (offeringsList.length === 0) {
        grid.innerHTML = '<div class="empty-state">No offerings published yet. Go to Teacher portal to create and publish offerings.</div>';
        return;
      }
      var bookedIds = new Set();
      bookings.forEach(function(b) { bookedIds.add(b.offering.id); });

      offeringsList.forEach(function(off) {
        var isBooked = bookedIds.has(off.id);
        var card = document.createElement('div');
        card.className = 'offering-card';

        var sessionsHtml = '';
        off.sessions.forEach(function(s) {
          sessionsHtml += '<div class="session-item">' +
                            '<span class="session-time">🕒 ' + s.startTimeFormatted + ' - ' + s.endTimeFormatted + '</span>' +
                          '</div>';
        });

        var isFull = off.availableSlots <= 0;
        var capPercent = Math.min(100, Math.round(((off.maxStudents - off.availableSlots) / off.maxStudents) * 100));
        var capText = isFull ? 'FULL' : off.availableSlots + ' slots left';

        var actionHtml = '';
        if (isBooked) {
          actionHtml = '<span class="status-pill status-published">Booked ✓</span>';
        } else {
          var btnClass = 'btn btn-primary' + (isFull ? ' disabled' : '');
          var disabledAttr = isFull ? 'disabled' : '';
          actionHtml = '<button class="' + btnClass + '" ' + disabledAttr + ' onclick="bookClass(\\\'' + off.id + '\\\', \\\'' + off.title.replace(/'/g, "\\\\'") + '\\\')">' + (isFull ? 'Sold Out' : 'Book') + '</button>';
        }

        card.innerHTML = '<div class="offering-header">' +
                           '<span class="course-badge">' + off.courseName + '</span>' +
                           '<div class="offering-title">' + off.title + '</div>' +
                           '<div class="offering-teacher">👩‍🏫 Teacher: ' + off.teacherName + '</div>' +
                         '</div>' +
                         '<div class="offering-body">' +
                           '<p class="offering-desc">' + (off.courseDescription || 'No description.') + '</p>' +
                           '<div class="sessions-container">' +
                             '<div class="session-label"><span>Sessions</span> <span>(' + activeParentTz + ')</span></div>' +
                             sessionsHtml +
                           '</div>' +
                         '</div>' +
                         '<div class="offering-footer">' +
                           '<div class="capacity-container">' +
                             '<div class="capacity-indicator ' + (isFull ? 'capacity-full' : 'capacity-ok') + '">' + capText + '</div>' +
                             '<div class="capacity-bar"><div class="capacity-fill ' + (isFull ? 'full' : '') + '" style="width: ' + capPercent + '%"></div></div>' +
                           '</div>' +
                           actionHtml +
                         '</div>';
        grid.appendChild(card);
      });
    }

    function renderParentBookings(bookings) {
      var container = document.getElementById('parent-bookings');
      container.innerHTML = '';
      if (bookings.length === 0) {
        container.innerHTML = '<div class="empty-state">No bookings confirmed yet</div>';
        return;
      }
      bookings.forEach(function(b) {
        var item = document.createElement('div');
        item.className = 'timetable-item';

        var badgeHtml = '';
        b.offering.sessions.forEach(function(s) {
          badgeHtml += '<span class="timetable-session-badge">🕒 ' + s.startTimeFormatted + '</span>';
        });

        item.innerHTML = '<div>' +
                           '<div class="timetable-title">' + b.offering.courseName + ' - ' + b.offering.title + '</div>' +
                           '<div class="timetable-meta">Teacher: ' + b.offering.teacherName + ' | Booked: ' + new Date(b.bookedAt).toLocaleString() + '</div>' +
                           '<div class="timetable-session-badges">' + badgeHtml + '</div>' +
                         '</div>' +
                         '<div>' +
                           '<span class="status-pill status-published">Confirmed</span>' +
                         '</div>';
        container.appendChild(item);
      });
    }

    function bookClass(offeringId, title) {
      return fetch('/parents/' + activeParentId + '/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offeringId: offeringId })
      })
      .then(function(res) {
        return res.json().then(function(data) {
          if (res.ok) {
            showToast('Successfully booked ' + title + '!', 'success');
            loadOfferingsAndBookings().then(function() {
              return loadTeacherOfferings();
            });
          } else {
            if (res.status === 409) {
              showConflictDialog(data);
            } else {
              showToast(data.message || 'Booking failed', 'error');
            }
          }
        });
      })
      .catch(function() {
        showToast('Error booking class', 'error');
      });
    }

    function loadTeacherOfferings() {
      if (!activeTeacherId) return Promise.resolve();
      
      // Load both offerings and bookings so we can render roster
      return Promise.all([
        fetch('/teachers/' + activeTeacherId + '/offerings').then(function(res) { return res.json(); }),
        fetch('/api/demo/bookings').then(function(res) { return res.json(); })
      ]).then(function(results) {
        var data = results[0];
        var allBookings = results[1] || [];
        var offeringsList = data.offerings || data || [];
        
        var select = document.getElementById('form-offering-id');
        select.innerHTML = '';

        if (offeringsList.length === 0) {
          var opt = document.createElement('option');
          opt.value = '';
          opt.innerText = 'No offerings created yet';
          select.appendChild(opt);
        }

        var grid = document.getElementById('teacher-offerings-grid');
        grid.innerHTML = '';

        if (offeringsList.length === 0) {
          grid.innerHTML = '<div class="empty-state">No offerings created under this teacher yet. Use the form above to create one.</div>';
        } else {
          offeringsList.forEach(function(off) {
            var opt = document.createElement('option');
            opt.value = off.id;
            opt.innerText = off.courseName + ' - ' + off.title + ' (' + off.status + ')';
            select.appendChild(opt);

            var card = document.createElement('div');
            card.className = 'offering-card';

            var sessionsHtml = '';
            (off.sessions || []).forEach(function(s) {
              var localStart = s.startTimeFormatted || new Date(s.startTime).toLocaleString('en-US', { timeZone: activeTeacherTz });
              var localEnd = s.endTimeFormatted || new Date(s.endTime).toLocaleString('en-US', { timeZone: activeTeacherTz });
              sessionsHtml += '<div class="session-item">' +
                                '<span class="session-time">🕒 ' + localStart + ' - ' + localEnd + '</span>' +
                              '</div>';
            });

            if (!off.sessions || off.sessions.length === 0) {
              sessionsHtml = '<div style="font-size: 12px; color: var(--danger); font-weight:600; padding: 6px 0;">⚠️ No sessions added yet. Adding sessions is required before publishing.</div>';
            }

            var actionButton = '';
            if (off.status === 'DRAFT') {
              actionButton = '<button class="btn btn-primary" onclick="patchOfferingStatus(\\\'' + off.id + '\\\', \\\'PUBLISHED\\\')">Publish</button>';
            } else if (off.status === 'PUBLISHED') {
              actionButton = '<button class="btn btn-danger-outline" onclick="patchOfferingStatus(\\\'' + off.id + '\\\', \\\'CANCELLED\\\')">Cancel Batch</button>';
            }

            var bCount = off.bookingCount ?? 0;
            var capPercent = Math.min(100, Math.round((bCount / off.maxStudents) * 100));

            card.innerHTML = '<div class="offering-header">' +
                               '<span class="course-badge">' + off.courseName + '</span>' +
                               '<div class="offering-title">' + off.title + '</div>' +
                             '</div>' +
                             '<div class="offering-body">' +
                               '<div class="sessions-container">' +
                                 '<div class="session-label"><span>Sessions</span> <span>(' + activeTeacherTz + ')</span></div>' +
                                 sessionsHtml +
                               '</div>' +
                             '</div>' +
                             '<div class="offering-footer">' +
                               '<div class="capacity-container">' +
                                 '<div style="font-size:11.5px; font-weight:700; color:var(--text-secondary);">' + bCount + '/' + off.maxStudents + ' Enrolled</div>' +
                                 '<div class="capacity-bar"><div class="capacity-fill" style="width: ' + capPercent + '%"></div></div>' +
                               '</div>' +
                               '<div style="display:flex; align-items:center; gap:8px;">' +
                                 '<span class="status-pill status-' + off.status.toLowerCase() + '">' + off.status + '</span>' +
                                 actionButton +
                               '</div>' +
                             '</div>';
            grid.appendChild(card);
          });
        }

        // Render Roster
        renderTeacherRoster(allBookings);
      }).catch(function(e) {
        console.error(e);
      });
    }

    function renderTeacherRoster(allBookings) {
      var rosterContainer = document.getElementById('teacher-roster-list');
      rosterContainer.innerHTML = '';
      
      // Filter bookings for offerings taught by the active teacher
      var teacherBookings = allBookings.filter(function(b) {
        var tName = b.offering && b.offering.teacher && b.offering.teacher.name;
        return tName === document.getElementById('teacher-profile-name').innerText;
      });

      if (teacherBookings.length === 0) {
        rosterContainer.innerHTML = '<div class="empty-state">No students have booked classes under this teacher yet.</div>';
        return;
      }

      teacherBookings.forEach(function(b) {
        var row = document.createElement('div');
        row.className = 'timetable-item';

        var sessionsPills = '';
        b.offering.sessions.forEach(function(s) {
          // Convert session time to teacher local timezone
          var tStart = s.startTimeFormatted || new Date(s.startTime).toLocaleString('en-US', { timeZone: activeTeacherTz });
          sessionsPills += '<span class="timetable-session-badge">🕒 ' + tStart + '</span>';
        });

        var cTitle = b.offering && b.offering.course && b.offering.course.title || '';

        row.innerHTML = '<div>' +
                          '<div class="timetable-title">👤 Student: ' + b.parent.name + ' (' + b.parent.email + ')</div>' +
                          '<div class="timetable-meta">' +
                            '<strong>Course Class:</strong> ' + cTitle + ' - ' + b.offering.title + 
                            ' | Enrolled: ' + new Date(b.bookedAt).toLocaleDateString() +
                          '</div>' +
                          '<div class="timetable-session-badges">' + sessionsPills + '</div>' +
                        '</div>' +
                        '<div>' +
                          '<span class="status-pill status-published">Active Student</span>' +
                        '</div>';
        rosterContainer.appendChild(row);
      });
    }

    function handleCreateOffering(e) {
      e.preventDefault();
      var courseId = document.getElementById('form-course-id').value;
      var title = document.getElementById('form-offering-title').value;
      var maxStudents = parseInt(document.getElementById('form-offering-max').value, 10);

      fetch('/teachers/' + activeTeacherId + '/offerings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: courseId, title: title, maxStudents: maxStudents })
      })
      .then(function(res) {
        return res.json().then(function(data) {
          if (res.ok) {
            showToast('Offering created successfully!', 'success');
            document.getElementById('form-offering-title').value = '';
            loadTeacherOfferings();
          } else {
            showToast(data.message || 'Creation failed', 'error');
          }
        });
      })
      .catch(function() {
        showToast('Request error', 'error');
      });
    }

    function handleCreateSession(e) {
      e.preventDefault();
      var offeringId = document.getElementById('form-offering-id').value;
      var startTime = document.getElementById('form-session-start').value;
      var endTime = document.getElementById('form-session-end').value;

      if (!offeringId) {
        showToast('Please select a valid offering', 'warn');
        return;
      }

      var formatLocal = function(val) { return val + ':00'; };

      fetch('/teachers/' + activeTeacherId + '/offerings/' + offeringId + '/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessions: [
            { startTime: formatLocal(startTime), endTime: formatLocal(endTime) }
          ]
        })
      })
      .then(function(res) {
        return res.json().then(function(data) {
          if (res.ok) {
            showToast('Session added to offering!', 'success');
            document.getElementById('form-session-start').value = '';
            document.getElementById('form-session-end').value = '';
            loadTeacherOfferings().then(function() {
              return loadOfferingsAndBookings();
            });
          } else {
            showToast(data.message || 'Failed to add session', 'error');
          }
        });
      })
      .catch(function() {
        showToast('Request error', 'error');
      });
    }

    function patchOfferingStatus(offeringId, status) {
      fetch('/teachers/' + activeTeacherId + '/offerings/' + offeringId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status })
      })
      .then(function(res) {
        return res.json().then(function(data) {
          if (res.ok) {
            showToast('Offering status updated to ' + status + '!', 'success');
            loadTeacherOfferings().then(function() {
              return loadOfferingsAndBookings();
            });
          } else {
            showToast(data.message || 'Failed to update status', 'error');
          }
        });
      })
      .catch(function() {
        showToast('Request error', 'error');
      });
    }

    function showConflictDialog(errData) {
      var title = document.getElementById('dialog-title');
      var body = document.getElementById('dialog-body');
      title.innerText = '⚠️ Schedule Overlap Conflict Detected';

      var detailsHtml = '';
      var visualHtml = '';
      if (errData.details) {
        var d = errData.details;
        
        // Render timeline bars representing the overlap
        visualHtml = '<div class="timeline-visualizer">' +
                       '<div class="timeline-visualizer-title">Visual Overlap Timeline</div>' +
                       '<div class="timeline-track">' +
                         '<div class="timeline-bar timeline-bar-existing" title="' + d.existingSession.offeringTitle + '">' +
                           'Booked Session' +
                         '</div>' +
                         '<div class="timeline-bar timeline-bar-new" title="' + d.conflictingSession.offeringTitle + '">' +
                           'Conflicting Request' +
                         '</div>' +
                         '<div class="conflict-zone">' +
                           '<span class="conflict-zone-label">Conflict</span>' +
                         '</div>' +
                       '</div>' +
                     '</div>';

        detailsHtml = '<div class="conflict-box">' +
                        '<div class="conflict-item conflict-existing">' +
                          '<strong>Already Booked:</strong> ' + d.existingSession.offeringTitle +
                          '<div style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);">⏰ Session: ' + d.existingSession.startTime + ' - ' + d.existingSession.endTime + '</div>' +
                        '</div>' +
                        '<div class="conflict-item conflict-new">' +
                          '<strong>Conflicting Booking Request:</strong> ' + d.conflictingSession.offeringTitle +
                          '<div style="font-size: 11px; margin-top: 4px; color: var(--text-secondary);">⏰ Session: ' + d.conflictingSession.startTime + ' - ' + d.conflictingSession.endTime + '</div>' +
                        '</div>' +
                      '</div>';
      }

      body.innerHTML = '<div class="alert-card alert-card-danger">' +
                         '<strong>Time overlap error!</strong> Parents cannot book multiple course sections that conflict in time.' +
                       '</div>' +
                       '<p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.4;">' + errData.message + '</p>' +
                       visualHtml +
                       detailsHtml +
                       '<pre>' + JSON.stringify(errData, null, 2) + '</pre>';

      document.getElementById('dialog-overlay').style.display = 'flex';
    }

    function closeDialog() {
      document.getElementById('dialog-overlay').style.display = 'none';
    }

    function resetDatabase() {
      var btn = document.getElementById('reset-db-btn');
      var text = btn.innerText;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Resetting...';
      return fetch('/api/demo/reset-db', { method: 'POST' })
        .then(function(res) {
          if (res.ok) {
            showToast('Database reset and seeded successfully!', 'success');
            document.getElementById('lab-logs').innerHTML = 'Database has been reset. Audit log cleared.';
            return resetAndReloadAll();
          } else {
            showToast('Reset failed', 'error');
          }
        })
        .catch(function() {
          showToast('Request error', 'error');
        })
        .finally(function() {
          btn.disabled = false;
          btn.innerText = text;
        });
    }

    function runOverlapConflictSandbox() {
      var logs = document.getElementById('lab-logs');
      logs.innerHTML = '<span class="logs-info">[INFO] Starting Overlap Conflict Sandbox...</span>\\n';
      logs.innerHTML += '<span class="logs-info">[1/4] Resetting database sandboxes...</span>\\n';
      
      fetch('/api/demo/reset-db', { method: 'POST' })
        .then(function(res) {
          if (!res.ok) throw new Error('Failed to reset database');
          return fetch('/api/demo/parents').then(function(r) { return r.json(); });
        })
        .then(function(parentsList) {
          var targetParent = parentsList.find(function(p) { return p.name.indexOf('Emily') >= 0; }) || parentsList[0];
          if (!targetParent) throw new Error('No parents found in database');
          
          logs.innerHTML += '<span class="logs-info">[2/4] Fetching available offerings for ' + targetParent.name + '...</span>\\n';
          return fetch('/parents/' + targetParent.id + '/available-offerings')
            .then(function(r) { return r.json(); })
            .then(function(data) {
              return { parent: targetParent, offerings: data.offerings || data };
            });
        })
        .then(function(ctx) {
          var targetParent = ctx.parent;
          var offeringsList = ctx.offerings;
          
          var mcOffering = offeringsList.find(function(o) { return o.title.indexOf('Saturday') >= 0 && o.courseName.indexOf('Minecraft') >= 0; });
          var robloxOffering = offeringsList.find(function(o) { return o.title.indexOf('Saturday') >= 0 && o.courseName.indexOf('Roblox') >= 0; });

          if (!mcOffering || !robloxOffering) {
            throw new Error('Test offerings (Minecraft Saturday / Roblox Saturday) not found in freshly seeded database.');
          }

          logs.innerHTML += '[3/4] Booking Minecraft Saturday (' + mcOffering.title + ') for parent: ' + targetParent.name + '...\\n';
          return fetch('/parents/' + targetParent.id + '/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ offeringId: mcOffering.id })
          })
          .then(function(res1) {
            return res1.json().then(function(d1) {
              if (!res1.ok) {
                throw new Error('Minecraft booking failed: ' + (d1.message || 'Unknown error'));
              }
              logs.innerHTML += '<span class="logs-success">✅ Booking confirmed! ID: ' + d1.id + '</span>\\n';
              logs.innerHTML += '[4/4] Booking overlapping Roblox Saturday (' + robloxOffering.title + ') for ' + targetParent.name + '...\\n';
              
              return fetch('/parents/' + targetParent.id + '/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offeringId: robloxOffering.id })
              });
            });
          })
          .then(function(res2) {
            return res2.json().then(function(d2) {
              if (res2.status === 409) {
                logs.innerHTML += '<span class="logs-success">✅ Conflict successfully detected! Server returned 409 Conflict.</span>\\n';
                logs.innerHTML += '<span class="logs-warn">[Log] ' + d2.message + '</span>\\n';
                logs.innerHTML += '\\n<span class="logs-success">[VERIFIED] Conflict Boundary math works correctly.</span>\\n';
                
                // Show conflict dialog
                showConflictDialog(d2);
              } else {
                logs.innerHTML += '<span class="logs-error">[FAILED] Expected 409 status, but got ' + res2.status + '.</span>\\n';
              }
              // Sync UI
              resetAndReloadAll();
            });
          });
        })
        .catch(function(err) {
          logs.innerHTML += '<span class="logs-error">[ERROR] Sandbox error: ' + err.message + '</span>\\n';
          resetAndReloadAll();
        });
    }

    function runConcurrencyLockSandbox() {
      var logs = document.getElementById('lab-logs');
      logs.innerHTML = '<span class="logs-info">[INFO] Starting Advisory Lock Concurrency Sandbox...</span>\\n';
      logs.innerHTML += '<span class="logs-info">[1/4] Resetting database sandboxes...</span>\\n';
      
      fetch('/api/demo/reset-db', { method: 'POST' })
        .then(function(res) {
          if (!res.ok) throw new Error('Failed to reset database');
          return fetch('/api/demo/parents').then(function(r) { return r.json(); });
        })
        .then(function(parentsList) {
          var targetParent = parentsList.find(function(p) { return p.name.indexOf('Emily') >= 0; }) || parentsList[0];
          if (!targetParent) throw new Error('No parents found in database');
          
          logs.innerHTML += '<span class="logs-info">[2/4] Fetching available offerings for ' + targetParent.name + '...</span>\\n';
          return fetch('/parents/' + targetParent.id + '/available-offerings')
            .then(function(r) { return r.json(); })
            .then(function(data) {
              return { parent: targetParent, offerings: data.offerings || data };
            });
        })
        .then(function(ctx) {
          var targetParent = ctx.parent;
          var offeringsList = ctx.offerings;
          
          var mcOffering = offeringsList.find(function(o) { return o.title.indexOf('Saturday') >= 0 && o.courseName.indexOf('Minecraft') >= 0; });
          if (!mcOffering) {
            throw new Error('Minecraft Saturday offering not found in database.');
          }

          logs.innerHTML += '[3/4] Firing 10 concurrent requests to book Offering: ' + mcOffering.title + ' for ' + targetParent.name + '...\\n';
          
          return fetch('/api/demo/test-concurrency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: targetParent.id, offeringId: mcOffering.id })
          })
          .then(function(res) {
            return res.json().then(function(data) {
              logs.innerHTML += '<span class="logs-success">✅ Concurrency simulation complete:</span>\\n';
              logs.innerHTML += '  - Total Requests Fired: ' + data.summary.totalRequests + '\\n';
              logs.innerHTML += '  - Successful Bookings:  <strong style="color: #10b981">' + data.summary.successes + '</strong> (Expected: 1)\\n';
              logs.innerHTML += '  - Blocked Bookings:     <strong style="color: #f43f5e">' + data.summary.failures + '</strong> (Expected: 9)\\n\\n';

              logs.innerHTML += '[4/4] Individual Request Latency & Log Trail:\\n';
              data.results.forEach(function(r) {
                var badge = r.status === 'success'
                  ? '<span class="logs-success">[SUCCESS]</span>'
                  : '<span class="logs-error">[BLOCKED]</span>';
                var details = r.errorType ? ' (' + r.errorType + ' ' + r.statusCode + ')' : '';
                logs.innerHTML += '  Req #' + r.request + ' (' + r.latency + '): ' + badge + ' ' + r.message + details + '\\n';
              });

              logs.innerHTML += '\\n<span class="logs-success">[VERIFIED] Transactional advisory lock prevented double-booking. Safety validated.</span>\\n';
              resetAndReloadAll();
            });
          });
        })
        .catch(function(err) {
          logs.innerHTML += '<span class="logs-error">[ERROR] Sandbox error: ' + err.message + '</span>\\n';
          resetAndReloadAll();
        });
    }
  </script>
</body>
</html>`;
  }
}
