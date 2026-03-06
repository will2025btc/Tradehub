/**
 * review-service.ts
 * 交易复盘核心逻辑：数据拉取 + Prompt 构建 + AI 调用
 * 支持多厂商 AI（通过 ai-client.ts 统一封装）
 */

import { prisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/encryption';
import { callAI } from '@/lib/ai-client';
import type { AiClientConfig } from '@/lib/ai-client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

// ─── Prompt 常量（导出供 generate.ts 使用） ───────────────────────────────
export const REVIEW_SYSTEM_PROMPT = `你是一位拥有15年实战经验的专业加密货币合约交易顾问和心理导师。
你的职责是对交易者每天的实盘数据进行深度复盘，帮助他们持续成长。

【分析原则】
1. 真诚直接：不回避问题，直接指出错误，语气温和但不含糊
2. 具体可行：所有建议必须具体、可立即执行，禁止空话套话
3. 数据驱动：结合盈亏数字、胜率、盈亏比等客观数据做分析
4. 心理关怀：重点关注情绪管理、纪律性与交易心理健康
5. 因人而异：根据今日实际数据给出个性化建议

【重要规则】
- 发现严重错误（单日超大亏损 / 连续止损 / 严重违纪）时，必须明确警示
- 对正确操作给予充分肯定，帮助交易者建立信心
- 每条建议说明"做什么、怎么做、为什么"
- 合约交易中，杠杆、仓位控制、止损是重中之重，务必关注`;

export const REVIEW_USER_TEMPLATE = `请严格按以下结构输出报告（使用 Markdown 格式）：

## 📊 今日交易概览
（2-3句话概括今日交易情况，列出关键数字）

## ✅ 做得好的地方
（具体指出正确操作，为什么值得肯定；如无平仓数据，给出整体账户状态分析）

## ❌ 需要改进的地方
（具体指出问题，分析根本原因；合约交易中重点关注杠杆使用、止损纪律）

## 🧠 交易心理分析
（从持仓结构、杠杆选择、盈亏分布分析潜在的心理模式）

## 💡 具体改进建议（至少3条）
- **建议1：[标题]**
  - 做什么：
  - 怎么做：
  - 为什么：

## ⚠️ 重点警示
（有严重问题则标出，否则写"今日无重大风险操作"）

## 🎯 明日行动计划
（列出明日需特别注意的3件具体事项）

## 📝 总结寄语
（真诚的一段话总结今日，给予鼓励与方向，约100字）`;

// ─── 从 DB 获取用户 AI 配置 ───────────────────────────────────────────────
export async function getUserAiConfig(userId: string): Promise<AiClientConfig | null> {
  const cfg = await prisma.aiConfig.findUnique({ where: { userId } });
  if (!cfg) return null;

  return {
    provider: cfg.provider as AiClientConfig['provider'],
    model:    cfg.model,
    apiKey:   decryptApiKey(cfg.apiKeyEncrypted),
    baseUrl:  cfg.baseUrl ?? undefined,
  };
}

// ─── 从 DB 拉取数据，构建 Claude Prompt ───────────────────────────────────
export async function buildReviewPayload(userId: string, targetDateStr: string) {
  const targetDate = new Date(targetDateStr);
  const dayStart   = startOfDay(targetDate);
  const dayEnd     = endOfDay(targetDate);

  // 当日平仓持仓
  let closedToday = await prisma.position.findMany({
    where: { userId, status: 'CLOSED', closeTime: { gte: dayStart, lte: dayEnd } },
    orderBy: { closeTime: 'asc' },
  });

  // 若无数据，扩展至近7天
  const lookbackDays = closedToday.length === 0 ? 7 : 0;
  if (lookbackDays > 0) {
    closedToday = await prisma.position.findMany({
      where: { userId, status: 'CLOSED', closeTime: { gte: subDays(dayStart, lookbackDays), lte: dayEnd } },
      orderBy: { closeTime: 'asc' },
    });
  }

  const latestSnapshot = await prisma.accountSnapshot.findFirst({
    where: { userId }, orderBy: { snapshotTime: 'desc' },
  });
  const firstSnapshot = await prisma.accountSnapshot.findFirst({
    where: { userId }, orderBy: { snapshotTime: 'asc' },
  });

  const allClosed = await prisma.position.findMany({
    where: { userId, status: 'CLOSED' },
    select: { realizedPnl: true },
  });
  const histWinRate = allClosed.length > 0
    ? (allClosed.filter(p => Number(p.realizedPnl) > 0).length / allClosed.length * 100).toFixed(1)
    : '0.0';

  const openPositions = await prisma.position.findMany({
    where: { userId, status: 'OPEN' },
    select: { symbol: true, side: true, leverage: true },
  });

  const todayNetPnl  = closedToday.reduce((s, p) => s + Number(p.realizedPnl) - Number(p.fee), 0);
  const todayWin     = closedToday.filter(p => Number(p.realizedPnl) > 0).length;
  const todayLoss    = closedToday.filter(p => Number(p.realizedPnl) <= 0).length;
  const todayProfit  = closedToday.filter(p => Number(p.realizedPnl) > 0).reduce((s, p) => s + Number(p.realizedPnl), 0);
  const todayLossAmt = closedToday.filter(p => Number(p.realizedPnl) <= 0).reduce((s, p) => s + Number(p.realizedPnl), 0);
  const profitFactor = todayLossAmt !== 0 ? Math.abs(todayProfit / todayLossAmt).toFixed(2) : '∞';

  const reviewData = {
    复盘日期:   targetDateStr,
    数据范围:   lookbackDays > 0 ? `今日暂无平仓，已扩展至近${lookbackDays}天数据` : '仅含今日数据',
    账户状态: {
      当前权益:     latestSnapshot ? `$${Number(latestSnapshot.totalEquity).toFixed(2)}` : '无数据',
      初始资金:     firstSnapshot  ? `$${Number(firstSnapshot.totalEquity).toFixed(2)}`  : '无数据',
      历史胜率:     `${histWinRate}%`,
      历史总持仓数: allClosed.length,
    },
    今日指标: {
      平仓笔数:  closedToday.length,
      盈利笔:    todayWin,
      亏损笔:    todayLoss,
      胜率:      closedToday.length > 0 ? `${(todayWin / closedToday.length * 100).toFixed(1)}%` : 'N/A',
      今日净盈亏: `$${todayNetPnl.toFixed(2)}`,
      盈亏比:    profitFactor,
    },
    今日平仓持仓列表: closedToday.map(p => ({
      标的:       p.symbol,
      方向:       p.side,
      杠杆:       `${p.leverage}x`,
      开仓价:     `$${Number(p.avgOpenPrice).toFixed(4)}`,
      平仓价:     `$${Number(p.avgClosePrice).toFixed(4)}`,
      实现盈亏:   `$${Number(p.realizedPnl).toFixed(2)}`,
      手续费:     `$${Number(p.fee).toFixed(2)}`,
      净盈亏:     `$${(Number(p.realizedPnl) - Number(p.fee)).toFixed(2)}`,
      开仓时间:   p.openTime.toISOString(),
      平仓时间:   p.closeTime?.toISOString() ?? '',
      持仓时长分钟: p.closeTime
        ? Math.round((p.closeTime.getTime() - p.openTime.getTime()) / 60000)
        : null,
      最大仓位价值: `$${Number(p.maxPositionValue).toFixed(2)}`,
    })),
    当前未平持仓: openPositions.map(p => ({
      标的: p.symbol, 方向: p.side, 杠杆: `${p.leverage}x`,
    })),
  };

  const userMessage = `请对以下实盘交易数据进行深度复盘分析：

${JSON.stringify(reviewData, null, 2)}

${REVIEW_USER_TEMPLATE}`;

  return { reviewData, userMessage, todayNetPnl, posCount: closedToday.length };
}

// ─── 非流式调用（供 Cron 使用） ───────────────────────────────────────────
export async function generateReviewText(
  userId: string,
  targetDateStr: string,
  aiConfig: AiClientConfig,
): Promise<{ aiReview: string; todayNetPnl: number; posCount: number }> {
  const { userMessage, todayNetPnl, posCount } = await buildReviewPayload(userId, targetDateStr);
  const aiReview = await callAI(aiConfig, REVIEW_SYSTEM_PROMPT, userMessage);
  return { aiReview, todayNetPnl, posCount };
}

// ─── 生成并持久化 ─────────────────────────────────────────────────────────
export async function generateAndSaveReview(
  userId: string,
  targetDateStr: string,
  aiConfig: AiClientConfig,
) {
  const { aiReview, todayNetPnl, posCount } = await generateReviewText(userId, targetDateStr, aiConfig);

  await prisma.dailyReview.upsert({
    where:  { userId_date: { userId, date: targetDateStr } },
    update: { aiReview, posCount, totalPnl: todayNetPnl },
    create: { userId, date: targetDateStr, aiReview, posCount, totalPnl: todayNetPnl },
  });

  return { aiReview, todayNetPnl, posCount };
}
