// 手动验证用户账号脚本
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyUser(email) {
  try {
    console.log(`正在验证用户: ${email}`);
    
    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error('❌ 用户不存在');
      return;
    }

    console.log(`✅ 找到用户: ${user.displayName || user.email}`);
    console.log(`   当前验证状态: ${user.emailVerified ? '已验证' : '未验证'}`);

    if (user.emailVerified) {
      console.log('ℹ️  用户已经验证过了');
      return;
    }

    // 更新用户为已验证
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        verificationToken: null, // 清除验证令牌
      },
    });

    console.log('🎉 验证成功！');
    console.log(`   用户ID: ${updatedUser.id}`);
    console.log(`   邮箱: ${updatedUser.email}`);
    console.log(`   验证状态: ${updatedUser.emailVerified ? '已验证' : '未验证'}`);
    console.log('\n✅ 现在可以登录了！');
    
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// 从命令行参数获取邮箱
const email = process.argv[2];

if (!email) {
  console.error('请提供邮箱地址');
  console.log('用法: node verify-user.js your@email.com');
  process.exit(1);
}

verifyUser(email);
