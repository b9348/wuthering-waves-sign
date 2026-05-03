import { Hono } from 'hono';
import type { SignService } from '../services/signService.ts';
import type { AccountService } from '../services/accountService.ts';
import type { LogService } from '../services/logService.ts';
import type { ApiResponse } from '../types/index.ts';

export function createSignRouter(
  signService: SignService,
  accountService: AccountService,
  logService: LogService,
) {
  const app = new Hono();

  // 执行所有账号签到
  app.post('/all', async (c) => {
    try {
      const result = await signService.signAllAccounts();
      
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        code: 200,
      };
      return c.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : '签到失败',
        code: 500,
      };
      return c.json(response, 500);
    }
  });

  // 批量签到
  app.post('/batch', async (c) => {
    try {
      const body = await c.req.json<{ accountIds: number[] }>();
      const result = await signService.signBatch(body.accountIds);
      
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        code: 200,
      };
      return c.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : '签到失败',
        code: 500,
      };
      return c.json(response, 500);
    }
  });

  // 单个账号签到
  app.post('/:id', async (c) => {
    try {
      const id = parseInt(c.req.param('id'));
      const account = accountService.getAccount(id);
      
      if (!account) {
        const response: ApiResponse = {
          success: false,
          message: '账号不存在',
          code: 404,
        };
        return c.json(response, 404);
      }

      const result = await signService.signAccount(account);
      
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        code: 200,
      };
      return c.json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : '签到失败',
        code: 500,
      };
      return c.json(response, 500);
    }
  });

  // 获取账号签到初始化数据
  app.get('/:id/init', async (c) => {
    const id = parseInt(c.req.param('id'));
    const result = await signService.getSignInitData(id);
    
    const response: ApiResponse<typeof result> = {
      success: result.success,
      data: result,
      message: result.message,
      code: result.success ? 200 : 400,
    };
    return c.json(response, result.success ? 200 : 400);
  });

  // 获取账号签到记录
  app.get('/:id/records', (c) => {
    const id = parseInt(c.req.param('id'));
    const limit = parseInt(c.req.query('limit') || '30');
    const records = signService.getSignRecords(id, limit);
    
    const response: ApiResponse<typeof records> = {
      success: true,
      data: records,
      code: 200,
    };
    return c.json(response);
  });

  // 获取账号签到统计
  app.get('/:id/stats', (c) => {
    const id = parseInt(c.req.param('id'));
    const stats = signService.getAccountSignStats(id);
    
    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      code: 200,
    };
    return c.json(response);
  });

  // 检查今日是否已签到
  app.get('/:id/check', (c) => {
    const id = parseInt(c.req.param('id'));
    const hasSigned = signService.hasSignedToday(id);
    
    const response: ApiResponse<{ hasSigned: boolean }> = {
      success: true,
      data: { hasSigned },
      code: 200,
    };
    return c.json(response);
  });

  // 获取今日签到统计
  app.get('/stats/today', (c) => {
    const stats = signService.getTodayStats();
    
    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      code: 200,
    };
    return c.json(response);
  });

  // 获取最近签到记录
  app.get('/records/recent', (c) => {
    const limit = parseInt(c.req.query('limit') || '10');
    const records = signService.getRecentRecords(limit);
    
    const response: ApiResponse<typeof records> = {
      success: true,
      data: records,
      code: 200,
    };
    return c.json(response);
  });

  return app;
}
