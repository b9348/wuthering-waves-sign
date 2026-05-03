import { Hono } from 'hono';
import type { SignService } from '../services/signService.ts';
import type { AccountService } from '../services/accountService.ts';
import type { LogService } from '../services/logService.ts';
import type { ApiResponse, DashboardData } from '../types/index.ts';

export function createDashboardRouter(
  accountService: AccountService,
  signService: SignService,
  logService: LogService,
) {
  const app = new Hono();

  // 获取仪表盘数据
  app.get('/', (c) => {
    const accountStats = accountService.getStats();
    const todayStats = signService.getTodayStats();
    const recentLogs = logService.getRecentLogs(10);
    const recentSignRecords = signService.getRecentRecords(10);

    const data: DashboardData = {
      totalAccounts: accountStats.total,
      activeAccounts: accountStats.active,
      validAccounts: accountStats.valid,
      todaySigned: todayStats.signed,
      todayFailed: todayStats.failed,
      todayPending: todayStats.pending,
      recentLogs,
      recentSignRecords,
    };

    const response: ApiResponse<DashboardData> = {
      success: true,
      data,
      code: 200,
    };
    return c.json(response);
  });

  // 获取系统状态
  app.get('/status', (c) => {
    const accountStats = accountService.getStats();
    const todayStats = signService.getTodayStats();

    const status = {
      healthy: true,
      accounts: {
        total: accountStats.total,
        active: accountStats.active,
        valid: accountStats.valid,
      },
      today: {
        signed: todayStats.signed,
        failed: todayStats.failed,
        pending: todayStats.pending,
        completionRate: accountStats.active > 0 
          ? Math.round((todayStats.signed / accountStats.active) * 100) 
          : 0,
      },
      timestamp: new Date().toISOString(),
    };

    const response: ApiResponse<typeof status> = {
      success: true,
      data: status,
      code: 200,
    };
    return c.json(response);
  });

  return app;
}
