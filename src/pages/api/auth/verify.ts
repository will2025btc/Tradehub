import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '方法不允许' });
  }

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: '无效的验证令牌' });
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ message: '验证令牌无效或已过期' });
    }

    if (user.emailVerified) {
      return res.status(200).json({ message: '邮箱已经验证过了' });
    }

    // 更新用户状态
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null, // 清除令牌
      },
    });

    res.status(200).json({ message: '邮箱验证成功！现在可以登录了。' });
  } catch (error) {
    console.error('验证错误:', error);
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
}
