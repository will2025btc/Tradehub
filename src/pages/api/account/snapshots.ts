import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { subMonths, subYears, format } from 'date-fns';

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
    const { range = 'all' } = req.query;

    // Calculate date range
    let startDate: Date | undefined;
    const now = new Date();

    switch (range) {
      case '1month':
        startDate = subMonths(now, 1);
        break;
      case '3month':
        startDate = subMonths(now, 3);
        break;
      case '1year':
        startDate = subYears(now, 1);
        break;
      case 'all':
      default:
        startDate = undefined;
        break;
    }

    // Fetch snapshots
    const snapshots = await prisma.accountSnapshot.findMany({
      where: {
        userId,
        ...(startDate && { snapshotTime: { gte: startDate } }),
      },
      orderBy: { snapshotTime: 'asc' },
    });

    // Get the first snapshot for initial capital calculation
    const firstSnapshot = await prisma.accountSnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotTime: 'asc' },
    });

    const initialCapital = firstSnapshot?.totalEquity ? Number(firstSnapshot.totalEquity) : 0;

    // Transform data for chart
    const chartData = snapshots.map(snapshot => {
      const equity = Number(snapshot.totalEquity);
      const returnRate = initialCapital > 0 ? ((equity - initialCapital) / initialCapital) * 100 : 0;

      return {
        date: format(snapshot.snapshotTime, 'yyyy-MM-dd'),
        returnRate: Number(returnRate.toFixed(2)),
        equity: Number(equity.toFixed(2)),
      };
    });

    res.status(200).json(chartData);
  } catch (error) {
    console.error('Error fetching account snapshots:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}