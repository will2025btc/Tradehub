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
      apiKey:   string;
      baseUrl?: string;
      skipTest?: boolean;
    };

    // 基本校验
    if (!VALID_PROVIDERS.includes(provider)) {
      return res.status(400).json({ message: `不支持的 provider: ${provider}` });
    }
    if (!model?.trim()) {
      return res.status(400).json({ message: '请选择或填写模型名称' });
    }
    if (!apiKey?.trim()) {
      return res.status(400).json({ message: 'API Key 不能为空' });
    }
    if (provider === 'custom' && !baseUrl?.trim()) {
      return res.status(400).json({ message: '自定义模型需要填写 Base URL' });
    }

    // 可选的连接测试
    if (!skipTest) {
      const testResult = await testAIConnection({ provider, model, apiKey, baseUrl });
      if (!testResult.ok) {
        return res.status(400).json({ message: testResult.message });
      }
    }

    // 加密保存
    const encryptedKey = encryptApiKey(apiKey);

    await prisma.aiConfig.upsert({
      where:  { userId },
      update: { provider, model, apiKeyEncrypted: encryptedKey, baseUrl: baseUrl ?? null },
      create: { userId, provider, model, apiKeyEncrypted: encryptedKey, baseUrl: baseUrl ?? null },
    });

    return res.status(200).json({ message: 'AI 模型配置保存成功', success: true });
  }

  // ── DELETE：删除 AI 配置 ───────────────────────────────────────────────
  if (req.method === 'DELETE') {
    await prisma.aiConfig.deleteMany({ where: { userId } });
    return res.status(200).json({ message: 'AI 配置已删除', success: true });
  }

  return res.status(405).json({ message: '方法不允许' });
}
