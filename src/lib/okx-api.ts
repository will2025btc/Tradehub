/**
 * OKX Futures (SWAP) API Client
 * 支持 OKX 合约账户数据同步
 * 文档：https://www.okx.com/docs-v5/
 */

import crypto from 'crypto';
import { OKX_API_MAX_RETRIES, OKX_API_CONCURRENCY } from '@/lib/constants';

// ---- OKX Response wrapper ----
interface OKXResponse<T> {
  code: string;   // "0" = success
  msg: string;
  data: T;
}

// ---- Order ----
export interface OKXOrder {
  instId: string;        // e.g. "BTC-USDT-SWAP"
  ordId: string;         // order ID
  clOrdId: string;
  px: string;            // order price
  sz: string;            // order size in contracts
  pnl: string;           // realized PnL for this order
  ordType: string;       // "market" | "limit" | "ioc" | "fok"
  side: string;          // "buy" | "sell"
  posSide: string;       // "long" | "short" | "net"
  tdMode: string;        // "cross" | "isolated"
  accFillSz: string;     // total filled size in contracts
  fillPx: string;        // last fill price
  avgPx: string;         // average fill price
  state: string;         // "filled" | "canceled" | "live"
  lever: string;         // leverage
  feeCcy: string;        // fee currency
  fee: string;           // total fee (negative = cost)
  rebate: string;        // rebate amount
  cTime: string;         // creation timestamp (ms)
  uTime: string;         // update timestamp (ms)
}

// ---- Position ----
export interface OKXPosition {
  instId: string;
  posSide: string;       // "long" | "short" | "net"
  pos: string;           // position size in contracts
  mgnMode: string;       // "cross" | "isolated"
  lever: string;
  avgPx: string;         // average open price
  upl: string;           // unrealized PnL
  realizedPnl: string;
  cTime: string;
  uTime: string;
}

// ---- Account Balance ----
export interface OKXAccountBalance {
  totalEq: string;        // total equity in USD
  isoEq: string;
  adjEq: string;
  details: Array<{
    ccy: string;
    eq: string;           // equity (包含未实现盈亏)
    cashBal: string;      // cash balance
    availBal: string;     // available balance
    frozenBal: string;
    upl: string;          // unrealized PnL
    eqUsd: string;
  }>;
}

// ---- Instrument info (for ctVal) ----
export interface OKXInstrument {
  instId: string;
  ctVal: string;          // contract value (base currency per contract)
  ctMult: string;
  ctValCcy: string;       // base currency
  settleCcy: string;      // settle currency (USDT for USDT-M)
  tickSz: string;
  lotSz: string;
}

// ---- Deposit ----
export interface OKXDeposit {
  depId: string;
  ccy: string;
  chain: string;
  amt: string;
  txId: string;
  from: string;
  to: string;
  ts: string;
  state: string;          // "2" = success
}

// ---- Withdrawal ----
export interface OKXWithdrawal {
  wdId: string;
  ccy: string;
  chain: string;
  amt: string;
  txId: string;
  fee: string;
  ts: string;
  state: string;          // "2" = success
}

// ---- Funding Bills (internal transfer) ----
export interface OKXFundingBill {
  billId: string;
  ccy: string;
  bal: string;
  balChg: string;         // balance change (positive = in, negative = out)
  type: string;           // "13" = from trading to funding, "14" = from funding to trading
  ts: string;
}

// ---- Main OKX client ----
export class OKXAPIClient {
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private baseURL: string;

  constructor(apiKey: string, apiSecret: string, passphrase: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.passphrase = passphrase;
    this.baseURL = process.env.OKX_API_URL || 'https://www.okx.com';
  }

  /**
   * 生成 OKX 签名
   * sign = Base64( HMAC-SHA256( timestamp + method + path + body ) )
   */
  private sign(timestamp: string, method: string, path: string, body: string = ''): string {
    const message = `${timestamp}${method}${path}${body}`;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('base64');
  }

  /**
   * 通用 GET 请求
   */
  private async get<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const timestamp = new Date().toISOString();
    const queryString = Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString()
      : '';
    const fullPath = path + queryString;

    const signature = this.sign(timestamp, 'GET', fullPath);

