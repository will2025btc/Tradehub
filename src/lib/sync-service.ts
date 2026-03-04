import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { BinanceAPIClient, BinanceOrder } from '@/lib/binance-api';
import { BINANCE_FEE_RATE } from '@/lib/constants';

// ---- Types ----

export interface SyncConfig {
  userId: string;
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  apiConfigId: string;
  syncDays: number;
}

export interface SyncResult {
  tradesCount: number;
  positionsCount: number;
  accountBalance: number;
}

interface AggregatedPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  status: string;
  openTime: Date;
  closeTime: Date | null;
  avgOpenPrice: number;
  avgClosePrice: number | null;
  quantity: number;
  maxQuantity: number;
  maxPositionValue: number;
  maxMargin: number;
  realizedPnl: number;
  fee: number;
  orders: BinanceOrder[];
}

// ---- Main sync function ----

export async function syncUserData(config: SyncConfig): Promise<SyncResult> {
  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const apiSecret = decryptApiKey(config.apiSecretEncrypted);
  const binanceClient = new BinanceAPIClient(apiKey, apiSecret);

  // 1. 获取账户信息并创建快照
  const accountInfo = await binanceClient.getAccountInfo();
  await prisma.accountSnapshot.create({
    data: {
      userId: config.userId,
      balance: parseFloat(accountInfo.totalWalletBalance),
      unrealizedPnl: parseFloat(accountInfo.totalUnrealizedProfit),
      totalEquity: parseFloat(accountInfo.totalMarginBalance),
      snapshotTime: new Date(),
    },
  });

  // 2. 并行获取当前持仓 + 历史订单
  const [currentPositions, ordersMap] = await Promise.all([
    binanceClient.getPositionRisk(),
    binanceClient.getAllOrdersForAllSymbols(config.syncDays),
  ]);

  // 3. 处理每个交易对的订单
  let totalTrades = 0;
  let totalPositions = 0;

  for (const [symbol, orders] of Array.from(ordersMap.entries())) {
    const filledOrders = orders.filter((o) => o.status === 'FILLED');
    if (filledOrders.length === 0) continue;

    // 获取该交易对的当前持仓信息（用于杠杆等信息）
    const currentPos = currentPositions.find(p => p.symbol === symbol);
    const leverage = currentPos ? parseInt(currentPos.leverage) : 10;

    // 按 positionSide 分组并聚合订单
    const positions = aggregateOrdersByPositionSide(filledOrders, symbol, leverage);

    // 批量查询已有 Position（消除 N+1）
    const existingPositions = await prisma.position.findMany({
      where: { userId: config.userId, symbol },
      select: { openTime: true, side: true },
    });
    const existingKeys = new Set(
      existingPositions.map(p => `${p.openTime.toISOString()}_${p.side}`)
    );

    // 只处理新 position
    const newPositions = positions.filter(
      p => !existingKeys.has(`${p.openTime.toISOString()}_${p.side}`)
    );

    for (const posData of newPositions) {
      // 创建 position
      const position = await prisma.position.create({
        data: {
          userId: config.userId,
          symbol: posData.symbol,
          side: posData.side,
          leverage: posData.leverage,
          status: posData.status,
          openTime: posData.openTime,
          closeTime: posData.closeTime,
          avgOpenPrice: posData.avgOpenPrice,
          avgClosePrice: posData.avgClosePrice,
          quantity: posData.quantity,
          maxQuantity: posData.maxQuantity,
          maxPositionValue: posData.maxPositionValue,
          maxMargin: posData.maxMargin,
          realizedPnl: posData.realizedPnl,
          fee: posData.fee,
        },
      });

      totalPositions++;

      // 批量创建 trade（skipDuplicates 利用 binanceOrderId unique 约束）
      const tradeData = posData.orders.map(order => ({
        userId: config.userId,
        positionId: position.id,
        binanceOrderId: order.orderId.toString(),
        symbol: order.symbol,
        side: order.side,
        positionSide: order.positionSide,
        orderType: order.type || 'MARKET',
        quantity: parseFloat(order.executedQty),
        price: parseFloat(order.avgPrice),
        fee: parseFloat(order.cumQuote) * BINANCE_FEE_RATE,
        time: new Date(order.time),
      }));

      await prisma.trade.createMany({
        data: tradeData,
        skipDuplicates: true,
      });

      totalTrades += tradeData.length;
    }
  }

  // 4. 更新最后同步时间
  await prisma.apiConfig.update({
    where: { id: config.apiConfigId },
    data: { lastSyncAt: new Date() },
  });

  console.log(`同步完成: ${totalTrades} 笔交易, ${totalPositions} 个持仓`);

  return {
    tradesCount: totalTrades,
    positionsCount: totalPositions,
    accountBalance: parseFloat(accountInfo.totalWalletBalance),
  };
}

// ---- Position aggregation functions ----

/**
 * 按 positionSide 分组并聚合订单
 * 核心算法，正确处理双向持仓
 */
function aggregateOrdersByPositionSide(
  orders: BinanceOrder[],
  symbol: string,
  leverage: number
): AggregatedPosition[] {
  // 按 positionSide 分组
  const grouped = new Map<string, BinanceOrder[]>();

  orders.forEach(order => {
    const key = order.positionSide || 'BOTH';
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(order);
  });

  const positions: AggregatedPosition[] = [];

  // 处理每个 positionSide 的订单
  for (const [positionSide, posOrders] of Array.from(grouped.entries())) {
    // 按时间排序
    const sortedOrders = posOrders.sort((a, b) => a.time - b.time);

    console.log(`处理 ${symbol} ${positionSide}:`, sortedOrders.length, '笔订单');

    // 根据 positionSide 确定方向
    let side: 'LONG' | 'SHORT';
    if (positionSide === 'LONG') {
      side = 'LONG';
    } else if (positionSide === 'SHORT') {
      side = 'SHORT';
    } else {
      // BOTH 模式，根据第一笔订单判断
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
): AggregatedPosition[] {
  const positions: AggregatedPosition[] = [];
  let currentPosition: AggregatedPosition | null = null;
  let currentQty = 0;
  let totalCost = 0;
  let totalFee = 0;

  for (const order of orders) {
    const qty = parseFloat(order.executedQty);
    const price = parseFloat(order.avgPrice);
    const fee = parseFloat(order.cumQuote) * BINANCE_FEE_RATE;

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
 */
function isOpeningOrder(order: BinanceOrder, side: 'LONG' | 'SHORT', positionSide: string): boolean {
  if (positionSide === 'LONG') {
    // 多头持仓：BUY 是开仓，SELL 是平仓
    return order.side === 'BUY';
  } else if (positionSide === 'SHORT') {
    // 空头持仓：SELL 是开仓，BUY 是平仓
    return order.side === 'SELL';
  } else {
    // BOTH 模式（单向持仓）
    if (side === 'LONG') {
      return order.side === 'BUY';
    } else {
      return order.side === 'SELL';
    }
  }
}
