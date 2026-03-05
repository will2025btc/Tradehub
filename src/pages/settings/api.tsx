import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

type Exchange = 'binance' | 'okx';

const EXCHANGE_CONFIG: Record<Exchange, {
  label: string;
  logo: string;
  docsUrl: string;
  docsText: string;
  steps: string[];
}> = {
  binance: {
    label: '币安 (Binance)',
    logo: '🟡',
    docsUrl: 'https://www.binance.com/zh-CN/my/settings/api-management',
    docsText: '币安 API 管理页面',
    steps: [
      '登录币安账户，访问 API 管理页面',
      '点击「创建 API」按钮，输入名称（如 "Trading Dashboard"）',
      '完成安全验证（邮箱/手机）',
      '重要：只勾选「启用读取」权限，不要勾选交易和提现',
      '复制 API Key 和 Secret Key 填入上方表单',
    ],
  },
  okx: {
    label: 'OKX',
    logo: '⚫',
    docsUrl: 'https://www.okx.com/zh-hans/account/my-api',
    docsText: 'OKX API 管理页面',
    steps: [
      '登录 OKX 账户，访问 API 管理页面',
      '点击「创建 V5 API Key」，输入 API 名称',
      '设置 Passphrase（牢记，之后无法查看）',
      '重要：权限只选「读取」，不要勾选交易和提现',
      '复制 API Key、Secret Key 和 Passphrase 填入上方表单',
    ],
  },
};

export default function ApiSettings() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedExchange, setSelectedExchange] = useState<Exchange>('binance');
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    passphrase: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [hasExistingApi, setHasExistingApi] = useState(false);
  const [existingExchange, setExistingExchange] = useState<string>('');

  useEffect(() => {
    if (session) {
      checkExistingApi();
    }
  }, [session]);

  const checkExistingApi = async () => {
    try {
      const res = await fetch('/api/settings/api-config');
      if (res.ok) {
        const data = await res.json();
        if (data.hasApi) {
          setHasExistingApi(true);
          setExistingExchange(data.exchange || 'binance');
          setSelectedExchange(data.exchange || 'binance');
        }
      }
    } catch (error) {
      console.error('检查API配置失败:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      const body: Record<string, string> = {
        exchange: selectedExchange,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
      };

      if (selectedExchange === 'okx') {
        body.passphrase = formData.passphrase;
      }

      const res = await fetch('/api/settings/api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'API 密钥保存成功！正在跳转到数据同步...' });
        setFormData({ apiKey: '', apiSecret: '', passphrase: '' });
        setHasExistingApi(true);
        setExistingExchange(selectedExchange);

        setTimeout(() => {
          router.push('/settings/sync?auto=true');
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.message || 'API 密钥保存失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除 API 配置吗？删除后将无法同步数据。')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/settings/api-config', { method: 'DELETE' });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'API 配置已删除' });
        setHasExistingApi(false);
        setExistingExchange('');
      } else {
        setMessage({ type: 'error', text: data.message || '删除失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setLoading(false);
    }
  };

  const config = EXCHANGE_CONFIG[selectedExchange];

  return (
    <AuthGuard message="登录管理您的 API 配置">
      <Layout maxWidth="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">API 配置</h1>
          <p className="text-gray-600">配置您的交易所 API 密钥以同步交易数据</p>
        </div>

        {/* 当前已配置状态 */}
        {hasExistingApi && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-green-800">
              已配置 {existingExchange === 'okx' ? 'OKX' : '币安 (Binance)'} API 密钥
            </span>
          </div>
        )}

        {/* 交易所选择 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">选择交易所</h2>
          <div className="grid grid-cols-2 gap-4">
            {(Object.entries(EXCHANGE_CONFIG) as [Exchange, typeof EXCHANGE_CONFIG[Exchange]][]).map(([key, ex]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedExchange(key);
                  setMessage({ type: '', text: '' });
                }}
                className={`relative flex items-center gap-3 p-4 border-2 rounded-xl transition-all text-left ${
                  selectedExchange === key
                    ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <span className="text-2xl">{ex.logo}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{ex.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {key === 'okx' ? 'Key + Secret + Passphrase' : 'API Key + Secret'}
                  </p>
                </div>
                {selectedExchange === key && (
                  <span className="absolute top-2 right-2">
                    <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 安全提示 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="ml-3 text-sm text-blue-700">
              <p className="font-medium text-blue-800 mb-1">安全提示</p>
              <ul className="list-disc list-inside space-y-1">
                <li>请使用<strong>只读权限</strong>的 API 密钥</li>
                <li>不要授予交易和提现权限</li>
                <li>所有密钥均加密存储，绝不明文保存</li>
                <li>请勿在公共场合分享您的 API 密钥</li>
              </ul>
            </div>
          </div>
        </div>

        {/* API 表单 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">
            {config.label} API 密钥
          </h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {message.text && (
              <div className={`p-4 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            {/* API Key */}
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1.5">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="apiKey"
                name="exchange-api-key"
                required
                value={formData.apiKey}
                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                autoComplete="off"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder={`输入您的 ${config.label} API Key`}
              />
            </div>

            {/* API Secret */}
            <div>
              <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-700 mb-1.5">
                API Secret <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="apiSecret"
                name="exchange-api-secret"
                required
                value={formData.apiSecret}
                onChange={e => setFormData({ ...formData, apiSecret: e.target.value })}
                autoComplete="new-password"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="输入您的 API Secret"
              />
            </div>

            {/* Passphrase（仅 OKX） */}
            {selectedExchange === 'okx' && (
              <div>
                <label htmlFor="passphrase" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Passphrase <span className="text-red-500">*</span>
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    （OKX 创建 API 时设置的密码）
                  </span>
                </label>
                <input
                  type="password"
                  id="passphrase"
                  name="exchange-passphrase"
                  required
                  value={formData.passphrase}
                  onChange={e => setFormData({ ...formData, passphrase: e.target.value })}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="输入您的 OKX Passphrase"
                />
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {loading ? '验证并保存中...' : hasExistingApi ? '更新 API 密钥' : '保存 API 密钥'}
              </button>
              {hasExistingApi && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium disabled:bg-red-300"
                >
                  删除配置
                </button>
              )}
            </div>
          </form>
        </div>

        {/* 操作指南 */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            如何获取 {config.label} API 密钥？
          </h2>
          <ol className="list-decimal list-inside space-y-2.5 text-sm text-gray-700">
            {config.steps.map((step, i) => (
              <li key={i}>
                {i === 0 ? (
                  <>
                    {step.split('访问')[0]}访问{' '}
                    <a
                      href={config.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {config.docsText}
                    </a>
                  </>
                ) : step.includes('重要') ? (
                  <span>
                    <strong className="text-red-600">重要：</strong>
                    {step.replace('重要：', '')}
                  </span>
                ) : (
                  step
                )}
              </li>
            ))}
          </ol>
        </div>
      </Layout>
    </AuthGuard>
  );
}
