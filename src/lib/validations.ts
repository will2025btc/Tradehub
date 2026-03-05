import { z } from 'zod';

/** 持仓列表查询参数校验 */
export const positionStatusFilter = z.enum(['all', 'open', 'closed']).default('all');

/** 资产快照时间范围校验 */
export const snapshotRangeFilter = z.enum(['1month', '3month', '1year', 'all']).default('all');

/** 支持的交易所 */
export const SUPPORTED_EXCHANGES = ['binance', 'okx'] as const;
export type SupportedExchange = (typeof SUPPORTED_EXCHANGES)[number];

/** API 配置输入校验（支持 Binance 和 OKX） */
export const apiConfigInput = z.object({
  exchange: z.enum(SUPPORTED_EXCHANGES, { message: '不支持的交易所' }).default('binance'),
  apiKey: z.string().min(1, 'API Key 不能为空').max(256, 'API Key 过长'),
  apiSecret: z.string().min(1, 'API Secret 不能为空').max(256, 'API Secret 过长'),
  passphrase: z.string().max(128, 'Passphrase 过长').optional(), // OKX 专用
});
