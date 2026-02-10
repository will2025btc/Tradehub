# 🚀 币安交易复盘系统 - 生产部署指南

## ✅ 系统已完成功能

### 核心功能
- ✅ 邮箱 + 密码认证系统
- ✅ 邮箱验证（带手动验证功能）
- ✅ 币安API密钥管理（AES-256加密）
- ✅ **真实的币安API数据同步**（过去3天交易数据）
- ✅ 持仓聚合和计算
- ✅ 账户快照生成
- ✅ 全中文界面
- ✅ 自动化工作流程

---

## 📋 部署前准备

### 1. 环境要求
- Node.js 18+
- PostgreSQL 14+ (生产环境推荐) 或 SQLite (开发环境)
- SMTP邮件服务 (Gmail/QQ/163等)

### 2. 获取必要的密钥

#### 生成加密密钥
```bash
# 生成 NEXTAUTH_SECRET
openssl rand -base64 32

# 生成 ENCRYPTION_KEY
openssl rand -hex 32
```

#### 配置邮件服务
**Gmail：**
1. 访问 https://myaccount.google.com/apppasswords
2. 生成应用专用密码
3. 复制密码到环境变量

**QQ邮箱：**
1. 登录QQ邮箱
2. 设置 → 账户 → POP3/IMAP/SMTP
3. 生成授权码

---

## 🔧 配置环境变量

创建 `.env` 文件：

```bash
# 数据库（PostgreSQL生产环境）
DATABASE_URL="postgresql://user:password@localhost:5432/trading_dashboard"

# 或使用 SQLite（开发/小规模使用）
# DATABASE_URL="sqlite:./prod.db"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"  # 生产环境域名
NEXTAUTH_SECRET="你生成的密钥"

# 邮件服务（Gmail示例）
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT="587"
EMAIL_USER="your-email@gmail.com"
EMAIL_PASSWORD="your-app-password"
EMAIL_FROM="your-email@gmail.com"

# API密钥加密
ENCRYPTION_KEY="你生成的加密密钥"

# 币安API
BINANCE_API_URL="https://fapi.binance.com"
```

---

## 📦 安装和构建

```bash
# 1. 进入项目目录
cd ~/Desktop/binance-trading-dashboard

# 2. 安装依赖
npm install

# 3. 生成Prisma客户端
npx prisma generate

# 4. 推送数据库Schema
npx prisma db push

# 5. 构建生产版本
npm run build

# 6. 启动生产服务器
npm start
```

---

## 🐳 Docker部署（推荐）

### 创建 `Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### 创建 `docker-compose.yml`

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/trading
      - NEXTAUTH_URL=https://your-domain.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - EMAIL_HOST=${EMAIL_HOST}
      - EMAIL_USER=${EMAIL_USER}
      - EMAIL_PASSWORD=${EMAIL_PASSWORD}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    depends_on:
      - db

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=trading
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### 启动

```bash
docker-compose up -d
```

---

## ☁️ Vercel部署（推荐用于前端）

### 1. 安装Vercel CLI

```bash
npm i -g vercel
```

### 2. 部署

```bash
vercel
```

### 3. 配置环境变量

在Vercel Dashboard中添加：
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `EMAIL_*` 变量
- `ENCRYPTION_KEY`

---

## 🗄️ 数据库迁移（SQLite → PostgreSQL）

### 1. 导出SQLite数据

```bash
sqlite3 dev.db .dump > backup.sql
```

### 2. 修改DATABASE_URL为PostgreSQL

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/trading"
```

### 3. 推送Schema

```bash
npx prisma db push
```

### 4. 迁移数据（手动或使用工具）

---

## 🔒 安全检查清单

### 必须完成
- [ ] 使用强密码的NEXTAUTH_SECRET
- [ ] 使用强密码的ENCRYPTION_KEY
- [ ] 配置HTTPS（生产环境必须）
- [ ] 设置CORS策略
- [ ] 启用Rate Limiting
- [ ] 定期备份数据库
- [ ] 监控API使用量

### 推荐完成
- [ ] 设置防火墙规则
- [ ] 配置日志系统
- [ ] 设置错误监控（Sentry）
- [ ] 配置CDN
- [ ] 启用数据库备份
- [ ] 设置SSL证书自动续期

---

## 📊 性能优化

### 1. 数据库索引

```sql
-- 为常用查询添加索引
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_account_snapshots_user_id ON account_snapshots(user_id);
CREATE INDEX idx_api_configs_user_id ON api_configs(user_id);
```

### 2. 缓存配置

考虑使用Redis缓存：
- API响应缓存
- Session存储
- 数据同步状态

### 3. CDN配置

使用CDN加速静态资源：
- CSS/JS文件
- 图片资源
- 字体文件

---

## 🔄 数据同步策略

### 手动同步
用户可以随时在"数据同步"页面手动触发

### 自动同步（可选实现）
使用Cron Job每5分钟同步一次：

```typescript
// 使用 node-cron
import cron from 'node-cron';

