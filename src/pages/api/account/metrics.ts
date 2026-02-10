import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { differenceInDays, subMonths } from 'date-fns';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const userId = session.user.id;

    // Get latest account snapshot
    const latestSnapshot = await prisma.accountSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotTime: 'desc' },
    });

    // Get first snapshot for initial capital
    const firstSnapshot = await prisma.accountSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotTime: 'asc' },
    });

    // Get snapshot from 1 month ago
    const oneMonthAgo = subMonths(new Date(), 1);
    const monthAgoSnapshot = await prisma.accountSnapshot.findFirst({
      where: {
        userId,
        snapshotTime: { lte: oneMonthAgo },
      },
      orderBy: { snapshotTime: 'desc' },
    });

    // Get all closed positions for win rate and profit calculation
    const closedPositions = await prisma.position.findMany({
      where: {
        userId,
        status: 'CLOSED',
      },
    });

    // Calculate metrics
    const accountAsset = latestSnapshot?.totalEquity ? Number(latestSnapshot.totalEquity) : 0;
    const initialCapital = firstSnapshot?.totalEquity ? Number(firstSnapshot.totalEquity) : accountAsset;
    const totalProfit = accountAsset - initialCapital;
    const totalReturnRate = initialCapital > 0 ? (totalProfit / initialCapital) * 100 : 0;

    // Monthly return calculation
    const monthStartEquity = monthAgoSnapshot?.totalEquity ? Number(monthAgoSnapshot.totalEquity) : initialCapital;
    const monthlyProfit = accountAsset - monthStartEquity;
    const monthlyReturnRate = monthStartEquity > 0 ? (monthlyProfit / monthStartEquity) * 100 : 0;

    // Win rate calculation
    const winningPositions = closedPositions.filter(p => Number(p.realizedPnl) > 0).length;
    const winRate = closedPositions.length > 0 ? (winningPositions / closedPositions.length) * 100 : 0;

    // Max drawdown calculation
    const allSnapshots = await prisma.accountSnapshot.findMany({
      where: { userId },
      orderBy: { snapshotTime: 'asc' },
    });

    let maxDrawdown = 0;
    let peak = 0;
    for (const snapshot of allSnapshots) {
      const equity = Number(snapshot.totalEquity);
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // Days active calculation
    const daysActive = firstSnapshot
      ? differenceInDays(new Date(), firstSnapshot.snapshotTime)
      : 0;

    res.status(200).json({
      accountAsset,
      totalReturnRate,
      totalProfit,
      monthlyReturnRate,
      winRate,
      maxDrawdown,
      daysActive,
      initialCapital,
    });
  } catch (error) {
    console.error('Error fetching account metrics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
