import axios from 'axios';
import crypto from 'crypto';
import { decryptApiKey } from './encryption';

const BINANCE_API_URL = process.env.BINANCE_API_URL || 'https://fapi.binance.com';

interface BinanceConfig {
  apiKey: string;
  apiSecret: string;
}

export class BinanceClient {
  private apiKey: string;
  private apiSecret: string;

  constructor(config: BinanceConfig) {
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  private async request(endpoint: string, params: Record<string, any> = {}) {
    const timestamp = Date.now();
    const queryString = new URLSearchParams({
      ...params,
      timestamp: timestamp.toString(),
    }).toString();
    
    const signature = this.createSignature(queryString);
    const url = `${BINANCE_API_URL}${endpoint}?${queryString}&signature=${signature}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Binance API Error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.msg || 'Binance API request failed');
    }
  }

  async getAccountInfo() {
    return this.request('/fapi/v2/account');
  }

  async getAllOrders(symbol?: string, limit: number = 500) {
    const params: Record<string, any> = { limit };
    if (symbol) params.symbol = symbol;
    return this.request('/fapi/v1/allOrders', params);
  }

  async getUserTrades(symbol?: string, limit: number = 1000) {
    const params: Record<string, any> = { limit };
    if (symbol) params.symbol = symbol;
    return this.request('/fapi/v1/userTrades', params);
  }

  async getIncome(params: {
    symbol?: string;
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}) {
    return this.request('/fapi/v1/income', { limit: 1000, ...params });
  }
}

export function createBinanceClient(encryptedApiKey: string, encryptedApiSecret: string): BinanceClient {
  const apiKey = decryptApiKey(encryptedApiKey);
  const apiSecret = decryptApiKey(encryptedApiSecret);
  
  return new BinanceClient({ apiKey, apiSecret });
}
