#!/bin/bash

# 币安交易复盘系统 - 数据库初始化脚本

echo "🚀 开始初始化数据库..."
echo ""

# 检查是否提供了数据库URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ 错误：未找到DATABASE_URL环境变量"
    echo ""
    echo "请按以下方式执行："
    echo "export DATABASE_URL='你的Neon连接字符串'"
    echo "./init-database.sh"
    echo ""
    echo "或者一行执行："
    echo "DATABASE_URL='你的Neon连接字符串' ./init-database.sh"
    exit 1
fi

echo "✅ 检测到数据库连接字符串"
echo ""

# 显示连接信息（隐藏密码）
masked_url=$(echo $DATABASE_URL | sed 's/:[^@]*@/:****@/')
echo "📊 数据库: $masked_url"
echo ""

# 执行Prisma推送
echo "📝 正在创建数据库表..."
npx prisma db push

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 数据库初始化成功！"
    echo ""
    echo "✅ 已创建的表："
    echo "  - users (用户表)"
    echo "  - api_configs (API配置表)"
    echo "  - positions (持仓表)"
    echo "  - trades (交易表)"
    echo "  - account_snapshots (账户快照表)"
    echo ""
    echo "🌐 现在可以访问网站了："
    echo "   https://tradehub-zeta.vercel.app"
    echo ""
    echo "💡 下一步："
    echo "   1. 访问网站"
    echo "   2. 点击'立即注册'"
    echo "   3. 注册新用户"
    echo "   4. 使用手动验证功能"
    echo "   5. 登录并配置币安API"
else
    echo ""
    echo "❌ 数据库初始化失败"
    echo ""
    echo "可能的原因："
    echo "  1. 数据库连接字符串不正确"
    echo "  2. Neon项目未启动（免费版会自动暂停）"
    echo "  3. 网络连接问题"
    echo ""
    echo "解决方法："
    echo "  1. 检查DATABASE_URL是否正确"
    echo "  2. 访问Neon Dashboard检查项目状态"
    echo "  3. 重新启动Neon项目"
fi
