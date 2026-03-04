import crypto from 'crypto';
import { BINANCE_API_CONCURRENCY, BINANCE_API_MAX_RETRIES } from '@/lib/constants';

export interface BinanceOrder {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  closePosition: boolean;
  side: 'BUY' | 'SELL';
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  stopPrice: string;
  workingType: string;
  priceProtect: boolean;
  origType: string;
  time: number;
  updateTime: number;
}

export interface BinancePosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  maxNotionalValue: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: 'BOTH' | 'LONG' | 'SHORT';
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

export interface BinanceIncome {
  symbol: string;
  incomeType: string;  // TRANSFER, REALIZED_PNL, FUNDING_FEE, COMMISSION, etc.
  income: string;      // positive = inflow, negative = outflow
  asset: string;
  info: string;
  time: number;
  tranId: number;
  tradeId: string;
}

export interface BinanceAccountInfo {
  feeTier: number;
  canTrade: boolean;
  canDeposit: boolean;
  canWithdraw: boolean;
  updateTime: number;
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  totalCrossWalletBalance: string;
  totalCrossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  assets: Array<{
    asset: string;
    walletBalance: string;
    unrealizedProfit: string;
    marginBalance: string;
    maintMargin: string;
    initialMargin: string;
    positionInitialMargin: string;
    openOrderInitialMargin: string;
    maxWithdrawAmount: string;
    crossWalletBalance: string;
    crossUnPnl: string;
    availableBalance: string;
  }>;
  positions: Array<{
    symbol: string;
    initialMargin: string;
    maintMargin: string;
    unrealizedProfit: string;
    positionInitialMargin: string;
    openOrderInitialMargin: string;
    leverage: string;
    isolated: boolean;
    entryPrice: string;
    maxNotional: string;
    positionSide: string;
    positionAmt: string;
    notional: string;
    isolatedWallet: string;
    updateTime: number;
  }>;
}

