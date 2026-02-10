import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '方法不允许' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session?.user?.id) {
    return res.status(401).json({ message: '未授权' });
  }

  const userId = session.user.id;
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: '无效的持仓ID' });
  }

  try {
    // 获取持仓详情
    const position = await prisma.position.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        trades: {
          orderBy: {
            time: 'asc',
          },
        },
      },
    });

    if (!position) {
      return res.status(404).json({ message: '持仓不存在' });
    }

    // 计算额外的统计信息
    const trades = position.trades;
    const openTrades = trades.filter(t => 
      (position.side === 'LONG' && t.side === 'BUY') ||
      (position.side === 'SHORT' && t.side === 'SELL')
    );
    const closeTrades = trades.filter(t =>
      (position.side === 'LONG' && t.side === 'SELL') ||
      (position.side === 'SHORT' && t.side === 'BUY')
    );

    // 计算交易额
    const totalTradeVolume = trades.reduce((sum, t) => sum + (Number(t.quantity) * Number(t.price)), 0);

    // 返回详细数据
    return res.status(200).json({
      position: {
        ...position,
        openTradesCount: openTrades.length,
        closeTradesCount: closeTrades.length,
        totalTradeVolume,
        profitPercentage: position.avgClosePrice && position.avgOpenPrice
          ? position.side === 'LONG'
            ? ((Number(position.avgClosePrice) - Number(position.avgOpenPrice)) / Number(position.avgOpenPrice) * position.leverage * 100)
            : ((Number(position.avgOpenPrice) - Number(position.avgClosePrice)) / Number(position.avgOpenPrice) * position.leverage * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error('获取持仓详情失败:', error);
    return res.status(500).json({ message: '服务器错误' });
  }
}
