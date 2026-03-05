# AdPilot — AI 广告投放优化师

AdPilot 是一款基于 AI 的广告投放优化平台，将广告优化分析师的完整工作流浓缩为一次 AI 对话。上传投放报表，自动完成数据诊断、归因分析与策略输出。

## 核心功能

- **智能报表解析** — 支持 Excel / CSV 格式，自动识别投放平台字段语义，无需手动映射
- **全链路漏斗分析** — 从曝光到转化，自动构建投放漏斗，定位每个环节的流失原因与优化空间
- **多维度交叉对比** — 按计划、素材、人群、时段等多维度拆解数据，发现隐藏的效果差异
- **对话式深度分析** — 通过自然语言追问，深入探索具体问题
- **预算优化建议** — 基于边际效益分析，输出预算再分配方案
- **分析报告导出** — 将分析结论与优化建议自动整理为结构化报告

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (Turbopack) |
| 前端 | React 19, CSS Modules |
| 认证 | Supabase Auth (Google OAuth) |
| 数据库 | Supabase (PostgreSQL) |
| AI | DeepSeek API (流式输出) |
| 图表 | ECharts |
| 部署 | Vercel |

## 项目结构

```
src/
├── app/
│   ├── page.js              # Landing Page（粒子鸟动画 + 滚动动效）
│   ├── chat/page.js          # 分析工作台（对话 + 项目管理）
│   ├── login/page.js         # 登录页
│   ├── auth/callback/route.js # Supabase OAuth 回调
│   └── api/chat/route.js     # AI 对话 API（SSE 流式）
├── components/
│   ├── Navbar/               # 方向感知导航栏
│   ├── ParticleBird/         # Canvas 粒子鸟动画
│   ├── MessageContent/       # Markdown + ECharts 渲染
│   └── Providers.js          # Supabase Auth Context
├── lib/
│   ├── supabase-browser.js   # 浏览器端 Supabase 客户端
│   └── supabase-server.js    # 服务端 Supabase 客户端
└── middleware.js              # Session 刷新中间件
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名Key
DEEPSEEK_API_KEY=你的DeepSeek API Key（可选，不填则使用演示模式）
```

### 3. 配置 Supabase

在 Supabase SQL Editor 中执行 `supabase-schema.sql`，创建所需的数据表和 RLS 策略。

在 Supabase Authentication → Providers 中启用 Google OAuth，填入 Google Cloud Console 的 Client ID 和 Client Secret。

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 数据库设计

| 表名 | 用途 |
|------|------|
| `projects` | 用户的广告投放项目 |
| `project_contexts` | 项目上下文文件（PDF 文本提取） |
| `chat_sessions` | 聊天会话历史（JSONB 存储消息） |

所有表均启用 Row Level Security (RLS)，用户只能访问自己的数据。

## 部署到 Vercel

1. 将仓库导入 Vercel
2. 在 Settings → Environment Variables 中配置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`DEEPSEEK_API_KEY`
3. 部署后将 Vercel 域名添加到 Supabase 的 Redirect URLs 中

## 支持平台

覆盖 Facebook Ads、Google Ads、TikTok Ads、小红书聚光、巨量引擎、腾讯广告等 20+ 主流广告平台的投放数据分析。

## 许可证

MIT
