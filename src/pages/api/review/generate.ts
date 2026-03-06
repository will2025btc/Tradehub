import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';
import { buildReviewPayload, REVIEW_SYSTEM_PROMPT, getUserAiConfig } from '@/lib/review-service';
import { streamAI } from '@/lib/ai-client';

// 关闭响应大小限制，支持 SSE 长连接流式输出
export const config = {
  api: { responseLimit: false },
};

function sendEvent(res: NextApiResponse, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof (res as any).flush === 'function') (res as any).flush();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // ── SSE 响应头 ───────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const userId        = session.user.id;
    const targetDateStr = (req.body?.date as string) || format(new Date(), 'yyyy-MM-dd');

    // ── 读取用户 AI 配置 ─────────────────────────────────────────────────
    sendEvent(res, { type: 'status', message: '正在读取 AI 配置...' });
    const aiConfig = await getUserAiConfig(userId);
    if (!aiConfig) {
      sendEvent(res, {
        type:    'error',
        message: '请先前往「AI 设置」页面配置您的 AI 模型和 API Key',
      });
      return res.end();
    }

    // ── 拉取交易数据并构建 Prompt ────────────────────────────────────────
    sendEvent(res, { type: 'status', message: '正在拉取交易数据...' });
    const { userMessage, todayNetPnl, posCount } = await buildReviewPayload(userId, targetDateStr);

    sendEvent(res, {
      type:    'status',
      message: `AI 正在深度分析（${aiConfig.provider} / ${aiConfig.model}），请稍候...`,
    });

    // ── 流式调用 AI ──────────────────────────────────────────────────────
    let fullReview = '';

    for await (const chunk of streamAI(aiConfig, REVIEW_SYSTEM_PROMPT, userMessage)) {
      fullReview += chunk;
      sendEvent(res, { type: 'text', text: chunk });
    }

    // ── 保存到数据库 ─────────────────────────────────────────────────────
    await prisma.dailyReview.upsert({
      where:  { userId_date: { userId, date: targetDateStr } },
      update: { aiReview: fullReview, posCount, totalPnl: todayNetPnl },
      create: { userId, date: targetDateStr, aiReview: fullReview, posCount, totalPnl: todayNetPnl },
    });

    sendEvent(res, { type: 'done', date: targetDateStr });
    res.end();

  } catch (err: any) {
    console.error('[review/generate] error:', err);
    try { sendEvent(res, { type: 'error', message: err?.message ?? '生成失败，请重试' }); } catch {}
    res.end();
  }
}
