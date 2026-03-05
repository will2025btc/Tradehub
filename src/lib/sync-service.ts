import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { BinanceAPIClient, BinanceOrder } from '@/lib/binance-api';
import { OKXAPIClient, OKXOrder, OKXInstrument } from '@/lib/okx-api';
import { BINANCE_FEE_RATE } from '@/lib/constants';

// ---- Types ----

export interface SyncConfig {
  userId: string;
  exchange: string;                   // "binance" | "okx"
  apiKeyEncrypted: string;
  apiSecretEncrypted: string;
  passphraseEncrypted?: string | null; // OKX 专用
  apiConfigId: string;
  syncDays: number;
}

export interface SyncResult {
  tradesCount: number;
  positionsCount: number;
  accountBalance: number;
  transfersCount: number;
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

// ---- Main sync dispatcher ----

export async function syncUserData(config: SyncConfig): Promise<SyncResult> {
  if (config.exchange === 'okx') {
    return syncOKXUserData(config);
  }
  return syncBinanceUserData(config);
}

// ================================================================
//  BINANCE SYNC
// ================================================================

async function syncBinanceUserData(config: SyncConfig): Promise<SyncResult> {
  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const apiSecret = decryptApiKey(config.apiSecretEncrypted);
  const binanceClient = new BinanceAPIClient(apiKey, apiSecret);

  // 1. 同步出入金记录
  const transfersCount = await syncBinanceTransfers(binanceClient, config.userId);

  // 2. 计算累计净出入金金额
  const netTransfer = await calculateNetTransfer(config.userId);

  // 3. 获取账户信息并创建快照
  const accountInfo = await binanceClient.getAccountInfo();
  await prisma.accountSnapshot.create({
    data: {
      userId: config.userId,
      balance: parseFloat(accountInfo.totalWalletBalance),
      unrealizedPnl: parseFloat(accountInfo.totalUnrealizedProfit),
      totalEquity: parseFloat(accountInfo.totalMarginBalance),
      netTransfer,
      snapshotTime: new Date(),
    },
  });

  // 4. 并行获取当前持仓 + 历史订单
  const [currentPositions, ordersMap] = await Promise.all([
    binanceClient.getPositionRisk(),
    binanceClient.getAllOrdersForAllSymbols(config.syncDays),
  ]);

  // 5. 处理每个交易对的订单
  let totalTrades = 0;
  let totalPositions = 0;

  for (const [symbol, orders] of Array.from(ordersMap.entries())) {
    const filledOrders = orders.filter((o) => o.status === 'FILLED');
    if (filledOrders.length === 0) continue;

    const currentPos = currentPositions.find(p => p.symbol === symbol);
    const leverage = currentPos ? parseInt(currentPos.leverage) : 10;

    const positions = aggregateOrdersByPositionSide(filledOrders, symbol, leverage);

    const existingPositions = await prisma.position.findMany({
      where: { userId: config.userId, symbol, exchange: 'binance' },
      select: { openTime: true, side: true },
    });
    const existingKeys = new Set(
      existingPositions.map(p => `${p.openTime.toISOString()}_${p.side}`)
    );

    const newPositions = positions.filter(
      p => !existingKeys.has(`${p.openTime.toISOString()}_${p.side}`)
    );

    for (const posData of newPositions) {
      const position = await prisma.position.create({
        data: {
          userId: config.userId,
          exchange: 'binance',
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

      const tradeData = posData.orders.map(order => ({
        userId: config.userId,
        positionId: position.id,
        exchange: 'binance',
        exchangeOrderId: order.orderId.toString(),
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

  await prisma.apiConfig.update({
    where: { id: config.apiConfigId },
    data: { lastSyncAt: new Date() },
  });

  console.log(`[Binance] 同步完成: ${totalTrades} 笔交易, ${totalPositions} 个持仓, ${transfersCount} 笔出入金`);

  return {
    tradesCount: totalTrades,
    positionsCount: totalPositions,
    accountBalance: parseFloat(accountInfo.totalWalletBalance),
    transfersCount,
  };
}

// ================================================================
//  OKX SYNC
// ================================================================

async function syncOKXUserData(config: SyncConfig): Promise<SyncResult> {
  const apiKey = decryptApiKey(config.apiKeyEncrypted);
  const apiSecret = decryptApiKey(config.apiSecretEncrypted);
  const passphrase = config.passphraseEncrypted
    ? decryptApiKey(config.passphraseEncrypted)
    : '';

  const okxClient = new OKXAPIClient(apiKey, apiSecret, passphrase);

  // 1. 获取合约信息（ctVal，合约面值）
  const instruments = await okxClient.getInstruments();
  const ctValMap = new Map<string, number>(
    instruments.map(i => [i.instId, parseFloat(i.ctVal) || 1])
  );

  // 2. 同步出入金记录
  const transfersCount = await syncOKXTransfers(okxClient, config.userId);

  // 3. 计算累计净出入金
  const netTransfer = await calculateNetTransfer(config.userId);

  // 4. 获取账户快照
  const accountBalance = await okxClient.getAccountBalance();
  const usdtDetail = accountBalance.details.find(d => d.ccy === 'USDT');
  const walletBalance = usdtDetail ? parseFloat(usdtDetail.cashBal) : parseFloat(accountBalance.totalEq);
  const unrealizedPnl = usdtDetail ? parseFloat(usdtDetail.upl) : 0;
  const totalEquity = usdtDetail ? parseFloat(usdtDetail.eq) : parseFloat(accountBalance.totalEq);

  await prisma.accountSnapshot.create({
    data: {
      userId: config.userId,
      balance: walletBalance,
      unrealizedPnl,
      totalEquity,
      netTransfer,
      snapshotTime: new Date(),
    },
  });

  // 5. 获取历史订单
  const allOrders = await okxClient.getAllOrders(config.syncDays);

  // 6. 按 instId 分组
  const ordersBySymbol = new Map<string, OKXOrder[]>();
  for (const order of allOrders) {
    const list = ordersBySymbol.get(order.instId) || [];
    list.push(order);
    ordersBySymbol.set(order.instId, list);
  }

  let totalTrades = 0;
  let totalPositions = 0;

  for (const [instId, orders] of Array.from(ordersBySymbol.entries())) {
    const ctVal = ctValMap.get(instId) ?? 1;
    const positions = aggregateOKXOrders(orders, instId, ctVal);

    const existingPositions = await prisma.position.findMany({
      where: { userId: config.userId, symbol: instId, exchange: 'okx' },
      select: { openTime: true, side: true },
    });
    const existingKeys = new Set(
      existingPositions.map(p => `${p.openTime.toISOString()}_${p.side}`)
    );

    const newPositions = positions.filter(
      p => !existingKeys.has(`${p.openTime.toISOString()}_${p.side}`)
    );

    for (const posData of newPositions) {
      const position = await prisma.position.create({
        data: {
          userId: config.userId,
          exchange: 'okx',
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

      const tradeData = posData.okxOrders.map(order => ({
        userId: config.userId,
        positionId: position.id,
        exchange: 'okx',
        exchangeOrderId: order.ordId,
        symbol: order.instId,
        side: order.side.toUpperCase(),       // "buy" -> "BUY"
        positionSide: order.posSide.toUpperCase(), // "long" -> "LONG"
        orderType: order.ordType.toUpperCase(),
        quantity: parseFloat(order.accFillSz) * ctVal, // 转换为基础货币
        price: parseFloat(order.avgPx),
        fee: Math.abs(parseFloat(order.fee)),           // fee 负数转正
        realizedPnl: parseFloat(order.pnl) || 0,
        time: new Date(parseInt(order.cTime)),
      }));

      await prisma.trade.createMany({
        data: tradeData,
        skipDuplicates: true,
      });

      totalTrades += tradeData.length;
    }
  }

  await prisma.apiConfig.update({
    where: { id: config.apiConfigId },
    data: { lastSyncAt: new Date() },
  });

  console.log(`[OKX] 同步完成: ${totalTrades} 笔交易, ${totalPositions} 个持仓, ${transfersCount} 笔出入金`);

  return {
    tradesCount: totalTrades,
    positionsCount: totalPositions,
    accountBalance: walletBalance,
    transfersCount,
  };
}

// ================================================================
//  OKX Position Aggregation
// ================================================================

interface OKXAggregatedPosition {
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
  okxOrders: OKXOrder[];
}

/**
 * OKX 订单聚合成持仓（按 posSide 分组，逻辑与 Binance 类似）
 */
function aggregateOKXOrders(
  orders: OKXOrder[],
  instId: string,
  ctVal: number
): OKXAggregatedPosition[] {
  // 按 posSide 分组（long / short / net）
  const grouped = new Map<string, OKXOrder[]>();
  for (const order of orders) {
    const key = order.posSide || 'net';
    const list = grouped.get(key) || [];
    list.push(order);
    grouped.set(key, list);
  }

  const allPositions: OKXAggregatedPosition[] = [];

  for (const [posSide, sideOrders] of Array.from(grouped.entries())) {
    // 按时间排序
    const sorted = sideOrders.sort((a, b) => parseInt(a.cTime) - parseInt(b.cTime));

    let side: 'LONG' | 'SHORT';
    if (posSide === 'long') {
      side = 'LONG';
    } else if (posSide === 'short') {
      side = 'SHORT';
    } else {
      // net 模式：根据第一笔订单判断
      side = sorted[0].side === 'buy' ? 'LONG' : 'SHORT';
    }

    const positions = aggregateOKXSingleSide(sorted, instId, side, posSide, ctVal);
    allPositions.push(...positions);
  }

  return allPositions;
}

function aggregateOKXSingleSide(
  orders: OKXOrder[],
  instId: string,
  side: 'LONG' | 'SHORT',
  posSide: string,
  ctVal: number
): OKXAggregatedPosition[] {
  const positions: OKXAggregatedPosition[] = [];
  let currentPosition: OKXAggregatedPosition | null = null;
  let currentQty = 0;   // 以基础货币计
  let totalCost = 0;
  let totalFee = 0;
  let totalPnl = 0;

  for (const order of orders) {
    const contractsQty = parseFloat(order.accFillSz);
    const qty = contractsQty * ctVal;            // 转为基础货币
    const price = parseFloat(order.avgPx);
    const fee = Math.abs(parseFloat(order.fee)); // OKX fee 为负数
    const pnl = parseFloat(order.pnl) || 0;
    const leverage = parseFloat(order.lever) || 10;

    const isOpening = isOKXOpeningOrder(order, side, posSide);

    if (isOpening) {
      if (!currentPosition) {
        currentPosition = {
          symbol: instId,
          side,
          leverage: Math.round(leverage),
          status: 'OPEN',
          openTime: new Date(parseInt(order.cTime)),
          closeTime: null,
          avgOpenPrice: price,
          avgClosePrice: null,
          quantity: qty,
          maxQuantity: qty,
          maxPositionValue: qty * price,
          maxMargin: (qty * price) / leverage,
          realizedPnl: 0,
          fee,
          okxOrders: [order],
        };
        currentQty = qty;
        totalCost = qty * price;
        totalFee = fee;
        totalPnl = 0;
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
        currentPosition.okxOrders.push(order);
      }
    } else {
      // 平仓
      if (currentPosition) {
        const closeQty = Math.min(qty, currentQty);
        currentQty -= closeQty;
        totalFee += fee;
        totalPnl += pnl;

        currentPosition.avgClosePrice = price;
        currentPosition.realizedPnl = totalPnl;
        currentPosition.fee = totalFee;
        currentPosition.okxOrders.push(order);

        if (currentQty <= 0.000001) {
          // 完全平仓
          currentPosition.closeTime = new Date(parseInt(order.cTime));
          currentPosition.status = 'CLOSED';
          currentPosition.quantity = 0;
          positions.push(currentPosition);

          currentPosition = null;
          currentQty = 0;
          totalCost = 0;
          totalFee = 0;
          totalPnl = 0;
        } else {
          currentPosition.quantity = currentQty;
          totalCost = currentQty * currentPosition.avgOpenPrice;
        }
      }
    }
  }

  // 未平仓持仓
  if (currentPosition && currentQty > 0) {
    positions.push(currentPosition);
  }

  return positions;
}

/**
 * OKX：判断订单是否为开仓方向
 */
function isOKXOpeningOrder(
  order: OKXOrder,
  side: 'LONG' | 'SHORT',
  posSide: string
): boolean {
  if (posSide === 'long') {
    return order.side === 'buy';
  } else if (posSide === 'short') {
    return order.side === 'sell';
  } else {
    // net 单向模式
    return side === 'LONG' ? order.side === 'buy' : order.side === 'sell';
  }
}

// ================================================================
//  Transfer Sync
// ================================================================

async function syncBinanceTransfers(
  binanceClient: BinanceAPIClient,
  userId: string
): Promise<number> {
  const lastTransfer = await prisma.transfer.findFirst({
    where: { userId, exchange: 'binance' },
    orderBy: { time: 'desc' },
  });

  const startTime = lastTransfer
    ? lastTransfer.time.getTime() + 1
    : undefined;

  const transfers = await binanceClient.getAllTransfers(startTime);
  if (transfers.length === 0) return 0;

  const transferData = transfers.map(t => ({
    userId,
    exchange: 'binance',
    exchangeTransId: t.tranId.toString(),
    type: parseFloat(t.income) >= 0 ? 'DEPOSIT' : 'WITHDRAWAL',
    amount: Math.abs(parseFloat(t.income)),
    asset: t.asset || 'USDT',
    time: new Date(t.time),
  }));

  const result = await prisma.transfer.createMany({
    data: transferData,
    skipDuplicates: true,
  });

  console.log(`[Binance] 同步出入金: ${result.count} 笔新记录`);
  return result.count;
}

async function syncOKXTransfers(
  okxClient: OKXAPIClient,
  userId: string
): Promise<number> {
  const [deposits, withdrawals] = await Promise.all([
    okxClient.getDepositHistory('USDT'),
    okxClient.getWithdrawalHistory('USDT'),
  ]);

  const transferData = [
    ...deposits.map(d => ({
      userId,
      exchange: 'okx',
      exchangeTransId: `dep_${d.depId}`,
      type: 'DEPOSIT',
      amount: parseFloat(d.amt),
      asset: d.ccy || 'USDT',
      time: new Date(parseInt(d.ts)),
    })),
    ...withdrawals.map(w => ({
      userId,
      exchange: 'okx',
      exchangeTransId: `wd_${w.wdId}`,
      type: 'WITHDRAWAL',
      amount: parseFloat(w.amt),
      asset: w.ccy || 'USDT',
      time: new Date(parseInt(w.ts)),
    })),
  ];

  if (transferData.length === 0) return 0;

  const result = await prisma.transfer.createMany({
    data: transferData,
    skipDuplicates: true,
  });

  console.log(`[OKX] 同步出入金: ${result.count} 笔新记录`);
  return result.count;
}

// ================================================================
//  Shared Utilities
// ================================================================

async function calculateNetTransfer(userId: string): Promise<number> {
  const deposits = await prisma.transfer.aggregate({
    where: { userId, type: 'DEPOSIT' },
    _sum: { amount: true },
  });

  const withdrawals = await prisma.transfer.aggregate({
    where: { userId, type: 'WITHDRAWAL' },
    _sum: { amount: true },
  });

  return Number(deposits._sum.amount || 0) - Number(withdrawals._sum.amount || 0);
}

// ================================================================
//  Binance Position Aggregation (original logic, unchanged)
// ================================================================

function aggregateOrdersByPositionSide(
  orders: BinanceOrder[],
  symbol: string,
  leverage: number
): AggregatedPosition[] {
  const grouped = new Map<string, BinanceOrder[]>();

  orders.forEach(order => {
    const key = order.positionSide || 'BOTH';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(order);
  });

  const positions: AggregatedPosition[] = [];

  for (const [positionSide, posOrders] of Array.from(grouped.entries())) {
    const sortedOrders = posOrders.sort((a, b) => a.time - b.time);

    let side: 'LONG' | 'SHORT';
    if (positionSide === 'LONG') {
      side = 'LONG';
    } else if (positionSide === 'SHORT') {
      side = 'SHORT';
    } else {
      side = sortedOrders[0].side === 'BUY' ? 'LONG' : 'SHORT';
    }

    const aggregated = aggregateOrdersForSinglePosition(sortedOrders, symbol, side, leverage, positionSide);
    positions.push(...aggregated);
  }

  return positions;
}

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

    const isOpening = isOpeningOrder(order, side, positionSide);

    if (isOpening) {
      if (!currentPosition) {
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
      if (currentPosition) {
        const closeQty = Math.min(qty, currentQty);

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
          currentPosition.closeTime = new Date(order.time);
          currentPosition.status = 'CLOSED';
          currentPosition.quantity = 0;
          positions.push(currentPosition);

          currentPosition = null;
          currentQty = 0;
          totalCost = 0;
          totalFee = 0;
        } else {
          currentPosition.quantity = currentQty;
          totalCost = currentQty * currentPosition.avgOpenPrice;
        }
      }
    }
  }

  if (currentPosition && currentQty > 0) {
    positions.push(currentPosition);
  }

  return positions;
}

function isOpeningOrder(order: BinanceOrder, side: 'LONG' | 'SHORT', positionSide: string): boolean {
  if (positionSide === 'LONG') {
    return order.side === 'BUY';
  } else if (positionSide === 'SHORT') {
    return order.side === 'SELL';
  } else {
    return side === 'LONG' ? order.side === 'BUY' : order.side === 'SELL';
  }
}
