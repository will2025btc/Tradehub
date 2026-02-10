import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { hashPassword, validatePassword } from '@/lib/password';
import { sendVerificationEmail } from '@/lib/email';
import crypto from 'crypto';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '方法不允许' });
  }

  try {
    const { email, password, displayName } = req.body;

    // 验证必填字段
    if (!email || !password) {
      return res.status(400).json({ message: '邮箱和密码不能为空' });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: '邮箱格式不正确' });
    }

    // 验证密码强度
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: '该邮箱已被注册' });
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);

    // 生成验证令牌
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        displayName: displayName || email.split('@')[0],
        emailVerified: false,
        verificationToken,
      },
    });

    // 发送验证邮件
    try {
      await sendVerificationEmail({
        to: email,
        token: verificationToken,
      });
    } catch (emailError) {
      console.error('发送验证邮件失败:', emailError);
      // 即使邮件发送失败，用户也已创建，所以返回成功但提示用户
      return res.status(201).json({
        message: '注册成功，但验证邮件发送失败。请联系管理员。',
        userId: user.id,
      });
    }

    res.status(201).json({
      message: '注册成功！请检查您的邮箱以验证账户。',
      userId: user.id,
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: '服务器错误，请稍后重试' });
  }
}
