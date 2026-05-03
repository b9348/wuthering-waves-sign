import { Hono } from 'hono';
import { serveStatic } from 'hono/deno';
import { Database } from './src/db/database.ts';
import { AccountService } from './src/services/accountService.ts';
import { SignService } from './src/services/signService.ts';
import { LogService } from './src/services/logService.ts';
import { SettingService } from './src/services/settingService.ts';
import { createAccountRouter } from './src/api/accounts.ts';
import { createSignRouter } from './src/api/sign.ts';
import { createDashboardRouter } from './src/api/dashboard.ts';
import { createSettingsRouter } from './src/api/settings.ts';
import { createPageRouter } from './src/api/pages.ts';
import { SignScheduler } from './src/services/scheduler.ts';

// 初始化数据库和服务
const db = new Database();
const accountService = new AccountService(db);
const signService = new SignService(db);
const logService = new LogService(db);
const settingService = new SettingService(db);

// 初始化定时调度器
const scheduler = new SignScheduler(accountService, signService, logService, settingService);

// 创建 Hono 应用
const app = new Hono();

// 静态文件服务
app.use('/static/*', serveStatic({ root: '.' }));

// 注册路由
app.route('/', createPageRouter());
app.route('/api/accounts', createAccountRouter(accountService, logService));
app.route('/api/sign', createSignRouter(signService, accountService, logService));
app.route('/api/dashboard', createDashboardRouter(accountService, signService, logService));
app.route('/api/settings', createSettingsRouter(settingService));

// 启动定时任务
scheduler.start();

// 启动服务器
const port = parseInt(Deno.env.get('PORT') || '8000');
console.log(`🚀 鸣潮签到管理系统启动成功！`);
console.log(`📍 访问地址: http://localhost:${port}`);
console.log(`📁 数据库: ./data/sign.db`);

Deno.serve({ port }, app.fetch);
