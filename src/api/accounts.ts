import { Hono } from 'hono';
import type { AccountService } from '../services/accountService.ts';
import type { LogService } from '../services/logService.ts';
import type { ApiResponse, CreateAccountRequest, UpdateAccountRequest } from '../types/index.ts';

export function createAccountRouter(
  accountService: AccountService,
  logService: LogService,
) {
  const app = new Hono();

  // 获取所有账号
  app.get('/', (c) => {
    const accounts = accountService.getAllAccounts();
    const response: ApiResponse<typeof accounts> = {
      success: true,
      data: accounts,
      code: 200,
    };
    return c.json(response);
  });

  // 获取账号统计
  app.get('/stats', (c) => {
    const stats = accountService.getStats();
    const response: ApiResponse<typeof stats> = {
      success: true,
      data: stats,
      code: 200,
    };
    return c.json(response);
  });

  // 获取单个账号
  app.get('/:id', (c) => {
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

    const response: ApiResponse<typeof account> = {
      success: true,
      data: account,
      code: 200,
    };
    return c.json(response);
  });

  // 创建账号
  app.post('/', async (c) => {
    const body = await c.req.json<CreateAccountRequest>();
    const result = accountService.createAccount(body);
    
    if (result.success) {
      logService.success(`创建账号成功: ${body.userId}`);
      const response: ApiResponse<{ id: number }> = {
        success: true,
        data: { id: result.id! },
        code: 200,
      };
      return c.json(response);
    } else {
      logService.warning(`创建账号失败: ${result.message}`);
      const response: ApiResponse = {
        success: false,
        message: result.message,
        code: 400,
      };
      return c.json(response, 400);
    }
  });

  // 批量创建账号
  app.post('/batch', async (c) => {
    const body = await c.req.json<CreateAccountRequest[]>();
    const result = accountService.batchCreateAccounts(body);
    
    logService.info(`批量创建账号: 总计 ${result.total}, 成功 ${result.successCount}`);
    
    const response: ApiResponse<typeof result> = {
      success: result.success,
      data: result,
      code: result.success ? 200 : 400,
    };
    return c.json(response, result.success ? 200 : 400);
  });

  // 更新账号
  app.put('/:id', async (c) => {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json<UpdateAccountRequest>();
    const result = accountService.updateAccount(id, body);
    
    if (result.success) {
      logService.success(`更新账号成功: ID ${id}`);
      const response: ApiResponse = {
        success: true,
        code: 200,
      };
      return c.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        message: result.message,
        code: 400,
      };
      return c.json(response, 400);
    }
  });

  // 删除账号
  app.delete('/:id', (c) => {
    const id = parseInt(c.req.param('id'));
    const result = accountService.deleteAccount(id);
    
    if (result.success) {
      logService.success(`删除账号成功: ID ${id}`);
      const response: ApiResponse = {
        success: true,
        code: 200,
      };
      return c.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        message: result.message,
        code: 400,
      };
      return c.json(response, 400);
    }
  });

  // 批量删除账号
  app.post('/delete-batch', async (c) => {
    const body = await c.req.json<{ ids: number[] }>();
    const result = accountService.batchDeleteAccounts(body.ids);
    
    logService.info(`批量删除账号: 成功 ${result.deleted}, 失败 ${result.failed}`);
    
    const response: ApiResponse<typeof result> = {
      success: result.success,
      data: result,
      code: 200,
    };
    return c.json(response);
  });

  // 切换账号启用状态
  app.post('/:id/toggle', (c) => {
    const id = parseInt(c.req.param('id'));
    const result = accountService.toggleAccountStatus(id);
    
    if (result.success) {
      logService.success(`切换账号状态: ID ${id}, 状态: ${result.isActive ? '启用' : '禁用'}`);
      const response: ApiResponse<{ isActive: boolean }> = {
        success: true,
        data: { isActive: result.isActive! },
        code: 200,
      };
      return c.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        message: result.message,
        code: 400,
      };
      return c.json(response, 400);
    }
  });

  // 验证账号有效性
  app.post('/:id/validate', async (c) => {
    const id = parseInt(c.req.param('id'));
    const result = await accountService.validateAccount(id);
    
    logService.info(`验证账号: ID ${id}, 结果: ${result.valid ? '有效' : '无效'}`);
    
    const response: ApiResponse<typeof result> = {
      success: result.success,
      data: result,
      code: result.success ? 200 : 400,
    };
    return c.json(response, result.success ? 200 : 400);
  });

  // 批量验证账号有效性
  app.post('/validate-all', async (c) => {
    const result = await accountService.validateAllAccounts();
    
    logService.info(`批量验证账号: 总计 ${result.total}, 有效 ${result.valid}, 无效 ${result.invalid}`);
    
    const response: ApiResponse<typeof result> = {
      success: true,
      data: result,
      code: 200,
    };
    return c.json(response);
  });

  // 导出账号
  app.get('/export/data', (c) => {
    const data = accountService.exportAccounts();
    
    logService.info('导出账号数据');
    
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', 'attachment; filename="accounts.json"');
    
    return c.json(data);
  });

  // 导入账号
  app.post('/import', async (c) => {
    const body = await c.req.json<Array<{
      userId: string;
      roleId: string;
      token: string;
      devCode?: string;
      isWeb?: boolean;
      nickname?: string;
      serverId?: string;
    }>>();
    
    const result = accountService.importAccounts(body);
    
    logService.info(`导入账号: 总计 ${result.total}, 成功 ${result.successCount}, 失败 ${result.failedCount}`);
    
    const response: ApiResponse<typeof result> = {
      success: result.success,
      data: result,
      code: result.success ? 200 : 400,
    };
    return c.json(response, result.success ? 200 : 400);
  });

  return app;
}
