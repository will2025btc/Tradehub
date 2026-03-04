import { z } from 'zod';

/** 持仓列表查询参数校验 */
export const positionStatusFilter = z.enum(['all', 'open', 'closed']).default('all');

/** 资产快照时间范围校验 */
export const snapshotRangeFilter = z.enum(['1month', '3month', '1year', 'all']).default('all');

/** API 配置输入校验 */
export const apiConfigInput = z.object({
  apiKey: z.string().min(1, 'API Key 不能为空').max(128, 'API Key 过长'),
  apiSecret: z.string().min(1, 'API Secret 不能为空').max(128, 'API Secret 过长'),
});
