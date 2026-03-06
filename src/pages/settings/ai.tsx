import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import { PROVIDER_LABELS, PROVIDER_MODELS } from '@/lib/ai-client';
import type { AiProvider } from '@/lib/ai-client';

// ─── 类型 ─────────────────────────────────────────────────────────────────
interface AiConfigState {
  configured: boolean;
  provider?: AiProvider;
  model?: string;
  baseUrl?: string;
  hasApiKey?: boolean;
  apiKeyMasked?: string;
}

const ALL_PROVIDERS = Object.keys(PROVIDER_LABELS) as AiProvider[];

// ─── 工具：provider 图标 ──────────────────────────────────────────────────
const PROVIDER_ICON: Record<AiProvider, string> = {
  openai:    '🟢',
  anthropic: '🟠',
  google:    '🔵',
  deepseek:  '🐳',
  qwen:      '🌙',
  zhipu:     '🧠',
  custom:    '⚙️',
};

// 各 provider 的 API Key 获取地址
const PROVIDER_KEY_URL: Partial<Record<AiProvider, string>> = {
  openai:    'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google:    'https://aistudio.google.com/app/apikey',
  deepseek:  'https://platform.deepseek.com/api_keys',
  qwen:      'https://dashscope.console.aliyun.com/apiKey',
  zhipu:     'https://open.bigmodel.cn/usercenter/apikeys',
};

