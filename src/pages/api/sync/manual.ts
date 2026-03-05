import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { syncUserData } from '@/lib/sync-service';
import { MANUAL_SYNC_DAYS } from '@/lib/constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '方法不允许' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ message: '未授权' });
  }

  const userId = session.user.id;

  try {
    // 检查是否已配置 API
    const apiConfig = await prisma.apiConfig.findFirst({
      where: { userId, isActive: true },
    });

    if (!apiConfig) {
      return res.status(400).json({
        message: '请先配置交易所 API 密钥',
        needsConfig: true,
      });
    }

    console.log(`开始同步数据 [${apiConfig.exchange}]...`);

    const result = await syncUserData({
      userId,
      exchange: apiConfig.exchange,
      apiKeyEncrypted: apiConfig.apiKeyEncrypted,
      apiSecretEncrypted: apiConfig.apiSecretEncrypted,
      passphraseEncrypted: apiConfig.passphraseEncrypted,
      apiConfigId: apiConfig.id,
      syncDays: MANUAL_SYNC_DAYS,
    });

    return res.status(200).json({
      message: '数据同步成功',
      ...result,
    });
  } catch (error) {
    console.error('同步失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({
      message: '同步失败: ' + errorMessage,
      error: errorMessage,
    });
  }
}
