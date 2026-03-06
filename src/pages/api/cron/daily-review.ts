import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { generateAndSaveReview, getUserAiConfig } from '@/lib/review-service';
import { format, subDays } from 'date-fns';

/**
 * /api/cron/daily-review
 * 每日自动复盘 Cron — Vercel Cron Jobs 在每天 01:00 UTC 触发
 * 为每个已配置 AI 模型 + 交易所 API 的用户自动生成昨日复盘
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: '未授权' });
  }

  const targetDateStr = (req.query.date as string) || format(subDays(new Date(), 1), 'yyyy-MM-dd');

  try {
    // 取出所有有活跃交易所 API 的用户（去重）
    const activeUserIds = await prisma.apiConfig.findMany({
      where:    { isActive: true },
      select:   { userId: true },
      distinct: ['userId'],
    });

    console.log(`[Cron/daily-review] 开始为 ${activeUserIds.length} 个用户生成 ${targetDateStr} 复盘...`);

    let successCount = 0;
    let skipCount    = 0;
    let noAiCount    = 0;
    let failCount    = 0;

    for (const { userId } of activeUserIds) {
      // 检查是否已有复盘记录
      const existing = await prisma.dailyReview.findUnique({
        where: { userId_date: { userId, date: targetDateStr } },
      });
      if (existing) {
        skipCount++;
        continue;
      }

      // 检查用户是否配置了 AI 模型
      const aiConfig = await getUserAiConfig(userId);
      if (!aiConfig) {
        noAiCount++;
        console.log(`[Cron/daily-review] ⚠️  用户 ${userId} 未配置 AI 模型，跳过`);
        continue;
      }

      try {
        const { posCount, todayNetPnl } = await generateAndSaveReview(userId, targetDateStr, aiConfig);
        successCount++;
        console.log(
          `[Cron/daily-review] ✅ 用户 ${userId} | ${aiConfig.provider}/${aiConfig.model} | ${posCount} 笔 | $${todayNetPnl.toFixed(2)}`
        );
      } catch (err) {
        failCount++;
        console.error(`[Cron/daily-review] ❌ 用户 ${userId} 复盘失败:`, err);
      }
    }

    const result = {
      message:   '每日复盘 Cron 执行完毕',
      date:      targetDateStr,
      total:     activeUserIds.length,
      success:   successCount,
      skipped:   skipCount,
      noAiConfig: noAiCount,
      failed:    failCount,
      timestamp: new Date().toISOString(),
    };

    console.log('[Cron/daily-review]', result);
    return res.status(200).json(result);

  } catch (err) {
    console.error('[Cron/daily-review] 执行出错:', err);
    return res.status(500).json({ message: '每日复盘 Cron 执行失败' });
  }
}
