import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { BinanceAPIClient, BinanceOrder } from '@/lib/binance-api';

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
    // 检查是否已配置API
    const apiConfig = await prisma.apiConfig.findFirst({
      where: { userId, isActive: true },
    });

    if (!apiConfig) {
      return res.status(400).json({ 
        message: '请先配置币安 API 密钥',
        needsConfig: true 
      });
    }

    // 解密API密钥
    const apiKey = decryptApiKey(apiConfig.apiKeyEncrypted);
    const apiSecret = decryptApiKey(apiConfig.apiSecretEncrypted);

    // 创建币安API客户端
    const binanceClient = new BinanceAPIClient(apiKey, apiSecret);

    console.log('开始同步数据...');

    // 获取账户信息
    const accountInfo = await binanceClient.getAccountInfo();
    
    // 创建账户快照
    await prisma.accountSnapshot.create({
      data: {
        userId,
        balance: parseFloat(accountInfo.totalWalletBalance),
        unrealizedPnl: parseFloat(accountInfo.totalUnrealizedProfit),
        totalEquity: parseFloat(accountInfo.totalMarginBalance),
        snapshotTime: new Date(),
      },
    });

    // 获取当前持仓（重要！）
    const currentPositions = await binanceClient.getPositionRisk();
    console.log('当前持仓数:', currentPositions.filter(p => parseFloat(p.positionAmt) !== 0).length);

    // 获取过去7天的所有订单
    const ordersMap = await binanceClient.getAllOrdersForAllSymbols(7);
    
    let totalTrades = 0;
    let totalPositions = 0;

    // 处理每个交易对的订单
    for (const [symbol, orders] of Array.from(ordersMap.entries())) {
      // 过滤已成交的订单
      const filledOrders = orders.filter((o: any) => o.status === 'FILLED');
      
      if (filledOrders.length === 0) continue;

      // 获取该交易对的当前持仓信息（用于杠杆等信息）
      const currentPos = currentPositions.find(p => p.symbol === symbol);
      const leverage = currentPos ? parseInt(currentPos.leverage) : 10;

      // 按positionSide分组订单（关键！）
      const positions = aggregateOrdersByPositionSide(filledOrders, symbol, leverage);
      
      for (const positionData of positions) {
        // 检查持仓是否已存在
        const existing = await prisma.position.findFirst({
          where: {
            userId,
            symbol: positionData.symbol,
            openTime: positionData.openTime,
            side: positionData.side,
          },
        });

        if (!existing) {
          // 创建新持仓
          const position = await prisma.position.create({
            data: {
              userId,
              symbol: positionData.symbol,
              side: positionData.side,
              leverage: positionData.leverage,
              status: positionData.status,
              openTime: positionData.openTime,
              closeTime: positionData.closeTime,
              avgOpenPrice: positionData.avgOpenPrice,
              avgClosePrice: positionData.avgClosePrice,
              quantity: positionData.quantity,
              maxQuantity: positionData.maxQuantity,
              maxPositionValue: positionData.maxPositionValue,
              maxMargin: positionData.maxMargin,
              realizedPnl: positionData.realizedPnl,
              fee: positionData.fee,
            },
          });

          totalPositions++;

          // 存储相关的交易记录
          for (const order of positionData.orders) {
            await prisma.trade.upsert({
              where: { binanceOrderId: order.orderId.toString() },
              create: {
                userId,
                positionId: position.id,
                binanceOrderId: order.orderId.toString(),
                symbol: order.symbol,
                side: order.side,
                positionSide: order.positionSide,
                orderType: order.type || 'MARKET',
                quantity: parseFloat(order.executedQty),
                price: parseFloat(order.avgPrice),
                fee: parseFloat(order.cumQuote) * 0.0004, // 假设手续费率0.04%
                time: new Date(order.time),
              },
              update: {},
            });
            totalTrades++;
          }
        }
      }
    }

    // 更新最后同步时间
    await prisma.apiConfig.update({
      where: { id: apiConfig.id },
      data: { lastSyncAt: new Date() },
    });

    console.log(`同步完成: ${totalTrades} 笔交易, ${totalPositions} 个持仓`);

    return res.status(200).json({ 
      message: '数据同步成功',
      tradesCount: totalTrades,
      positionsCount: totalPositions,
      accountBalance: parseFloat(accountInfo.totalWalletBalance),
    });

  } catch (error) {
    console.error('同步失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return res.status(500).json({ 
      message: '同步失败: ' + errorMessage,
      error: errorMessage
    });
  }
}

/**
 * 按positionSide分组并聚合订单
 * 这是核心算法，正确处理双向持仓
 */
