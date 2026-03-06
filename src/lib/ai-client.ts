/**
 * ai-client.ts
 * 统一多厂商 AI 客户端
 * 支持：OpenAI / Anthropic(Claude) / Google(Gemini) /
 *       DeepSeek / Qwen(通义千问) / GLM(智谱) / 自定义
 *
 * - OpenAI 兼容厂商（DeepSeek / Qwen / GLM / Custom）统一用 openai npm 包
 * - Anthropic 使用 @anthropic-ai/sdk（支持自适应思考）
 * - Google Gemini 通过其 OpenAI 兼容端点接入
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// ─── 类型 ──────────────────────────────────────────────────────────────────
export type AiProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'zhipu'
  | 'custom';

export interface AiClientConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;       // 解密后的明文 key
  baseUrl?: string;     // 仅 custom 需要
}

// ─── 静态元数据（供前端使用） ──────────────────────────────────────────────
export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai:    'OpenAI (GPT)',
  anthropic: 'Anthropic (Claude)',
  google:    'Google (Gemini)',
  deepseek:  'DeepSeek',
  qwen:      '通义千问 (Qwen)',
  zhipu:     '智谱 AI (GLM)',
  custom:    '自定义模型',
};

// 常用模型快捷选项（仅供参考，用户可自由输入任何模型名）
export const PROVIDER_MODELS: Record<AiProvider, string[]> = {
  openai: [
    'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
    'gpt-4o', 'gpt-4o-mini',
    'o3', 'o3-mini', 'o4-mini', 'o1', 'o1-mini',
    'gpt-5', 'gpt-5.4',
  ],
  anthropic: [
    'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5',
    'claude-opus-4-5', 'claude-sonnet-4-5',
  ],
  google: [
    'gemini-2.5-pro', 'gemini-2.5-flash',
    'gemini-2.0-flash', 'gemini-2.0-flash-lite',
    'gemini-1.5-pro', 'gemini-1.5-flash',
    'gemini-3.1-pro',
  ],
  deepseek: [
    'deepseek-chat', 'deepseek-reasoner',
    'deepseek-r1', 'deepseek-v3',
    'deepseek-r1-0528',
  ],
  qwen: [
    'qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long',
    'qwen3-235b-a22b', 'qwen2.5-72b-instruct', 'qwq-32b',
  ],
  zhipu: [
    'glm-4-plus', 'glm-4', 'glm-4-flash', 'glm-4-air',
    'glm-z1-preview', 'glm-z1-flash',
  ],
  custom: [],
};

// 各 OpenAI 兼容厂商的 baseURL
const PROVIDER_BASE_URLS: Partial<Record<AiProvider, string>> = {
  openai:   undefined, // OpenAI SDK 默认
  google:   'https://generativelanguage.googleapis.com/v1beta/openai/',
  deepseek: 'https://api.deepseek.com',
  qwen:     'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu:    'https://open.bigmodel.cn/api/paas/v4/',
};

// ─── 内部：构建 OpenAI 兼容客户端 ─────────────────────────────────────────
function makeOpenAIClient(config: AiClientConfig): OpenAI {
  const baseURL = config.provider === 'custom'
    ? config.baseUrl
    : PROVIDER_BASE_URLS[config.provider];

  return new OpenAI({ apiKey: config.apiKey, baseURL });
}

// ─── 流式输出（AsyncGenerator<string>） ───────────────────────────────────
export async function* streamAI(
  config: AiClientConfig,
  systemPrompt: string,
  userMessage: string,
): AsyncGenerator<string, void, unknown> {

  if (config.provider === 'anthropic') {
    // ── Anthropic 路径：支持自适应思考 ────────────────────────────────
    const client = new Anthropic({ apiKey: config.apiKey });
    const stream = client.messages.stream({
      model:     config.model,
      max_tokens: 4096,
      thinking:  { type: 'adaptive' },
      system:    systemPrompt,
      messages:  [{ role: 'user', content: userMessage }],
    });

    for await (const event of stream) {
      const etype = (event as any).type as string;
      if (etype === 'content_block_delta') {
        const delta = (event as any).delta;
        // 只输出 text，忽略 thinking 块
        if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
          yield delta.text;
        }
      }
    }
  } else {
    // ── OpenAI 兼容路径 ───────────────────────────────────────────────
    const client = makeOpenAIClient(config);
    const stream = await client.chat.completions.create({
      model:  config.model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) yield text;
    }
  }
}

// ─── 非流式调用（供 Cron 使用） ───────────────────────────────────────────
export async function callAI(
  config: AiClientConfig,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {

  if (config.provider === 'anthropic') {
    const client = new Anthropic({ apiKey: config.apiKey });
    const response = await client.messages.create({
      model:     config.model,
      max_tokens: 4096,
      thinking:  { type: 'adaptive' },
      system:    systemPrompt,
      messages:  [{ role: 'user', content: userMessage }],
    });
    return response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('');
  } else {
    const client = makeOpenAIClient(config);
    const response = await client.chat.completions.create({
      model:  config.model,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
    });
    return response.choices[0]?.message?.content ?? '';
  }
}

// ─── 连接测试 ──────────────────────────────────────────────────────────────
export async function testAIConnection(config: AiClientConfig): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const reply = await callAI(config, '你是助手。', '请回复"连接成功"这4个字，不要多说。');
    return { ok: true, message: `连接成功，模型回复：${reply.slice(0, 50)}` };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    return { ok: false, message: `连接失败：${msg}` };
  }
}
