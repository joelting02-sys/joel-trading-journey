# Vercel + Supabase 部署指南

## 1. 创建 Supabase 项目

1. 打开 https://supabase.com 注册/登录
2. New Project → 选离你最近的 region（推荐 Singapore）
3. 设置数据库密码（保存好）
4. 等项目创建完成（约 1-2 分钟）

## 2. 跑数据库 Schema

1. Supabase 项目控制台 → 左侧菜单 **SQL Editor** → New query
2. 把 `supabase/schema.sql` 的内容全部复制进去 → Run
3. 应该会看到 4 张表（accounts / trades / sop_rules / user_settings）创建成功

## 3. 拿 API 凭证

1. 左侧菜单 **Project Settings** → **API**
2. 复制：
   - **Project URL**（形如 `https://xxxxx.supabase.co`）
   - **anon / public key**（一长串以 `eyJ` 开头的 JWT）

## 4. 本地跑通

在项目根目录创建 `.env.local`：

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

然后：
```
pnpm install
pnpm dev
```

打开 http://localhost:5173，应该会自动跳到 /login → 注册一个账号 → 进入主页。

## 5. 部署到 Vercel

### 方式 A: 通过 Vercel Dashboard（推荐）

1. 打开 https://vercel.com 注册/登录（用 GitHub 账号最方便）
2. **Add New → Project** → 导入你的代码仓库
   - 如果代码还没在 GitHub，先 `git init` + `git add .` + `git commit` + 推到 GitHub
3. Framework Preset: **Vite**
4. **Environment Variables** 添加：
   - `VITE_SUPABASE_URL` = 你的 Project URL
   - `VITE_SUPABASE_ANON_KEY` = 你的 anon key
5. 点击 **Deploy**，等 1-2 分钟
6. 部署成功后会得到一个 `xxx.vercel.app` 网址

### 方式 B: 通过 Vercel CLI

```bash
npm i -g vercel
vercel
# 按提示登录、同意默认配置
# 环境变量在 Vercel Dashboard 上设置
```

## 6. 测试

部署完成后：
1. 打开 Vercel 给你的网址
2. 注册新账号
3. 加一笔交易 → 关闭浏览器 → 再打开 → 登录 → 数据应该还在
4. 换一台电脑/手机打开同一网址 → 登录 → 看到同样的数据 ✅

## 7. 数据迁移（旧数据）

如果你之前在 localStorage 里有数据：
- 登录后会自动从 Supabase 读取（首次为空）
- 旧 localStorage 数据不会自动迁移
- 可以手动从旧浏览器导出 JSON，再导入新账号（如果需要这个功能可以告诉我加上）

## 常见问题

**Q: 部署后跳到 /login 看到 "需要先配置 Supabase"？**
A: 检查 Vercel 环境变量是否设置正确，VITE_SUPABASE_URL 必须以 https:// 开头

**Q: 注册后没有自动登录？**
A: Supabase 默认要求邮箱验证。可以在 Supabase 控制台 Authentication → Providers → Email 里关掉 "Confirm email"

**Q: 怎么禁止别人注册只让我一个人用？**
A: Supabase 控制台 → Authentication → Providers → Email → 关闭 "Enable sign up"。这样只有你能注册/登录。
