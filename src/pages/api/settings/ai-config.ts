import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { encryptApiKey, decryptApiKey } from '@/lib/encryption';
import { testAIConnection, PROVIDER_MODELS } from '@/lib/ai-client';
import type { AiProvider } from '@/lib/ai-client';

const VALID_PROVIDERS: AiProvider[] = ['openai', 'anthropic', 'google', 'deepseek', 'qwen', 'zhipu', 'custom'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ message: '未授权' });
  }
  const userId = session.user.id;

  // ── GET：返回当前 AI 配置（不暴露 key） ────────────────────────────────
  if (req.method === 'GET') {
    const cfg = await prisma.aiConfig.findUnique({ where: { userId } });
    if (!cfg) return res.status(200).json({ configured: false });

    return res.status(200).json({
      configured: true,
      provider:   cfg.provider,
      model:      cfg.model,
      baseUrl:    cfg.baseUrl,
      hasApiKey:  true,
      // 掩码显示
      apiKeyMasked: '••••••••' + cfg.apiKeyEncrypted.slice(-4),
    });
  }

  // ── POST：保存 / 更新 AI 配置 ──────────────────────────────────────────
  if (req.method === 'POST') {
    const { provider, model, apiKey, baseUrl, skipTest } = req.body as {
      provider: AiProvider;
      model:    string;
      apiKey?:  string;   // 可选：留空则沿用已有 key
      baseUrl?: string;
      skipTest?: boolean;
    };

    // 基本校验
    if (!VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({ message: `不支持的 provider: ${provider}` });
    }
    if (!model?.trim()) {
      return res.status(400).json({ message: '请输入模型名称' });
    }
    if (provider === 'custom' && !baseUrl?.trim()) {
      return res.status(400).json({ message: '自定义模型需要填写 Base URL' });
    }

    // 读取已有配置（用于沿用旧 key）
    const existing = await prisma.aiConfig.findUnique({ where: { userId } });

    // apiKey 留空时沿用旧 key，否则必须存在旧配置或新填 key
    const newKeyRaw = apiKey?.trim();
    if (!newKeyRaw && !existing) {
      return res.status(400).json({ message: 'API Key 不能为空' });
    }
    const encryptedKey = newKeyRaw ? encryptApiKey(newKeyRaw) : existing!.apiKeyEncrypted;
    const decryptedKey = newKeyRaw ?? decryptApiKey(existing!.apiKeyEncrypted);

    // 可选的连接测试
    if (!skipTest) {
      const testResult = await testAIConnection({
        provider, model: model.trim(), apiKey: decryptedKey, baseUrl,
      });
      if (!testResult.ok) {
        return res.status(400).json({ message: testResult.message });
      }
    }

    await prisma.aiConfig.upsert({
      where:  { userId },
      update: { provider, model: model.trim(), apiKeyEncrypted: encryptedKey, baseUrl: baseUrl?.trim() ?? null },
      create: { userId, provider, model: model.trim(), apiKeyEncrypted: encryptedKey, baseUrl: baseUrl?.trim() ?? null },
    });

    return res.status(200).json({
      message: `已保存：${provider} / ${model.trim()}`,
      success: true,
    });
  }

  // ── DELETE：删除 AI 配置 ───────────────────────────────────────────────
  if (req.method === 'DELETE') {
    await prisma.aiConfig.deleteMany({ where: { userId } });
    return res.status(200).json({ message: 'AI 配置已删除', success: true });
  }

  return res.status(405).json({ message: '方法不允许' });
}
