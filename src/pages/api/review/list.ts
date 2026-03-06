import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

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
    const limit  = Math.min(Number(req.query.limit) || 30, 100);

    const reviews = await prisma.dailyReview.findMany({
      where:   { userId },
      orderBy: { date: 'desc' },
      take:    limit,
      select: {
        id:        true,
        date:      true,
        posCount:  true,
        totalPnl:  true,
        createdAt: true,
        // 列表不返回全文，避免响应过大
      },
    });

    return res.status(200).json(
      reviews.map((r: { id: string; date: string; posCount: number; totalPnl: { toString: () => string }; createdAt: Date }) => ({
        ...r,
        totalPnl: Number(r.totalPnl),
      }))
    );
  } catch (err) {
    console.error('[review/list] error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
