import crypto from 'crypto';

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

  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
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
   * 获取账户信息
   */
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    return this.makeRequest<BinanceAccountInfo>('/fapi/v2/account');
  }

  /**
   * 获取当前持仓信息（重要！）
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
    const params: Record<string, any> = { symbol };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    
    return this.makeRequest<BinanceOrder[]>('/fapi/v1/allOrders', params);
  }

  /**
   * 获取所有交易对的订单（改进版）
   * @param days 过去多少天的数据
   */
  async getAllOrdersForAllSymbols(days: number = 7): Promise<Map<string, BinanceOrder[]>> {
    // 先获取当前持仓
    const positions = await this.getPositionRisk();
    const symbols = new Set<string>();
    
    // 从持仓中获取所有有过交易的交易对（包括已平仓的）
    positions.forEach(pos => {
      // 只要有持仓金额或未实现盈亏，说明有过交易
      if (parseFloat(pos.positionAmt) !== 0 || parseFloat(pos.unRealizedProfit) !== 0) {
        symbols.add(pos.symbol);
      }
    });

    console.log(`Found ${symbols.size} symbols with positions:`, Array.from(symbols));

    const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const ordersMap = new Map<string, BinanceOrder[]>();

    for (const symbol of Array.from(symbols)) {
      try {
        const orders = await this.getAllOrders(symbol, startTime);
        if (orders.length > 0) {
          ordersMap.set(symbol, orders);
          console.log(`${symbol}: ${orders.length} orders`);
        }
      } catch (error) {
        console.error(`Error fetching orders for ${symbol}:`, error);
      }
    }

    return ordersMap;
  }

  /**
   * 获取用户成交历史
   */
  async getUserTrades(symbol: string, startTime?: number, endTime?: number): Promise<any[]> {
    const params: Record<string, any> = { symbol };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    
    return this.makeRequest<any[]>('/fapi/v1/userTrades', params);
  }
}
