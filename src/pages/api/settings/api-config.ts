import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ message: '未授权' });
  }

  const userId = session.user.id;

  // GET - 检查是否已有API配置
  if (req.method === 'GET') {
    try {
      const apiConfig = await prisma.apiConfig.findFirst({
        where: { userId },
      });

      return res.status(200).json({
        hasApi: !!apiConfig,
        isActive: apiConfig?.isActive || false,
      });
    } catch (error) {
      console.error('获取API配置失败:', error);
      return res.status(500).json({ message: '服务器错误' });
    }
  }

  // POST - 保存或更新API配置
  if (req.method === 'POST') {
    try {
      const { apiKey, apiSecret } = req.body;

      if (!apiKey || !apiSecret) {
        return res.status(400).json({ message: 'API Key 和 Secret 不能为空' });
      }

      // 加密API密钥
      const encryptedKey = encryptApiKey(apiKey);
      const encryptedSecret = encryptApiKey(apiSecret);

      // 检查是否已存在配置
      const existingConfig = await prisma.apiConfig.findFirst({
        where: { userId },
      });

      if (existingConfig) {
        // 更新现有配置
        await prisma.apiConfig.update({
          where: { id: existingConfig.id },
          data: {
            apiKeyEncrypted: encryptedKey,
            apiSecretEncrypted: encryptedSecret,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        // 创建新配置
        await prisma.apiConfig.create({
          data: {
            userId,
            exchange: 'binance',
            apiKeyEncrypted: encryptedKey,
            apiSecretEncrypted: encryptedSecret,
            isActive: true,
          },
        });
      }

      // 保存成功后，自动触发数据同步
      try {
        // 这里可以触发后台任务或直接同步
        console.log('API配置已保存，准备同步数据...');
      } catch (syncError) {
        console.error('自动同步失败:', syncError);
      }

      return res.status(200).json({ 
        message: 'API 配置保存成功，正在同步数据...',
        success: true,
        shouldSync: true  // 告诉前端需要同步
      });
    } catch (error) {
      console.error('保存API配置失败:', error);
      return res.status(500).json({ message: '保存失败，请稍后重试' });
    }
  }

  // DELETE - 删除API配置
  if (req.method === 'DELETE') {
    try {
      const apiConfig = await prisma.apiConfig.findFirst({
        where: { userId },
      });

      if (!apiConfig) {
        return res.status(404).json({ message: 'API 配置不存在' });
      }

      await prisma.apiConfig.delete({
        where: { id: apiConfig.id },
      });

      return res.status(200).json({ 
        message: 'API 配置已删除',
        success: true 
      });
    } catch (error) {
      console.error('删除API配置失败:', error);
      return res.status(500).json({ message: '删除失败' });
    }
  }

  return res.status(405).json({ message: '方法不允许' });
}
