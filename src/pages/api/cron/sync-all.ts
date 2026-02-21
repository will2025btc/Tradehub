import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { BinanceAPIClient } from '@/lib/binance-api';

/**
 * Cron定时同步端点
 * 由Vercel Cron Jobs调用，同步所有活跃用户的数据
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 验证Cron密钥（防止外部调用）
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: '未授权' });
  }

  try {
    // 获取所有活跃的API配置
    const activeConfigs = await prisma.apiConfig.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    console.log(`[Cron] 开始同步 ${activeConfigs.length} 个用户的数据...`);

    let successCount = 0;
    let failCount = 0;

    for (const config of activeConfigs) {
      try {
        await syncUserData(config);
        successCount++;
        console.log(`[Cron] ✅ 用户 ${config.user.email} 同步成功`);
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

async function syncUserData(config: any) {
  const userId = config.userId;
  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const apiSecret = decryptApiKey(config.apiSecretEncrypted);

  const binanceClient = new BinanceAPIClient(apiKey, apiSecret);

  // 获取账户信息并创建快照
  const accountInfo = await binanceClient.getAccountInfo();
  
  await prisma.accountSnapshot.create({
    data: {
      userId,
      balance: parseFloat(accountInfo.totalWalletBalance),
      unrealizedPnl: parseFloat(accountInfo.totalUnrealizedProfit),
      totalEquity: parseFloat(accountInfo.totalMarginBalance),
      snapshotTime: new Date(),
    },
  });

  // 获取最近1天的订单（增量同步）
  const ordersMap = await binanceClient.getAllOrdersForAllSymbols(1);
  const currentPositions = await binanceClient.getPositionRisk();

  let totalTrades = 0;

  for (const [symbol, orders] of Array.from(ordersMap.entries())) {
    const filledOrders = orders.filter((o: any) => o.status === 'FILLED');
    if (filledOrders.length === 0) continue;

    for (const order of filledOrders) {
      // 只添加新的交易记录
      const existing = await prisma.trade.findUnique({
        where: { binanceOrderId: order.orderId.toString() },
      });

      if (!existing) {
        try {
          await prisma.trade.create({
            data: {
              userId,
              binanceOrderId: order.orderId.toString(),
              symbol: order.symbol,
              side: order.side,
              positionSide: order.positionSide,
              orderType: order.type || 'MARKET',
              quantity: parseFloat(order.executedQty),
              price: parseFloat(order.avgPrice),
              fee: parseFloat(order.cumQuote) * 0.0004,
              time: new Date(order.time),
            },
          });
          totalTrades++;
        } catch (e) {
          // 忽略重复记录
        }
      }
    }
  }

  // 更新最后同步时间
  await prisma.apiConfig.update({
    where: { id: config.id },
    data: { lastSyncAt: new Date() },
  });

  return totalTrades;
}
