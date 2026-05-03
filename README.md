# 鸣潮签到管理系统 (Deno版)

基于 Deno 的鸣潮库街区每日签到管理系统，支持多账号管理、自动签到、账号有效性检测等功能。

## 功能特性

### 核心功能
- ✅ **多账号管理** - 支持添加、编辑、删除、批量导入/导出账号
- ✅ **自动签到** - 每日定时自动执行签到任务
- ✅ **手动签到** - 支持单个/批量/全部账号手动签到
- ✅ **有效性检测** - 验证账号 Token 是否有效
- ✅ **签到历史** - 记录每次签到结果和奖励

### 扩展功能
- 📊 **仪表盘** - 统计账号数量、签到状态、系统日志
- 🔔 **通知推送** - 支持 Webhook 通知签到结果
- ⏰ **定时调度** - 可配置每日签到时间
- 📁 **数据导入/导出** - JSON 格式备份和恢复账号
- 🌐 **Web 管理界面** - 响应式设计，支持移动端

## 技术栈

- **运行时**: Deno 2.x
- **Web 框架**: Hono
- **数据库**: SQLite (单文件)
- **前端**: Alpine.js + Tailwind CSS
- **调度**: Deno Cron

## 快速开始

### 1. 安装 Deno
```bash
# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# macOS/Linux
curl -fsSL https://deno.land/install.sh | sh
```

### 2. 启动服务
```bash
# 进入项目目录
cd deno

# 启动服务
deno task start

# 或使用开发模式（热重载）
deno task dev
```

### 3. 访问管理界面
打开浏览器访问: http://localhost:8000

## API 文档

### 账号管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/accounts` | 获取所有账号 |
| GET | `/api/accounts/:id` | 获取单个账号 |
| POST | `/api/accounts` | 创建账号 |
| POST | `/api/accounts/batch` | 批量创建账号 |
| PUT | `/api/accounts/:id` | 更新账号 |
| DELETE | `/api/accounts/:id` | 删除账号 |
| POST | `/api/accounts/:id/toggle` | 切换启用状态 |
| POST | `/api/accounts/:id/validate` | 验证账号有效性 |
| POST | `/api/accounts/validate-all` | 批量验证所有账号 |
| GET | `/api/accounts/export/data` | 导出账号数据 |
| POST | `/api/accounts/import` | 导入账号数据 |

### 签到管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sign/all` | 全部账号签到 |
| POST | `/api/sign/batch` | 批量签到 |
| POST | `/api/sign/:id` | 单个账号签到 |
| GET | `/api/sign/:id/init` | 获取签到初始化数据 |
| GET | `/api/sign/:id/records` | 获取账号签到记录 |
| GET | `/api/sign/:id/stats` | 获取账号签到统计 |
| GET | `/api/sign/:id/check` | 检查今日是否已签到 |
| GET | `/api/sign/stats/today` | 获取今日签到统计 |

### 仪表盘

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard` | 获取仪表盘数据 |
| GET | `/api/dashboard/status` | 获取系统状态 |

### 设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings/config` | 获取系统配置 |
| PUT | `/api/settings/config` | 更新系统配置 |

## 账号数据格式

```json
{
  "userId": "123456789",
  "roleId": "987654321",
  "token": "your_token_here",
  "devCode": "optional_device_code",
  "isWeb": false,
  "nickname": "我的账号",
  "serverId": "76402e5b20be2c79f95d4f4ad1e41172"
}
```

## 配置说明

系统配置存储在 SQLite 数据库中，可通过 Web 界面或 API 修改：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `auto_sign` | 是否启用自动签到 | `false` |
| `sign_time` | 每日签到时间 | `09:00` |
| `notify_type` | 通知方式 | `none` |
| `notify_webhook` | Webhook URL | `""` |
| `notify_email` | 通知邮箱 | `""` |

## 目录结构

```
deno/
├── main.ts                 # 入口文件
├── deno.json              # Deno 配置
├── README.md              # 说明文档
├── src/
│   ├── api/               # API 路由
│   │   ├── accounts.ts    # 账号管理 API
│   │   ├── sign.ts        # 签到 API
│   │   ├── dashboard.ts   # 仪表盘 API
│   │   ├── settings.ts    # 设置 API
│   │   └── pages.ts       # 页面路由
│   ├── db/
│   │   └── database.ts    # 数据库操作
│   ├── services/
│   │   ├── accountService.ts   # 账号服务
│   │   ├── signService.ts      # 签到服务
│   │   ├── kuroApi.ts          # 库街区 API
│   │   ├── logService.ts       # 日志服务
│   │   ├── settingService.ts   # 设置服务
│   │   └── scheduler.ts        # 定时调度
│   ├── types/
│   │   └── index.ts       # 类型定义
│   └── utils/
│       └── apiConfig.ts   # API 配置
└── data/                  # 数据目录 (自动创建)
    └── sign.db            # SQLite 数据库
```

## 注意事项

1. **Token 获取**: 需要从库街区 APP 或网页版获取有效的用户 Token
2. **账号安全**: Token 是敏感信息，请妥善保管，不要泄露给他人
3. **自动签到**: 需要保持服务运行才能执行定时签到
4. **网络要求**: 需要能够访问库街区 API (https://api.kurobbs.com)

## 许可证

MIT
