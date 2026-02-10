import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

/**
 * 验证码验证接口
 * 用户注册后使用6位验证码完成邮箱验证
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '方法不允许' });
  }

  try {
    const { email, code } = req.body;

    if (!email) {
      return res.status(400).json({ message: '请提供邮箱地址' });
    }

    if (!code) {
      return res.status(400).json({ message: '请提供验证码' });
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

    // 验证码校验
    if (user.verificationToken !== code.trim()) {
      return res.status(400).json({ message: '验证码错误，请重新输入' });
    }

    // 验证成功，更新用户
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
    console.error('验证错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
}
