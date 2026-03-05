import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { syncUserData } from '@/lib/sync-service';
import { CRON_SYNC_DAYS } from '@/lib/constants';

/**
 * Cron 定时同步端点
 * 由 Vercel Cron Jobs 调用，同步所有活跃用户的数据
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证 Cron 密钥（防止外部调用）
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    // 获取所有活跃的 API 配置
    const activeConfigs = await prisma.apiConfig.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    console.log(`[Cron] 开始同步 ${activeConfigs.length} 个用户的数据...`);

    let successCount = 0;
    let failCount = 0;

    for (const config of activeConfigs) {
      try {
        await syncUserData({
          userId: config.userId,
          exchange: config.exchange,
          apiKeyEncrypted: config.apiKeyEncrypted,
          apiSecretEncrypted: config.apiSecretEncrypted,
          passphraseEncrypted: config.passphraseEncrypted,
          apiConfigId: config.id,
          syncDays: CRON_SYNC_DAYS,
        });
        successCount++;
        console.log(`[Cron] ✅ 用户 ${config.user.email} [${config.exchange}] 同步成功`);
      } catch (error) {
        failCount++;
        console.error(`[Cron] ❌ 用户 ${config.user.email} 同步失败:`, error);
      }
    }

    console.log(`[Cron] 同步完成: 成功 ${successCount}, 失败 ${failCount}`);

    return res.status(200).json({
      message: '定时同步完成',
      total: activeConfigs.length,
      success: successCount,
      failed: failCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] 定时同步出错:', error);
    return res.status(500).json({ message: '定时同步失败' });
  }
}