function aggregateOrdersByPositionSide(orders: BinanceOrder[], symbol: string, leverage: number) {
  // 按positionSide分组
  const grouped = new Map<string, BinanceOrder[]>();
  
  orders.forEach(order => {
    const key = order.positionSide || 'BOTH';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(order);
  });

  const positions: any[] = [];

  // 处理每个positionSide的订单
  for (const [positionSide, posOrders] of Array.from(grouped.entries())) {
    // 按时间排序
    const sortedOrders = posOrders.sort((a: BinanceOrder, b: BinanceOrder) => a.time - b.time);
    
    console.log(`处理 ${symbol} ${positionSide}:`, sortedOrders.length, '笔订单');

    // 根据positionSide确定方向
    let side: 'LONG' | 'SHORT';
    if (positionSide === 'LONG') {
      side = 'LONG';
    } else if (positionSide === 'SHORT') {
      side = 'SHORT';
    } else {
      // BOTH模式，根据第一笔订单判断
      side = sortedOrders[0].side === 'BUY' ? 'LONG' : 'SHORT';
    }

    const aggregated = aggregateOrdersForSinglePosition(sortedOrders, symbol, side, leverage, positionSide);
    positions.push(...aggregated);
  }

  return positions;
}

/**
 * 聚合单个方向的订单
 */
function aggregateOrdersForSinglePosition(
  orders: BinanceOrder[], 
  symbol: string, 
  side: 'LONG' | 'SHORT',
  leverage: number,
  positionSide: string
) {
  const positions: any[] = [];
  let currentPosition: any = null;
  let currentQty = 0;
  let totalCost = 0;
  let totalFee = 0;

  for (const order of orders) {
    const qty = parseFloat(order.executedQty);
    const price = parseFloat(order.avgPrice);
    const fee = parseFloat(order.cumQuote) * 0.0004;

    // 判断是开仓还是平仓
    const isOpening = isOpeningOrder(order, side, positionSide);

    if (isOpening) {
      // 开仓或加仓
      if (!currentPosition) {
        // 新开仓
        currentPosition = {
          symbol,
          side,
          leverage,
          status: 'OPEN',
          openTime: new Date(order.time),
          closeTime: null,
          avgOpenPrice: price,
          avgClosePrice: null,
          quantity: qty,
          maxQuantity: qty,
          maxPositionValue: qty * price,
          maxMargin: (qty * price) / leverage,
          realizedPnl: 0,
          fee,
          orders: [order],
        };
        currentQty = qty;
        totalCost = qty * price;
        totalFee = fee;
      } else {
        // 加仓
        currentQty += qty;
        totalCost += qty * price;
        totalFee += fee;
        
        currentPosition.avgOpenPrice = totalCost / currentQty;
        currentPosition.quantity = currentQty;
        currentPosition.maxQuantity = Math.max(currentPosition.maxQuantity, currentQty);
        currentPosition.maxPositionValue = Math.max(currentPosition.maxPositionValue, currentQty * price);
        currentPosition.maxMargin = Math.max(currentPosition.maxMargin, (currentQty * price) / leverage);
        currentPosition.fee = totalFee;
        currentPosition.orders.push(order);
      }
    } else {
      // 平仓或减仓
      if (currentPosition) {
        const closeQty = Math.min(qty, currentQty);
        
        // 计算盈亏
        let pnl;
        if (side === 'LONG') {
          pnl = closeQty * (price - currentPosition.avgOpenPrice);
        } else {
          pnl = closeQty * (currentPosition.avgOpenPrice - price);
        }
        
        currentQty -= closeQty;
        totalFee += fee;
        
        currentPosition.avgClosePrice = price;
        currentPosition.realizedPnl += pnl;
        currentPosition.fee = totalFee;
        currentPosition.orders.push(order);
        
        if (currentQty <= 0.0001) {
          // 完全平仓
          currentPosition.closeTime = new Date(order.time);
          currentPosition.status = 'CLOSED';
          currentPosition.quantity = 0;
          positions.push(currentPosition);
          
          // 重置状态
          currentPosition = null;
          currentQty = 0;
          totalCost = 0;
          totalFee = 0;
        } else {
          // 部分平仓，更新数量
          currentPosition.quantity = currentQty;
          totalCost = currentQty * currentPosition.avgOpenPrice;
        }
      }
    }
  }

  // 如果还有未平仓的持仓
  if (currentPosition && currentQty > 0) {
    positions.push(currentPosition);
  }

  return positions;
}

/**
 * 判断订单是否为开仓
 * 这是最关键的逻辑！
 */
function isOpeningOrder(order: BinanceOrder, side: 'LONG' | 'SHORT', positionSide: string): boolean {
  if (positionSide === 'LONG') {
    // 多头持仓：BUY是开仓，SELL是平仓
    return order.side === 'BUY';
  } else if (positionSide === 'SHORT') {
    // 空头持仓：SELL是开仓，BUY是平仓
    return order.side === 'SELL';
  } else {
    // BOTH模式（单向持仓）
    if (side === 'LONG') {
      return order.side === 'BUY';
    } else {
      return order.side === 'SELL';
    }
  }
}
