import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
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
    const { status = 'all' } = req.query;

    const whereClause: any = { userId };
    
    if (status === 'open') {
      whereClause.status = 'OPEN';
    } else if (status === 'closed') {
      whereClause.status = 'CLOSED';
    }

    const positions = await prisma.position.findMany({
      where: whereClause,
      orderBy: { openTime: 'desc' },
      take: 100, // Limit to last 100 positions
    });

    // Transform Decimal fields to numbers for JSON serialization
    const transformedPositions = positions.map(position => ({
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      leverage: position.leverage,
      status: position.status,
      openTime: position.openTime.toISOString(),
      closeTime: position.closeTime?.toISOString() || null,
      avgOpenPrice: Number(position.avgOpenPrice),
      avgClosePrice: position.avgClosePrice ? Number(position.avgClosePrice) : null,
      quantity: Number(position.quantity),
      realizedPnl: Number(position.realizedPnl),
      fee: Number(position.fee),
    }));

    res.status(200).json(transformedPositions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
