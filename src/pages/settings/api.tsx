import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function ApiSettings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [hasExistingApi, setHasExistingApi] = useState(false);

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
      const res = await fetch('/api/settings/api-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'API 密钥保存成功！正在跳转到数据同步...' });
        setFormData({ apiKey: '', apiSecret: '' });
        setHasExistingApi(true);
        
        // 1.5秒后跳转到同步页面并自动开始同步
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
    if (!confirm('确定要删除 API 配置吗？')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/settings/api-config', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'API 配置已删除' });
        setHasExistingApi(false);
      } else {
        setMessage({ type: 'error', text: data.message || '删除失败' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '网络错误' });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600">
              Followin Tradehub
            </Link>
            <nav className="flex gap-4">
              <Link href="/" className="text-gray-600 hover:text-gray-900">
                概览
              </Link>
              <Link href="/positions" className="text-gray-600 hover:text-gray-900">
                持仓
              </Link>
              <Link href="/settings/api" className="text-blue-600 font-semibold">
                API设置
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{session.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">币安 API 配置</h1>
          <p className="text-gray-600">配置您的币安 API 密钥以同步交易数据</p>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">安全提示</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>请使用只读权限的 API 密钥</li>
                  <li>不要授予交易和提现权限</li>
                  <li>API 密钥将被加密存储</li>
                  <li>绝不要在公共场合分享您的 API 密钥</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        {hasExistingApi && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-green-800">API 密钥已配置</span>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {message.text && (
              <div className={`p-4 rounded ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-600' 
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {message.text}
              </div>
            )}

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-2">
                API Key *
              </label>
              <input
                type="text"
                id="apiKey"
                name="binance-api-key"
                required
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                autoComplete="off"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入您的币安 API Key"
              />
            </div>

            <div>
              <label htmlFor="apiSecret" className="block text-sm font-medium text-gray-700 mb-2">
                API Secret *
              </label>
              <input
                type="password"
                id="apiSecret"
                name="binance-api-secret"
                required
                value={formData.apiSecret}
                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                autoComplete="new-password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="输入您的币安 API Secret"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed"
              >
                {loading ? '保存中...' : hasExistingApi ? '更新 API 密钥' : '保存 API 密钥'}
              </button>
              {hasExistingApi && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-red-300"
                >
                  删除配置
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">如何获取币安 API 密钥？</h2>
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
            <li>登录币安账户，访问 <a href="https://www.binance.com/zh-CN/my/settings/api-management" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">API 管理页面</a></li>
            <li>点击"创建 API"按钮</li>
            <li>输入 API 标签名称（例如："Trading Dashboard"）</li>
            <li>完成安全验证（邮箱/手机验证）</li>
            <li>
              <strong>重要：</strong>只勾选"启用读取"权限
              <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-gray-600">
                <li>✅ 启用读取</li>
                <li>❌ 不要启用交易</li>
                <li>❌ 不要启用提现</li>
              </ul>
            </li>
            <li>复制 API Key 和 Secret Key</li>
            <li>将密钥粘贴到上面的表单中</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
