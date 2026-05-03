import { Hono } from 'hono';
import type { SettingService } from '../services/settingService.ts';
import type { ApiResponse, SystemConfig } from '../types/index.ts';

export function createSettingsRouter(settingService: SettingService) {
  const app = new Hono();

  // 获取所有设置
  app.get('/', (c) => {
    const settings = settingService.getAll();
    const config = settingService.getConfig();
    
    const response: ApiResponse<{ settings: typeof settings; config: typeof config }> = {
      success: true,
      data: { settings, config },
      code: 200,
    };
    return c.json(response);
  });

  // 获取系统配置
  app.get('/config', (c) => {
    const config = settingService.getConfig();
    
    const response: ApiResponse<SystemConfig> = {
      success: true,
      data: config,
      code: 200,
    };
    return c.json(response);
  });

  // 更新系统配置
  app.put('/config', async (c) => {
    const body = await c.req.json<Partial<SystemConfig>>();
    settingService.updateConfig(body);
    
    const config = settingService.getConfig();
    
    const response: ApiResponse<SystemConfig> = {
      success: true,
      data: config,
      code: 200,
    };
    return c.json(response);
  });

  // 获取单个设置
  app.get('/:key', (c) => {
    const key = c.req.param('key');
    const value = settingService.getString(key);
    
    const response: ApiResponse<{ key: string; value: string }> = {
      success: true,
      data: { key, value },
      code: 200,
    };
    return c.json(response);
  });

  // 更新单个设置
  app.put('/:key', async (c) => {
    const key = c.req.param('key');
    const body = await c.req.json<{ value: string }>();
    
    settingService.set(key, body.value);
    
    const response: ApiResponse = {
      success: true,
      code: 200,
    };
    return c.json(response);
  });

  return app;
}
