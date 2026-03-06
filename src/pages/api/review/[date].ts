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

  const date = req.query.date as string;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: '日期格式错误，应为 YYYY-MM-DD' });
  }

  try {
    const review = await prisma.dailyReview.findUnique({
      where: { userId_date: { userId: session.user.id, date } },
    });

    if (!review) {
      return res.status(404).json({ message: '该日期暂无复盘记录' });
    }

    return res.status(200).json({
      ...review,
      totalPnl: Number(review.totalPnl),
    });
  } catch (err) {
    console.error('[review/date] error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
