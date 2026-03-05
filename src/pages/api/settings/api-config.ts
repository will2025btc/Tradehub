import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';
import { apiConfigInput } from '@/lib/validations';
import { BinanceAPIClient } from '@/lib/binance-api';
import { OKXAPIClient } from '@/lib/okx-api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: '未授权' });
  }

  const userId = session.user.id;

  // GET - 检查是否已有 API 配置
  if (req.method === 'GET') {
    try {
      const apiConfig = await prisma.apiConfig.findFirst({
        where: { userId },
      });

      return res.status(200).json({
        hasApi: !!apiConfig,
        isActive: apiConfig?.isActive || false,
        exchange: apiConfig?.exchange || 'binance',
      });
    } catch (error) {
      console.error('获取API配置失败:', error);
      return res.status(500).json({ message: '服务器错误' });
    }
  }

  // POST - 保存或更新 API 配置
  if (req.method === 'POST') {
    try {
      const parsed = apiConfigInput.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || 'API 参数不能为空',
        });
      }

      const { exchange, apiKey, apiSecret, passphrase } = parsed.data;

      // OKX 必须提供 passphrase
      if (exchange === 'okx' && !passphrase) {
        return res.status(400).json({ message: 'OKX 需要填写 Passphrase' });
      }

      // 连接测试
      try {
        if (exchange === 'binance') {
          const client = new BinanceAPIClient(apiKey, apiSecret);
          await client.getAccountInfo();
        } else if (exchange === 'okx') {
          const client = new OKXAPIClient(apiKey, apiSecret, passphrase!);
          const test = await client.testConnection();
          if (!test.success) {
            return res.status(400).json({ message: `OKX API 连接失败: ${test.message}` });
          }
        }
      } catch (testErr) {
        const msg = testErr instanceof Error ? testErr.message : 'API 连接测试失败';
        return res.status(400).json({ message: `API 连接测试失败: ${msg}` });
      }

      // 加密密钥
      const encryptedKey = encryptApiKey(apiKey);
      const encryptedSecret = encryptApiKey(apiSecret);
      const encryptedPassphrase = passphrase ? encryptApiKey(passphrase) : null;

      const existingConfig = await prisma.apiConfig.findFirst({
        where: { userId },
      });

      if (existingConfig) {
        await prisma.apiConfig.update({
          where: { id: existingConfig.id },
          data: {
            exchange,
            apiKeyEncrypted: encryptedKey,
            apiSecretEncrypted: encryptedSecret,
            passphraseEncrypted: encryptedPassphrase,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.apiConfig.create({
          data: {
            userId,
            exchange,
            apiKeyEncrypted: encryptedKey,
            apiSecretEncrypted: encryptedSecret,
            passphraseEncrypted: encryptedPassphrase,
            isActive: true,
          },
        });
      }

      return res.status(200).json({
        message: `${exchange === 'okx' ? 'OKX' : '币安'} API 配置保存成功，正在同步数据...`,
        success: true,
        shouldSync: true,
      });
    } catch (error) {
      console.error('保存API配置失败:', error);
      return res.status(500).json({ message: '保存失败，请稍后重试' });
    }
  }

  // DELETE - 删除 API 配置
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
        success: true,
      });
    } catch (error) {
      console.error('删除API配置失败:', error);
      return res.status(500).json({ message: '删除失败' });
    }
  }

  return res.status(405).json({ message: '方法不允许' });
}
