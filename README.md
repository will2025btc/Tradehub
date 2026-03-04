# 🚀 Followin Tradehub — 币安合约交易复盘系统

<p align="center">
  <strong>一站式加密货币合约交易分析平台 | 自动同步币安数据 | 可视化交易复盘</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#在线演示">在线演示</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#部署指南">部署指南</a>
</p>

---

## 📖 项目简介

**Followin Tradehub** 是一个专为币安合约交易者打造的交易复盘与分析系统。通过绑定币安只读 API，自动同步您的交易数据，提供直观的资产曲线、持仓分析、订单明细等功能，帮助交易者全面回顾和优化交易策略。

### 🎯 解决什么问题？

- 币安原生界面缺乏直观的交易复盘工具
- 难以追踪完整的持仓生命周期（开仓 → 加仓 → 减仓 → 平仓）
- 需要手动计算收益率、胜率、最大回撤等关键指标
- 缺少可视化的资产曲线和趋势分析

---

## ✨ 功能特性

### 📊 账户概览

- **核心指标看板** — 账户资产、总收益率、累计收益、月收益率、历史胜率、最大回撤、活跃天数、初始资金
- **资产曲线图** — 支持总收益率 / 账户资产切换，1M / 3M / 1Y / All 时间范围筛选
- **交互式图表** — 鼠标悬停查看精确日期和数值，蓝色渐变面积图

### 📈 持仓管理

- **当前持仓** — 实时显示所有未平仓的交易对、方向、杠杆、开仓价、浮动盈亏
- **历史持仓** — 完整的已平仓交易记录，收益率和收益金额
- **智能筛选** — 按交易对搜索、按状态筛选（全部/持仓中/已平仓）
- **汇总统计** — 总持仓数、持仓中数量、总盈亏、总手续费

### 📋 订单详情

- **持仓生命周期** — 单个持仓的完整操作时间轴
- **头部信息** — 交易对、杠杆、开仓均价、平仓均价、收益率、收益金额、持仓量、手续费
- **操作记录** — 每笔操作的时间、数量、价格、方向（买入开多/卖出平多），绿色加号/红色减号可视化

### 📰 加密快讯

- **实时快讯** — 接入 Followin API，实时追踪加密货币行业最新动态
- **代币标签** — 相关代币价格和 24h 涨跌幅
- **重要标记** — 重要快讯蓝色高亮显示
- **自动刷新** — 每 60 秒自动获取最新快讯
- **加载更多** — 下拉分页，浏览历史快讯

### 🔄 数据同步

- **自动同步** — 页面加载时自动检测并同步最新数据
- **定时轮询** — 每 5 分钟自动增量同步
- **Cron 定时任务** — Vercel Cron 每小时同步所有用户数据
- **手动同步** — 一键手动触发全量数据同步
- **同步状态栏** — 实时显示同步状态、最后同步时间

### 🔐 安全特性

- **邮箱注册登录** — NextAuth.js 认证，支持邮箱验证码
- **API 密钥加密** — AES-256-GCM 加密存储币安 API 密钥
- **只读 API** — 仅需币安只读权限，无交易/提现风险
- **数据隔离** — 用户只能访问自己的数据

---

## 🛠 技术栈

| 分类 | 技术 |
|------|------|
| **框架** | Next.js 14 (Pages Router) |
| **语言** | TypeScript |
| **样式** | Tailwind CSS |
| **图表** | Recharts |
| **数据库** | PostgreSQL (Neon Serverless) |
| **ORM** | Prisma |
| **认证** | NextAuth.js |
| **状态管理** | TanStack React Query |
| **API 集成** | Binance Futures REST API, Followin Open API |
| **加密** | AES-256-GCM (crypto-js) |
| **部署** | Vercel |

---

## 📁 项目结构

```
binance-trading-dashboard/
├── prisma/
│   ├── schema.prisma              # 数据库模型定义
│   └── migrations/                # 数据库迁移文件
├── src/
│   ├── components/
│   │   └── SyncStatusBar.tsx      # 同步状态栏组件
│   ├── lib/
│   │   ├── prisma.ts              # Prisma 客户端单例
│   │   ├── encryption.ts          # API 密钥加解密
│   │   ├── binance.ts             # 币安 API 客户端
│   │   ├── binance-api.ts         # 币安 API 扩展方法
│   │   ├── password.ts            # 密码哈希工具
│   │   ├── email.ts               # 邮件发送工具
│   │   └── use-auto-sync.ts       # 自动同步 Hook
│   ├── pages/
│   │   ├── index.tsx              # 📊 账户概览页
│   │   ├── news.tsx               # 📰 加密快讯页
│   │   ├── positions.tsx          # 📈 持仓列表页
│   │   ├── positions/[id].tsx     # 📋 订单详情页
│   │   ├── auth/
│   │   │   ├── signin.tsx         # 登录页
│   │   │   ├── register.tsx       # 注册页
│   │   │   └── verify.tsx         # 邮箱验证页
│   │   ├── settings/
│   │   │   ├── api.tsx            # API 密钥配置页
│   │   │   └── sync.tsx           # 数据同步管理页
│   │   └── api/
│   │       ├── auth/              # 认证相关 API
│   │       ├── account/           # 账户指标和快照 API
│   │       ├── positions.ts       # 持仓列表 API
│   │       ├── positions/[id].ts  # 持仓详情 API
│   │       ├── settings/          # API 配置管理
│   │       ├── sync/              # 数据同步 API
│   │       ├── news/              # 快讯代理 API
│   │       └── cron/              # 定时任务 API
│   ├── styles/
│   │   └── globals.css            # 全局样式
│   └── types/
│       └── next-auth.d.ts         # NextAuth 类型扩展
├── .env.example                   # 环境变量模板
├── vercel.json                    # Vercel 部署配置
├── tailwind.config.ts             # Tailwind 配置
├── tsconfig.json                  # TypeScript 配置
└── package.json                   # 项目依赖
```