// ─── 主页面 ───────────────────────────────────────────────────────────────
export default function AiSettingsPage() {
  const [current,  setCurrent]  = useState<AiConfigState>({ configured: false });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 表单状态
  const [provider, setProvider] = useState<AiProvider>('anthropic');
  const [model,    setModel]    = useState('claude-opus-4-6');
  const [apiKey,   setApiKey]   = useState('');
  const [baseUrl,  setBaseUrl]  = useState('');
  const [showKey,  setShowKey]  = useState(false);
  const [customModel, setCustomModel] = useState('');

  const presets = PROVIDER_MODELS[provider];
  const isCustomModel = presets.length > 0 && !presets.includes(model);

  // 切换 provider 时自动选第一个预设模型
  const handleProviderChange = (p: AiProvider) => {
    setProvider(p);
    const firstModel = PROVIDER_MODELS[p][0] ?? '';
    setModel(firstModel);
    setCustomModel('');
  };

  // ── 加载现有配置 ────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings/ai-config')
      .then(r => r.json())
      .then((d: AiConfigState) => {
        setCurrent(d);
        if (d.configured && d.provider) {
          setProvider(d.provider);
          setModel(d.model ?? '');
          setBaseUrl(d.baseUrl ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // ── 测试连接 ────────────────────────────────────────────────────────────
  const handleTest = async () => {
    if (!apiKey.trim()) { setMsg({ type: 'err', text: '请先填写 API Key' }); return; }
    setTesting(true);
    setMsg(null);
    const finalModel = presets.length === 0 ? customModel : model;
    const r = await fetch('/api/settings/ai-config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ provider, model: finalModel, apiKey, baseUrl, skipTest: false }),
    });
    const d = await r.json();
    setMsg(r.ok ? { type: 'ok', text: d.message } : { type: 'err', text: d.message });
    if (r.ok) setCurrent({ configured: true, provider, model: finalModel, hasApiKey: true });
    setTesting(false);
  };

  // ── 保存（跳过测试） ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!apiKey.trim()) { setMsg({ type: 'err', text: '请填写 API Key' }); return; }
    setSaving(true);
    setMsg(null);
    const finalModel = presets.length === 0 ? customModel : model;
    const r = await fetch('/api/settings/ai-config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ provider, model: finalModel, apiKey, baseUrl, skipTest: true }),
    });
    const d = await r.json();
    setMsg(r.ok ? { type: 'ok', text: d.message } : { type: 'err', text: d.message });
    if (r.ok) setCurrent({ configured: true, provider, model: finalModel, hasApiKey: true });
    setSaving(false);
  };

  // ── 删除配置 ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm('确认删除 AI 模型配置？删除后无法使用每日复盘功能。')) return;
    await fetch('/api/settings/ai-config', { method: 'DELETE' });
    setCurrent({ configured: false });
    setApiKey('');
    setMsg({ type: 'ok', text: '配置已删除' });
  };

  if (loading) {
    return (
      <AuthGuard message="登录管理 AI 设置">
        <Layout>
          <div className="flex items-center justify-center h-40">
            <div className="text-gray-400">加载中...</div>
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard message="登录管理 AI 设置">
      <Layout>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">🤖 AI 模型设置</h1>
          <p className="text-gray-500 text-sm mb-8">
            配置您自己的 AI 模型，用于生成每日交易复盘报告。支持多种主流厂商。
          </p>

          {/* 当前状态卡片 */}
          {current.configured && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PROVIDER_ICON[current.provider!]}</span>
                <div>
                  <div className="font-semibold text-green-800">
                    {PROVIDER_LABELS[current.provider!]} · {current.model}
                  </div>
                  <div className="text-green-600 text-sm">API Key 已配置 · {current.apiKeyMasked}</div>
                </div>
              </div>
              <button
                onClick={handleDelete}
                className="text-sm text-red-500 hover:text-red-700 hover:underline"
              >
                删除配置
              </button>
            </div>
          )}

          {/* 配置表单 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">

            {/* 1. 选择厂商 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                选择 AI 厂商
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_PROVIDERS.map(p => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition ${
                      provider === p
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <span>{PROVIDER_ICON[p]}</span>
                    <span className="truncate">{p === 'custom' ? '自定义' : PROVIDER_LABELS[p].split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              {PROVIDER_KEY_URL[provider] && (
                <p className="text-xs text-gray-400 mt-2">
                  👉 获取 API Key：
                  <a
                    href={PROVIDER_KEY_URL[provider]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline ml-1"
                  >
                    {PROVIDER_KEY_URL[provider]}
                  </a>
                </p>
              )}
            </div>

            {/* 2. 选择模型 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                选择模型
              </label>
              {presets.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {presets.map(m => (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                          model === m && !isCustomModel
                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                    <button
                      onClick={() => setModel('__custom__')}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                        isCustomModel
                          ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      ✏️ 自填
                    </button>
                  </div>
                  {(isCustomModel || model === '__custom__') && (
                    <input
                      type="text"
                      placeholder="输入自定义模型名称，如 gpt-4-1106-preview"
                      value={customModel}
                      onChange={e => { setCustomModel(e.target.value); setModel(e.target.value); }}
                      className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </>
              ) : (
                // custom provider：直接输入模型名
                <input
                  type="text"
                  placeholder="输入模型名称，如 llama-3.1-8b-instruct"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* 3. API Key */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                API Key
                {current.configured && current.provider === provider && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    已有配置，留空则保留现有 Key
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder="输入您的 API Key"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-20 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            {/* 4. Base URL（仅 custom） */}
            {provider === 'custom' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Base URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  placeholder="如 https://your-api.com/v1"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  需兼容 OpenAI Chat Completions API 格式
                </p>
              </div>
            )}

            {/* 消息提示 */}
            {msg && (
              <div className={`rounded-lg px-4 py-3 text-sm ${
                msg.type === 'ok'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {msg.type === 'ok' ? '✅ ' : '❌ '}{msg.text}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTest}
                disabled={testing || saving}
                className="flex-1 py-2.5 rounded-lg border border-blue-500 text-blue-600 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50 transition"
              >
                {testing ? '测试中...' : '🔌 测试并保存'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || testing}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saving ? '保存中...' : '💾 直接保存'}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              API Key 经过 AES 加密后存储，不会明文保存或传输
            </p>
          </div>

          {/* 支持的模型说明 */}
          <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">📖 各厂商说明</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div><span className="font-medium">🟢 OpenAI</span> — GPT 系列，gpt-4o 综合效果最佳</div>
              <div><span className="font-medium">🟠 Anthropic</span> — Claude 系列，复盘分析能力强，支持深度思考</div>
              <div><span className="font-medium">🔵 Gemini</span> — Google 最新模型，gemini-2.0-flash 速度快且免费额度高</div>
              <div><span className="font-medium">🐳 DeepSeek</span> — 国产推理模型，deepseek-chat 性价比极高，推荐</div>
              <div><span className="font-medium">🌙 Qwen</span> — 阿里通义千问，国内访问稳定</div>
              <div><span className="font-medium">🧠 GLM</span> — 智谱 AI，GLM-4 系列效果优秀</div>
              <div><span className="font-medium">⚙️ 自定义</span> — 任何兼容 OpenAI API 格式的服务均可接入</div>
            </div>
          </div>

        </div>
      </Layout>
    </AuthGuard>
  );
}
