# 🔄 如何重启Neon数据库

## 📝 详细步骤

### 第1步：访问Neon控制台

在浏览器打开：
```
https://console.neon.tech
```

### 第2步：登录

使用您注册Neon时的账号登录（GitHub或邮箱）

### 第3步：找到您的项目

登录后会看到项目列表：
- 项目名称
- 状态（Active/Suspended）
- 如果显示"Suspended"或灰色，说明已暂停

### 第4步：点击进入项目

点击您的项目名称进入项目详情页

### 第5步：重启项目

**如果项目显示已暂停：**
- 会看到一个蓝色的 **"Resume"** 或 **"Restart"** 按钮
- 点击这个按钮
- 等待10-30秒，项目会重新启动

**如果项目显示Active：**
- 说明项目已经在运行
- 直接继续下一步

### 第6步：获取新的连接字符串

项目启动后：

1. 在项目页面找到 **"Connection Details"** 或 **"Dashboard"**
2. 找到 **"Connection String"** 区域
3. 确保选择 **"Pooled connection"**（带pooler的）
4. 点击 **"Copy"** 复制整个连接字符串
5. 连接字符串格式类似：
   ```
   postgresql://用户名:密码@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```

---

## 🎯 复制连接字符串后

### 选项A：在终端直接执行（推荐）

```bash
cd /Users/a004/Desktop/binance-trading-dashboard

DATABASE_URL='粘贴您刚复制的连接字符串' npx prisma db push
```

### 选项B：更新Vercel环境变量（推荐）

1. 访问 https://vercel.com
2. 进入tradehub项目
3. Settings → Environment Variables
4. 找到DATABASE_URL，点击编辑
5. 粘贴新的连接字符串
6. 保存
7. Deployments → Redeploy

---

## 📸 参考位置

在Neon Dashboard中查找：

**左侧菜单：**
- Dashboard（主页）
- Branches（分支）
- Settings（设置）

**主页面：**
- 顶部会显示项目状态
- 中间有 Connection Details
- Connection String就在这里

**Connection String位置：**
```
┌─────────────────────────────────────┐
│ Connection Details                  │
├─────────────────────────────────────┤
│ Connection string                   │
│ ┌─────────────────────────────────┐ │
│ │ Pooled connection ▼             │ │
│ │ postgresql://user:pass@...      │ │
│ │                         [Copy]  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## ⚠️ 常见问题

### Q: 找不到Resume按钮？
**A:** 如果项目是Active状态，不需要Resume，直接复制连接字符串即可

### Q: 复制后还是认证失败？
**A:** 尝试使用"Direct connection"而不是"Pooled connection"

### Q: Neon免费版的限制？
**A:** 
- 5分钟无活动自动暂停
- 需要手动Resume
- 每月有活跃时间限制
- 但对于开发和小型项目完全够用

---

## 💡 提示

**完成后记得：**
1. 把新的连接字符串发给我
2. 或者自己执行初始化命令
3. 然后刷新网站测试

**需要帮助就告诉我！** 😊