    const url = `${this.baseURL}${fullPath}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'OK-ACCESS-KEY': this.apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': this.passphrase,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OKX HTTP Error: ${response.status} - ${text}`);
    }

    const json: OKXResponse<T> = await response.json();

    if (json.code !== '0') {
      throw new Error(`OKX API Error: code=${json.code}, msg=${json.msg}`);
    }

    return json.data;
  }

  /**
   * 带重试的请求包装器
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = OKX_API_MAX_RETRIES,
    context: string = ''
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRateLimit = lastError.message.includes('429') || lastError.message.includes('50011');
        if (attempt < maxRetries) {
          const delay = (isRateLimit ? 2000 : 500) * Math.pow(2, attempt);
          console.warn(`[OKX] Retry ${attempt + 1}/${maxRetries} for ${context}: ${lastError.message}. Wait ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  /**
   * 并发限制批量执行器
   */
  private async mapWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number = OKX_API_CONCURRENCY
  ): Promise<R[]> {
    const results: R[] = [];
    let index = 0;
    async function worker() {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
  }

  // ----------------------------------------------------------------
  // Public API Methods
  // ----------------------------------------------------------------

  /**
   * 获取账户余额
   */
  async getAccountBalance(): Promise<OKXAccountBalance> {
    const data = await this.get<OKXAccountBalance[]>('/api/v5/account/balance');
    if (!data || data.length === 0) {
      throw new Error('OKX: 账户余额数据为空');
    }
    return data[0];
  }

  /**
   * 获取当前持仓
   */
  async getPositions(): Promise<OKXPosition[]> {
    return this.get<OKXPosition[]>('/api/v5/account/positions', {
      instType: 'SWAP',
    });
  }

  /**
   * 获取 SWAP 合约信息（包含 ctVal）
   */
  async getInstruments(): Promise<OKXInstrument[]> {
    return this.get<OKXInstrument[]>('/api/v5/public/instruments', {
      instType: 'SWAP',
    });
  }

  /**
   * 获取历史订单（最近 3 个月，已成交）
   * @param after  返回此 ordId 之前的数据（用于翻页）
   * @param before 返回此 ordId 之后的数据
   */
  async getOrderHistory(after?: string, before?: string): Promise<OKXOrder[]> {
    const params: Record<string, string> = {
      instType: 'SWAP',
      state: 'filled',
      limit: '100',
    };
    if (after) params.after = after;
    if (before) params.before = before;

    return this.withRetry(
      () => this.get<OKXOrder[]>('/api/v5/trade/orders-history', params),
      OKX_API_MAX_RETRIES,
      'getOrderHistory'
    );
  }

  /**
   * 获取归档历史订单（3 个月前的数据，已成交）
   */
  async getOrderHistoryArchive(after?: string, before?: string): Promise<OKXOrder[]> {
    const params: Record<string, string> = {
      instType: 'SWAP',
      state: 'filled',
      limit: '100',
    };
    if (after) params.after = after;
    if (before) params.before = before;

    return this.withRetry(
      () => this.get<OKXOrder[]>('/api/v5/trade/orders-history-archive', params),
      OKX_API_MAX_RETRIES,
      'getOrderHistoryArchive'
    );
  }

  /**
   * 获取所有已成交订单（自动翻页，支持最近 N 天）
   * @param days 拉取多少天的数据
   */
  async getAllOrders(days: number = 7): Promise<OKXOrder[]> {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const allOrders: OKXOrder[] = [];

    // --- 先拉最近 3 个月的数据 ---
    let after: string | undefined;
    while (true) {
      const batch = await this.getOrderHistory(after);
      if (batch.length === 0) break;

      // 过滤截止时间之前的数据
      const filtered = batch.filter(o => parseInt(o.cTime) >= cutoffTime);
      allOrders.push(...filtered);

      // 如果这批数据中已经有超出 cutoff 的，停止
      if (filtered.length < batch.length) break;
      // 如果不足 100 条，说明没有更多数据
      if (batch.length < 100) break;

      after = batch[batch.length - 1].ordId;
    }

    // --- 若 days > 90，还需查归档数据 ---
    if (days > 90) {
      after = undefined;
      while (true) {
        const batch = await this.getOrderHistoryArchive(after);
        if (batch.length === 0) break;

        const filtered = batch.filter(o => parseInt(o.cTime) >= cutoffTime);
        allOrders.push(...filtered);

        if (filtered.length < batch.length) break;
        if (batch.length < 100) break;

        after = batch[batch.length - 1].ordId;
      }
    }

    console.log(`[OKX] 共获取 ${allOrders.length} 笔已成交订单`);
    return allOrders;
  }

  /**
   * 获取充值记录
   */
  async getDepositHistory(ccy: string = 'USDT'): Promise<OKXDeposit[]> {
    const allDeposits: OKXDeposit[] = [];
    let after: string | undefined;

    while (true) {
      const params: Record<string, string> = { ccy, state: '2', limit: '100' };
      if (after) params.after = after;

      const batch = await this.withRetry(
        () => this.get<OKXDeposit[]>('/api/v5/asset/deposit-history', params),
        OKX_API_MAX_RETRIES,
        'getDepositHistory'
      );

      if (batch.length === 0) break;
      allDeposits.push(...batch);
      if (batch.length < 100) break;
      after = batch[batch.length - 1].depId;
    }

    return allDeposits;
  }

  /**
   * 获取提现记录
   */
  async getWithdrawalHistory(ccy: string = 'USDT'): Promise<OKXWithdrawal[]> {
    const allWithdrawals: OKXWithdrawal[] = [];
    let after: string | undefined;

    while (true) {
      const params: Record<string, string> = { ccy, state: '2', limit: '100' };
      if (after) params.after = after;

      const batch = await this.withRetry(
        () => this.get<OKXWithdrawal[]>('/api/v5/asset/withdrawal-history', params),
        OKX_API_MAX_RETRIES,
        'getWithdrawalHistory'
      );

      if (batch.length === 0) break;
      allWithdrawals.push(...batch);
      if (batch.length < 100) break;
      after = batch[batch.length - 1].wdId;
    }

    return allWithdrawals;
  }

  /**
   * 测试 API 连接是否正常
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getAccountBalance();
      return { success: true, message: 'OKX API 连接成功' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'OKX API 连接失败',
      };
    }
  }
}
