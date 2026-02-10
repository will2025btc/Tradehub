# 🔧 Vercel环境变量配置清单

## ✅ 必须配置的环境变量

将以下内容复制到Vercel Dashboard → Settings → Environment Variables

---

### 1. NEXTAUTH_URL
```
https://tradehub-zeta.vercel.app
```
**说明：** NextAuth回调地址，必须是您的Vercel域名

---

### 2. NEXTAUTH_SECRET
```
KntVunDL+rtv240l22DYhFfEvmQlWdhCM30yA/qY9g=
```
**说明：** 已为您生成的NextAuth密钥

---

### 3. ENCRYPTION_KEY
```
59dec0947724cb0d5ccc363394c1bc1306e6cf087d16f3e23fbffdb6e0831a9f
```
**说明：** 已为您生成的API密钥加密密钥

---

### 4. BINANCE_API_URL
```
https://fapi.binance.com
```
**说明：** 币安期货API地址

---

### 5. DATABASE_URL
```
postgresql://您的Neon连接字符串
```
**说明：** 
1. 访问 https://neon.tech
2. 注册/登录
3. 创建项目（选Singapore或Tokyo区域）
4. 复制Connection String
5. 格式类似：`postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb`

---

### 6-9. 邮件配置（暂时填假值）

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@example.com
EMAIL_PASSWORD=dummy
EMAIL_FROM=noreply@example.com
```
**说明：** 使用手动验证功能，邮件配置暂时随便填

---

## 📋 配置步骤

### 在Vercel Dashboard：

1. **进入项目** tradehub
2. **点击** Settings （顶部菜单）
3. **选择** Environment Variables （左侧菜单）
4. **逐个添加**上面的9个变量：
   - 点击 "Add New"
   - Key: 变量名（如NEXTAUTH_URL）
   - Value: 对应的值
   - 勾选：Production, Preview, Development
   - 点击 "Save"
5. **重复**步骤4，添加所有变量

---

## ⚠️ 重要提醒

### DATABASE_URL必须是真实的Neon连接字符串！

**不要填：**
❌ `postgresql://...（Neon连接字符串）`
❌ `postgresql://你的Neon连接字符串`

**应该填：**
✅ `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb`

---

## 🎯 配置后的操作

1. **重新部署**
   - Deployments → 点最新部署的"..."
   - 选择 "Redeploy"

2. **初始化数据库**
   ```bash
   cd /Users/a004/Desktop/binance-trading-dashboard
   export DATABASE_URL="你的Neon连接字符串"
   npx prisma db push
   ```

3. **测试访问**
   - https://tradehub-zeta.vercel.app
   - 注册新用户
   - 使用手动验证
   - 登录测试

---

## ✅ 检查清单

配置完成后，确认：
- [ ] 所有9个环境变量已添加
- [ ] DATABASE_URL是真实的连接字符串
- [ ] 已重新部署
- [ ] 数据库表已创建（prisma db push）
- [ ] 能够注册用户
- [ ] 能够登录
- [ ] 不再出现数据库连接错误

---

## 🆘 如果还有问题

### 错误：数据库连接失败
- 检查DATABASE_URL是否正确
- 检查Neon项目是否已启动（免费版会自动暂停）
- 重启Neon项目

### 错误：登录后404
- 检查NEXTAUTH_URL是否正确
- 必须是 `https://tradehub-zeta.vercel.app`
- 没有结尾的斜杠

### 错误：API加密失败
- 检查ENCRYPTION_KEY是否正确
- 必须是64位十六进制字符串

---

**配置完成后，您的币安交易复盘系统就可以正常使用了！** 🎉