---

## 🗄 数据库模型

```
┌──────────────┐     ┌──────────────────┐
│    User       │────>│    ApiConfig      │
│              │     │  (加密API密钥)     │
│  id          │     │  api_key_encrypted │
│  email       │     │  api_secret_encrypt│
│  password    │     │  last_sync_at      │
│  displayName │     └──────────────────┘
└──────┬───────┘
       │
       ├────────>┌──────────────────┐
       │         │    Position       │
       │         │  (持仓记录)       │
       │         │  symbol, side     │
       │         │  leverage, status │
       │         │  avg_open_price   │
       │         │  avg_close_price  │
       │         │  realized_pnl     │
       │         └────────┬─────────┘
       │                  │
       │                  └──>┌──────────────┐
       │                      │    Trade      │
       │                      │  (交易明细)   │
       │                      │  price, qty   │
       │                      │  side, fee    │
       │                      └──────────────┘
       │
       └────────>┌──────────────────────┐
                 │  AccountSnapshot      │
                 │  (资产快照)           │
                 │  balance, equity      │
                 │  unrealized_pnl       │
                 │  snapshot_time        │
                 └──────────────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 数据库
- npm 或 yarn

### 1. 克隆项目

```bash
git clone https://github.com/will2025btc/Tradehub.git
cd Tradehub
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库连接
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# NextAuth 配置
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="你的随机密钥"  # openssl rand -base64 32

# API 密钥加密密钥
ENCRYPTION_KEY="你的32字节密钥"  # openssl rand -hex 32

# 币安 API
BINANCE_API_URL="https://fapi.binance.com"

# Followin 快讯 API
FOLLOWIN_API_KEY="你的Followin API Key"
```

### 3. 初始化数据库

```bash
npx prisma generate
npx prisma db push
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 🎉

---

## 🌐 部署指南

### Vercel 一键部署（推荐）

1. Fork 本仓库到你的 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量（参考 `.env.example`）
4. 点击 Deploy

### 数据库推荐

- [Neon](https://neon.tech) — Serverless PostgreSQL（免费额度）
- [Supabase](https://supabase.com) — 开源 PostgreSQL 平台
- [Railway](https://railway.app) — 简单的云数据库

---

## 📊 核心计算逻辑

| 指标 | 公式 |
|------|------|
| **总收益率** | (当前资产 - 初始资金) / 初始资金 × 100% |
| **月收益率** | 最近30天资产变化率 |
| **历史胜率** | 盈利订单数 / 总订单数 × 100% |
| **最大回撤** | max(历史峰值 - 当前值) / 历史峰值 × 100% |
| **平仓均价** | Σ(平仓价 × 平仓量) / Σ(平仓量) |
| **收益率** | (平仓均价 - 开仓均价) / 开仓均价 × 杠杆 × 100% |

---

## 🔧 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 代码检查
npm run db:push      # 推送数据库 Schema
npm run db:studio    # 打开 Prisma 数据库管理界面
```

---

## 🛡 安全说明

1. ⚠️ **始终使用只读 API 密钥** — 不要授予交易和提现权限
2. 🔒 **API 密钥加密存储** — 使用 AES-256-GCM 加密，服务端解密
3. 🔑 **环境变量管理** — 敏感信息通过环境变量配置，不提交到代码仓库
4. 🌐 **HTTPS 传输** — 生产环境强制 HTTPS
5. 👤 **数据隔离** — 用户只能访问和操作自己的数据

---

## 📝 更新日志

### v1.2.0 — 加密快讯 & 自动同步
- ✅ 新增加密快讯页面（Followin API 集成）
- ✅ 页面加载自动同步 + 5分钟定时轮询
- ✅ Vercel Cron 每小时后台同步
- ✅ 同步状态栏组件

### v1.1.0 — 邮箱认证 & 数据同步
- ✅ 邮箱注册 + 验证码登录
- ✅ 手动数据同步功能
- ✅ API 密钥配置和加密存储

### v1.0.0 — 初始版本
- ✅ 账户概览和资产曲线图
- ✅ 持仓管理（当前/历史）
- ✅ 订单详情和操作时间轴
- ✅ 币安 API 集成
- ✅ 响应式设计

---

## 🤝 贡献

欢迎提交 Pull Request！如果你有好的想法或发现 Bug：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: 添加某个功能'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

---

## 📄 开源协议

[MIT License](LICENSE) — 可自由使用、修改和分发。

---

## ⚠️ 免责声明

本项目仅供学习和信息展示使用，不构成任何投资建议。交易数据请以币安官方平台为准。加密货币交易具有高风险，过往表现不代表未来收益。

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/will2025btc">will2025btc</a>
</p>
