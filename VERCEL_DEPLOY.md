# 🚀 Vercel 部署完整指南

## ✅ 已完成的准备工作

- ✅ 代码已推送到GitHub: https://github.com/will2025btc/Tradehub
- ✅ .gitignore 已配置（保护敏感文件）
- ✅ vercel.json 已创建（60秒API超时）
- ✅ Prisma schema 已配置支持PostgreSQL
- ✅ package.json 已有 postinstall 脚本

---

## 📋 部署步骤

### 第1步：准备数据库（必须）

Vercel不提供数据库，需要使用外部数据库服务。

#### 推荐：Neon（免费3GB存储）

1. 访问 https://neon.tech
2. 注册并登录
3. 创建新项目：
   - Project Name: `tradehub`
   - Region: 选择离您最近的
4. 创建完成后，复制 **Connection String**
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb
   ```

#### 其他选择：
- **Supabase**: https://supabase.com (免费500MB)
- **Vercel Postgres**: https://vercel.com/storage/postgres (需要付费计划)
- **PlanetScale**: https://planetscale.com (免费5GB，但需修改schema支持MySQL)

---

### 第2步：生成密钥

在终端执行以下命令：

```bash
# 生成 NEXTAUTH_SECRET
openssl rand -base64 32

# 生成 ENCRYPTION_KEY
openssl rand -hex 32
```

**保存这些密钥！** 稍后需要配置到Vercel。

---

### 第3步：部署到Vercel

#### 方式A：通过Vercel Dashboard（推荐）

1. **访问 Vercel**
   - 打开 https://vercel.com
   - 使用GitHub账号登录

2. **导入项目**
   - 点击 "Add New" → "Project"
   - 选择 `will2025btc/Tradehub`
   - 点击 "Import"

3. **项目配置**
   - Framework Preset: **Next.js** （自动检测）
   - Root Directory: `./`
   - Build Command: `prisma generate && next build`
   - Output Directory: `.next`
   - Install Command: `npm install`

4. **点击 "Deploy"**
   - 第一次部署会失败（正常），因为还没配置环境变量

---

### 第4步：配置环境变量（关键！）

在Vercel Dashboard中：

1. 进入项目 → Settings → Environment Variables

2. 添加以下变量（**一个一个添加**）：

```bash
# 数据库（必须）
DATABASE_URL=postgresql://...你的Neon连接字符串

# NextAuth（必须）
NEXTAUTH_URL=https://你的项目名.vercel.app
NEXTAUTH_SECRET=你生成的NEXTAUTH_SECRET

# 邮件服务（必须）
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=your-email@gmail.com

# 加密密钥（必须）
ENCRYPTION_KEY=你生成的ENCRYPTION_KEY

# 币安API（必须）
BINANCE_API_URL=https://fapi.binance.com
```

**重要提示：**
- 每个变量都要选择 `Production`, `Preview`, `Development`
- EMAIL_PASSWORD 使用Gmail的**应用专用密码**，不是登录密码

#### 如何获取Gmail应用密码：
1. 访问 https://myaccount.google.com/apppasswords
2. 创建应用专用密码
3. 复制16位密码（去掉空格）

---

### 第5步：重新部署

配置好环境变量后：

1. 在Vercel Dashboard，进入项目
2. 点击 "Deployments" 标签
3. 点击最新部署右边的 "..." 
4. 选择 "Redeploy"
5. 等待部署完成（约2-3分钟）

---

### 第6步：初始化数据库

部署成功后，需要初始化数据库表结构：

1. 访问 https://你的项目名.vercel.app
2. 如果看到数据库错误，这是正常的

3. 使用Prisma Studio初始化：
   ```bash
   # 在本地终端执行
   cd /Users/a004/Desktop/binance-trading-dashboard
   
   # 临时设置数据库URL为生产环境
   export DATABASE_URL="postgresql://...你的Neon连接字符串"
   
   # 推送schema到数据库
   npx prisma db push
   ```

或者直接在Neon Dashboard中执行SQL：
- 打开Neon项目
- 进入SQL Editor
- 复制 `prisma/migrations/20260204030642_init/migration.sql` 的内容
- 执行SQL

---

### 第7步：测试部署

访问 https://你的项目名.vercel.app

测试以下功能：
- ✅ 首页加载正常
- ✅ 注册新用户
- ✅ 邮件验证（或手动验证）
- ✅ 登录系统
- ✅ 配置币安API
- ✅ 数据同步
- ✅ 查看持仓

---

## 🔧 常见问题

### 1. 部署失败：Prisma相关错误

**解决：**
- 确认 DATABASE_URL 正确
- 确认使用PostgreSQL（不是SQLite）
- 检查 prisma/schema.prisma 的 provider 是 "postgresql"

### 2. API超时错误

**原因：** 数据同步时间较长

**解决：** vercel.json 已配置60秒超时，应该够用。如果还超时，可以：
- 减少同步天数（在 sync/manual.ts 中修改）
- 升级Vercel Pro计划（支持300秒）

### 3. 数据库连接错误

**检查：**
- DATABASE_URL 格式正确
- 数据库允许外部连接
- Neon项目未暂停（免费版会自动暂停）

### 4. 邮件发送失败

**解决：**
- 使用Gmail的应用专用密码
- 或使用手动验证功能（无需邮件）

### 5. 环境变量不生效

**解决：**
- 重新部署项目
- 确认环境变量拼写正确
- 检查是否选择了所有环境

---

## 🎯 部署后优化

### 1. 自定义域名

在Vercel Dashboard → Settings → Domains：
- 添加自己的域名
- 配置DNS记录

### 2. 分析和监控

启用Vercel Analytics：
- Settings → Analytics
- 查看访问数据

### 3. 性能优化

- 启用Edge Functions
- 配置CDN缓存
- 优化图片

### 4. 安全增强

- 启用Vercel Firewall
- 配置Rate Limiting
- 定期更新依赖

---

## 📊 成本估算

### 免费套餐（Hobby）
- **Vercel**: 免费
- **Neon**: 免费（3GB存储，1个分支）
- **总计**: $0/月

### 生产套餐（推荐）
- **Vercel Pro**: $20/月（团队协作、更长超时）
- **Neon Scale**: $19/月（10GB存储）
- **总计**: ~$39/月

---

## ✅ 部署检查清单

- [ ] GitHub仓库已创建
- [ ] 数据库已创建（Neon/Supabase等）
- [ ] 密钥已生成（NEXTAUTH_SECRET, ENCRYPTION_KEY）
- [ ] Vercel项目已创建
- [ ] 环境变量已配置（8个）
- [ ] 项目已重新部署
- [ ] 数据库表已创建
- [ ] 注册功能正常
- [ ] 登录功能正常
- [ ] API配置正常
- [ ] 数据同步正常

---

## 🎉 完成！

您的币安交易复盘系统已成功部署到Vercel！

**访问地址：** https://你的项目名.vercel.app

如有问题，请查看：
- Vercel Deployment Logs
- Neon Dashboard 查看数据库连接
- GitHub Issues

---

## 📞 技术支持

**文档：**
- README.md - 项目说明
- SETUP_GUIDE.md - 本地开发指南
- PRODUCTION_DEPLOY.md - 生产部署指南
- VERCEL_DEPLOY.md - Vercel部署指南（本文档）

**相关链接：**
- GitHub仓库: https://github.com/will2025btc/Tradehub
- Vercel文档: https://vercel.com/docs
- Next.js文档: https://nextjs.org/docs
- Prisma文档: https://www.prisma.io/docs

祝您使用愉快！🚀
