import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import { PROVIDER_LABELS, PROVIDER_MODELS } from '@/lib/ai-client';
import type { AiProvider } from '@/lib/ai-client';

// ─── 静态常量 ──────────────────────────────────────────────────────────────
const ALL_PROVIDERS = Object.keys(PROVIDER_LABELS) as AiProvider[];

const PROVIDER_ICON: Record<AiProvider, string> = {
  openai:    '🟢',
  anthropic: '🟠',
  google:    '🔵',
  deepseek:  '🐳',
  qwen:      '🌙',
  zhipu:     '🧠',
  custom:    '⚙️',
};

const PROVIDER_KEY_URL: Partial<Record<AiProvider, string>> = {
  openai:    'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google:    'https://aistudio.google.com/app/apikey',
  deepseek:  'https://platform.deepseek.com/api_keys',
  qwen:      'https://dashscope.console.aliyun.com/apiKey',
  zhipu:     'https://open.bigmodel.cn/usercenter/apikeys',
};

// ─── 类型 ─────────────────────────────────────────────────────────────────
interface AiConfigState {
  configured: boolean;
  provider?: AiProvider;
  model?: string;
  baseUrl?: string;
  apiKeyMasked?: string;
}

// ─── 主页面 ───────────────────────────────────────────────────────────────
export default function AiSettingsPage() {
  const [current,  setCurrent]  = useState<AiConfigState>({ configured: false });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [testing,  setTesting]  = useState(false);
  const [msg,      setMsg]      = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 表单状态 —— model 是纯自由文本，suggestions 只是快捷填充
  const [provider, setProvider] = useState<AiProvider>('deepseek');
  const [model,    setModel]    = useState('deepseek-chat');
  const [apiKey,   setApiKey]   = useState('');
  const [baseUrl,  setBaseUrl]  = useState('');
  const [showKey,  setShowKey]  = useState(false);

  const suggestions = PROVIDER_MODELS[provider]; // 仅用于快捷点击

  // ── 切换厂商：model 自动填入该厂商第一个建议值 ────────────────────────
  const handleProviderChange = (p: AiProvider) => {
    setProvider(p);
    setModel(PROVIDER_MODELS[p][0] ?? '');
    setMsg(null);
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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── 通用保存逻辑 ─────────────────────────────────────────────────────────
  const save = async (skipTest: boolean) => {
    if (!model.trim()) { setMsg({ type: 'err', text: '请输入模型名称' }); return; }
    if (!apiKey.trim() && !current.configured) {
      setMsg({ type: 'err', text: '请填写 API Key' }); return;
    }
    if (provider === 'custom' && !baseUrl.trim()) {
      setMsg({ type: 'err', text: '自定义模型需要填写 Base URL' }); return;
    }

    skipTest ? setSaving(true) : setTesting(true);
    setMsg(null);

    const body: Record<string, string | boolean> = {
      provider, model: model.trim(), skipTest,
    };
    // API Key 留空则沿用已有的（后端处理）
    if (apiKey.trim()) body.apiKey = apiKey.trim();
    if (baseUrl.trim()) body.baseUrl = baseUrl.trim();

    const r = await fetch('/api/settings/ai-config', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const d = await r.json();
    setMsg(r.ok ? { type: 'ok', text: d.message } : { type: 'err', text: d.message });
    if (r.ok) {
      setCurrent({ configured: true, provider, model: model.trim(), apiKeyMasked: current.apiKeyMasked });
      if (apiKey) setApiKey(''); // 保存成功后清空输入框
    }

    skipTest ? setSaving(false) : setTesting(false);
  };

  // ── 删除配置 ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm('确认删除 AI 模型配置？')) return;
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
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </Layout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard message="登录管理 AI 设置">
      <Layout>
        <div className="max-w-2xl mx-auto">

          {/* 标题 */}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">🤖 AI 模型设置</h1>
          <p className="text-gray-500 text-sm mb-8">
            配置您自己的 AI 模型，用于生成每日交易复盘。支持任意兼容 OpenAI API 的模型。
          </p>

          {/* 当前已配置状态 */}
          {current.configured && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{PROVIDER_ICON[current.provider!]}</span>
                <div>
                  <div className="font-semibold text-green-800">
                    {PROVIDER_LABELS[current.provider!]}
                    <span className="ml-2 font-mono text-sm bg-green-100 px-2 py-0.5 rounded">
                      {current.model}
                    </span>
                  </div>
                  <div className="text-green-600 text-xs mt-0.5">
                    ✅ API Key 已加密保存 · {current.apiKeyMasked}
                  </div>
                </div>
              </div>
              <button onClick={handleDelete} className="text-sm text-red-400 hover:text-red-600 hover:underline">
                删除
              </button>
            </div>
          )}

          {/* 配置表单 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">

            {/* ① 厂商选择 */}
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">① 选择 AI 厂商</label>
              <div className="grid grid-cols-4 gap-2">
                {ALL_PROVIDERS.map(p => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition ${
                      provider === p
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-base leading-none">{PROVIDER_ICON[p]}</span>
                    <span className="truncate">
                      {p === 'openai'    ? 'OpenAI'
                      : p === 'anthropic' ? 'Claude'
                      : p === 'google'   ? 'Gemini'
                      : p === 'deepseek' ? 'DeepSeek'
                      : p === 'qwen'     ? '通义千问'
                      : p === 'zhipu'    ? '智谱 GLM'
                      :                    '自定义'}
                    </span>
                  </button>
                ))}
              </div>
              {PROVIDER_KEY_URL[provider] && (
                <p className="text-xs text-gray-400 mt-2.5">
                  🔑 获取 API Key：
                  <a href={PROVIDER_KEY_URL[provider]} target="_blank" rel="noopener noreferrer"
                    className="text-blue-500 hover:underline ml-1">
                    {PROVIDER_KEY_URL[provider]}
                  </a>
                </p>
              )}
            </div>

            {/* ② 模型名称（自由输入 + 快捷建议） */}
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ② 模型名称
                <span className="ml-2 text-xs font-normal text-gray-400">可直接输入任意模型名</span>
              </label>

              {/* 自由输入框 */}
              <input
                type="text"
                placeholder="输入模型名称，如 gpt-5.4、gemini-3.1-pro、自定义模型名..."
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {/* 快捷建议芯片 */}
              {suggestions.length > 0 && (
                <div className="mt-2.5">
                  <span className="text-xs text-gray-400 mr-2">快速选择：</span>
                  <div className="inline-flex flex-wrap gap-1.5 mt-1">
                    {suggestions.map(m => (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        className={`px-2.5 py-1 rounded-md border text-xs transition ${
                          model === m
                            ? 'border-blue-400 bg-blue-50 text-blue-700 font-semibold'
                            : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ③ API Key */}
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ③ API Key
                {current.configured && (
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    留空则保留已有 Key（{current.apiKeyMasked}）
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={current.configured ? '留空保留现有 Key，或填入新 Key 替换' : '粘贴你的 API Key'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-16 text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700"
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                🔒 AES 加密存储，不会明文保存或传输
              </p>
            </div>

            {/* ④ Base URL（仅 custom） */}
            {provider === 'custom' && (
              <div className="p-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ④ Base URL <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs font-normal text-gray-400">OpenAI 兼容格式</span>
                </label>
                <input
                  type="url"
                  placeholder="https://your-api-proxy.com/v1"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* 消息 & 按钮 */}
            <div className="p-6 space-y-4">
              {msg && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  msg.type === 'ok'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {msg.type === 'ok' ? '✅ ' : '❌ '}{msg.text}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => save(false)}
                  disabled={testing || saving}
                  className="flex-1 py-2.5 rounded-lg border border-blue-500 text-blue-600 text-sm font-semibold
                             hover:bg-blue-50 disabled:opacity-40 transition"
                >
                  {testing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      测试中...
                    </span>
                  ) : '🔌 测试连接并保存'}
                </button>
                <button
                  onClick={() => save(true)}
                  disabled={saving || testing}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold
                             hover:bg-blue-700 disabled:opacity-40 transition"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      保存中...
                    </span>
                  ) : '💾 直接保存（跳过测试）'}
                </button>
              </div>
            </div>
          </div>

          {/* 各厂商简介 */}
          <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">📖 厂商说明 & 推荐模型</h3>
            <div className="space-y-1.5 text-xs text-gray-600">
              <div><span className="font-semibold">🐳 DeepSeek</span> — 国产推理模型，<span className="text-blue-600">deepseek-chat</span> 中文理解极强，性价比最高，<strong>首选推荐</strong></div>
              <div><span className="font-semibold">🟠 Anthropic</span> — <span className="text-blue-600">claude-opus-4-6</span> 分析最深入，支持扩展思考，复盘质量最高</div>
              <div><span className="font-semibold">🟢 OpenAI</span> — <span className="text-blue-600">gpt-4.1</span> / <span className="text-blue-600">gpt-5</span>，综合能力强，gpt-5.4 需代理支持</div>
              <div><span className="font-semibold">🔵 Gemini</span> — <span className="text-blue-600">gemini-2.5-pro</span> 速度快，gemini-3.1-pro 需最新接入点</div>
              <div><span className="font-semibold">🌙 通义千问</span> — <span className="text-blue-600">qwen-max</span> / <span className="text-blue-600">qwq-32b</span>，国内访问稳定，推理能力强</div>
              <div><span className="font-semibold">🧠 智谱 GLM</span> — <span className="text-blue-600">glm-4-plus</span>，国内合规，有免费额度</div>
              <div><span className="font-semibold">⚙️ 自定义</span> — 任何兼容 OpenAI Chat API 的服务，填入 Base URL 即可（如中转代理）</div>
            </div>
          </div>

        </div>
      </Layout>
    </AuthGuard>
  );
}