export class BinanceAPIClient {
  private apiKey: string;
  private apiSecret: string;
  private baseURL: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseURL = process.env.BINANCE_API_URL || 'https://fapi.binance.com';
  }

  private generateSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async makeRequest<T>(endpoint: string, params: Record<string, string | number> = {}): Promise<T> {
    const timestamp = Date.now();
    const queryParams = {
      ...params,
      timestamp,
    };

    // 构建查询字符串
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // 生成签名
    const signature = this.generateSignature(queryString);
    const finalQueryString = `${queryString}&signature=${signature}`;

    // 发起请求
    const url = `${this.baseURL}${endpoint}?${finalQueryString}`;

    const response = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Binance API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * 带重试的请求包装器（指数退避）
   */
  private async fetchWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = BINANCE_API_MAX_RETRIES,
    context: string = ''
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRateLimit =
          lastError.message.includes('429') ||
          lastError.message.includes('-1015');

        if (attempt < maxRetries) {
          const baseDelay = isRateLimit ? 2000 : 500;
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(
            `[Binance] Retry ${attempt + 1}/${maxRetries} for ${context}: ${lastError.message}. Waiting ${delay}ms`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * 并发限制的批量执行器
   */
  private async mapWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number = BINANCE_API_CONCURRENCY
  ): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    async function worker() {
      while (index < items.length) {
        const currentIndex = index++;
        results[currentIndex] = await fn(items[currentIndex]);
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    );
    await Promise.all(workers);
    return results;
  }

  /**
   * 获取账户信息
   */
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    return this.makeRequest<BinanceAccountInfo>('/fapi/v2/account');
  }

  /**
   * 获取当前持仓信息
   */
  async getPositionRisk(): Promise<BinancePosition[]> {
    return this.makeRequest<BinancePosition[]>('/fapi/v2/positionRisk');
  }

  /**
   * 获取所有订单
   * @param symbol 交易对，如 'BTCUSDT'
   * @param startTime 开始时间戳
   * @param endTime 结束时间戳
   */
  async getAllOrders(symbol: string, startTime?: number, endTime?: number): Promise<BinanceOrder[]> {
    const params: Record<string, string | number> = { symbol };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return this.makeRequest<BinanceOrder[]>('/fapi/v1/allOrders', params);
  }

  /**
   * 获取所有交易对的订单（并发版，带重试）
   * @param days 过去多少天的数据
   * @param concurrency 并发数
   */
  async getAllOrdersForAllSymbols(
    days: number = 7,
    concurrency: number = BINANCE_API_CONCURRENCY
  ): Promise<Map<string, BinanceOrder[]>> {
    // 先获取当前持仓
    const positions = await this.getPositionRisk();
    const symbols: string[] = [];

    // 从持仓中获取所有有过交易的交易对（包括已平仓的）
    positions.forEach(pos => {
      if (parseFloat(pos.positionAmt) !== 0 || parseFloat(pos.unRealizedProfit) !== 0) {
        symbols.push(pos.symbol);
      }
    });

    console.log(`Found ${symbols.length} symbols with positions:`, symbols);

    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const ordersMap = new Map<string, BinanceOrder[]>();

    // 并发请求所有交易对的订单，带重试
    const results = await this.mapWithConcurrency(
      symbols,
      async (symbol) => {
        const orders = await this.fetchWithRetry(
          () => this.getAllOrders(symbol, startTime),
          BINANCE_API_MAX_RETRIES,
          symbol
        );
        return { symbol, orders };
      },
      concurrency
    );

    for (const { symbol, orders } of results) {
      if (orders.length > 0) {
        ordersMap.set(symbol, orders);
        console.log(`${symbol}: ${orders.length} orders`);
      }
    }

    return ordersMap;
  }

  /**
   * 获取用户成交历史
   */
  async getUserTrades(symbol: string, startTime?: number, endTime?: number): Promise<BinanceOrder[]> {
    const params: Record<string, string | number> = { symbol };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return this.makeRequest<BinanceOrder[]>('/fapi/v1/userTrades', params);
  }

  /**
   * 获取收入历史（用于追踪出入金/资金费率等）
   * @param incomeType 收入类型：TRANSFER, REALIZED_PNL, FUNDING_FEE, COMMISSION 等
   * @param startTime 开始时间戳
   * @param endTime 结束时间戳
   * @param limit 返回数量，最大1000
   */
  async getIncomeHistory(
    incomeType?: string,
    startTime?: number,
    endTime?: number,
    limit: number = 1000
  ): Promise<BinanceIncome[]> {
    const params: Record<string, string | number> = { limit };
    if (incomeType) params.incomeType = incomeType;
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;

    return this.fetchWithRetry(
      () => this.makeRequest<BinanceIncome[]>('/fapi/v1/income', params),
      BINANCE_API_MAX_RETRIES,
      'getIncomeHistory'
    );
  }

  /**
   * 获取所有出入金记录（自动分页处理，因为API限制最多1000条）
   * TRANSFER 类型: 正数=转入(入金), 负数=转出(出金)
   * @param startTime 开始时间戳
   */
  async getAllTransfers(startTime?: number): Promise<BinanceIncome[]> {
    const allTransfers: BinanceIncome[] = [];
    let currentStartTime = startTime;
    const now = Date.now();

    while (true) {
      const transfers = await this.getIncomeHistory(
        'TRANSFER',
        currentStartTime,
        undefined,
        1000
      );

      if (transfers.length === 0) break;

      allTransfers.push(...transfers);

      // 如果返回数量小于1000，说明已经没有更多数据
      if (transfers.length < 1000) break;

      // 用最后一条记录的时间作为下一次查询的起始时间
      currentStartTime = transfers[transfers.length - 1].time + 1;

      // 安全检查：防止无限循环
      if (currentStartTime >= now) break;
    }

    return allTransfers;
  }
}