cron.schedule('*/5 * * * *', async () => {
  // 获取所有活跃的API配置
  // 逐个同步数据
});
```

---

## 🧪 测试流程

### 1. 本地测试

```bash
npm run dev
```

访问 http://localhost:3000

### 2. 测试步骤

1. **注册账户**
   - 填写邮箱和密码
   - 使用手动验证或邮件验证

2. **配置API**
   - 进入"API设置"
   - 输入币安API密钥（只读权限）
   - 保存并自动跳转

3. **数据同步**
   - 自动开始同步
   - 查看同步结果
   - 确认显示真实数据

4. **查看数据**
   - 首页查看账户指标
   - 持仓页查看交易记录
   - 确认数据正确

---

## 📱 用户使用指南

### 获取币安API密钥

1. 登录币安账户
2. 访问 https://www.binance.com/zh-CN/my/settings/api-management
3. 点击"创建API"
4. **重要：只勾选"启用读取"权限**
5. 完成验证
6. 复制API Key和Secret

### 首次使用流程

1. 访问网站并注册
2. 验证邮箱
3. 登录系统
4. 配置币安API密钥
5. 等待自动同步完成
6. 查看交易数据和分析

---

## 🐛 常见问题

### 1. 数据同步失败

**可能原因：**
- API密钥错误或过期
- API密钥权限不足
- 网络连接问题
- 币安API限流

**解决方案：**
- 检查API密钥是否正确
- 确认API有读取权限
- 检查网络连接
- 等待几分钟后重试

### 2. 邮件发送失败

**可能原因：**
- SMTP配置错误
- 邮箱密码错误
- 防火墙阻止

**解决方案：**
- 使用应用专用密码（不是登录密码）
- 检查SMTP配置
- 使用手动验证功能

### 3. 数据显示为0

**检查：**
- 是否已配置API密钥
- 是否执行过数据同步
- 币安账户是否有交易记录
- 查看服务器日志

---

## 📈 监控和维护

### 日志位置
```bash
# 应用日志
tail -f logs/app.log

# 数据库日志
tail -f logs/db.log
```

### 监控指标
- 用户注册数
- 数据同步成功率
- API调用次数
- 错误率
- 响应时间

### 定期维护
- 每周备份数据库
- 每月检查日志
- 定期更新依赖包
- 监控磁盘空间

---

## 🎯 下一步优化建议

### 短期（1-2周）
- [ ] 添加数据导出功能
- [ ] 实现图表交互功能
- [ ] 添加更多统计指标
- [ ] 优化移动端体验

### 中期（1个月）
- [ ] 实现自动定时同步
- [ ] 添加交易提醒功能
- [ ] 支持更多交易对
- [ ] 实现数据分析报告

### 长期（3个月）
- [ ] 添加AI分析功能
- [ ] 实现策略回测
- [ ] 支持多用户协作
- [ ] 开发移动应用

---

## 📞 技术支持

### 文档
- README.md - 项目说明
- SETUP_GUIDE.md - 开发环境设置
- PRODUCTION_DEPLOY.md - 生产部署指南（本文档）

### 联系方式
如有问题，请查看项目README或提交Issue

---

## ✅ 部署完成检查表

- [ ] 环境变量已配置
- [ ] 数据库已初始化
- [ ] 应用已构建成功
- [ ] 生产服务器已启动
- [ ] HTTPS已配置
- [ ] 邮件服务正常工作
- [ ] API加密正常工作
- [ ] 数据同步功能测试通过
- [ ] 用户注册登录测试通过
- [ ] 所有页面可正常访问
- [ ] 监控系统已配置
- [ ] 备份策略已实施

---

## 🎉 恭喜！

您的币安交易复盘系统已准备好上线使用！

系统现在可以：
- ✅ 用户注册和认证
- ✅ 安全存储API密钥
- ✅ 同步真实交易数据
- ✅ 显示账户指标和持仓
- ✅ 提供完整的交易分析

立即开始使用您的交易复盘系统吧！🚀
