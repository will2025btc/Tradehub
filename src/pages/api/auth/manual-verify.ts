import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * 临时手动验证接口 - 仅用于开发环境
 * 生产环境应该删除此文件
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '方法不允许' });
  }

  // 仅在开发环境允许
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ message: '此功能仅在开发环境可用' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: '请提供邮箱地址' });
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (user.emailVerified) {
      return res.status(200).json({ message: '邮箱已经验证过了' });
    }

    // 手动验证用户
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
      },
    });

    res.status(200).json({ 
      message: '邮箱验证成功！现在可以登录了。',
      email: user.email 
    });
  } catch (error) {
    console.error('手动验证错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}
