# Deno Deploy 部署指南

## 项目说明

这是一个单文件部署版本 (`deploy.ts`)，专为 Deno Deploy 免费云服务设计。所有功能都集成在一个文件中，使用内存存储（数据在实例重启后会丢失，适合演示或临时使用）。

## 部署方式

### 方式一：GitHub + Deno Deploy Dashboard（推荐）

1. **Fork 或创建 GitHub 仓库**
   - 将 `deno/` 文件夹中的 `deploy.ts` 和 `deno.deploy.json` 上传到 GitHub 仓库

2. **登录 Deno Deploy**
   - 访问 https://dash.deno.com/
   - 使用 GitHub 账号登录

3. **创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub"
   - 选择你的仓库
   - 设置：
     - **Entrypoint**: `deploy.ts`
     - **Import Map**: `deno.deploy.json` (可选)

4. **部署**
   - 点击 "Deploy" 按钮
   - 等待部署完成
   - 获得免费域名：`https://你的项目名.deno.dev`

### 方式二：Deploy Button（一键部署）

在 README.md 中添加以下按钮：

```markdown
[![Deploy to Deno Deploy](https://deno.com/deno-deploy-button.svg)](https://dash.deno.com/new?url=https://github.com/你的用户名/你的仓库/blob/main/deno/deploy.ts)
```

### 方式三：Deno Deploy CLI

```bash
# 安装 Deno Deploy CLI
deno install --allow-all --no-check -r -f https://deno.land/x/deploy/deployctl.ts

# 登录
deployctl login

# 部署
deployctl deploy --project=你的项目名 --include=deploy.ts
```

## 本地测试部署版本

```bash
cd deno
deno run --allow-net deploy.ts
```

访问 http://localhost:8000

## 注意事项

1. **内存存储**: Deno Deploy 不支持文件系统，所有数据存储在内存中
   - 实例休眠后数据会丢失
   - 适合演示、测试或临时使用
   - 如需持久化，需要连接外部数据库（如 Supabase、MongoDB Atlas 等）

2. **免费额度**:
   - 每月 100,000 请求
   - 每天 10GB 数据传输
   - 完全免费，无需信用卡

3. **自动部署**:
   - 连接 GitHub 后，每次 push 到 main 分支会自动重新部署

## 生产环境建议

如果需要数据持久化，建议：
1. 使用 Supabase PostgreSQL（免费额度足够）
2. 或使用 Upstash Redis
3. 修改 `deploy.ts` 添加数据库连接代码
