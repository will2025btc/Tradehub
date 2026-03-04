import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

export default function SyncData() {
  const { data: session } = useSession();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null as string | null,
    totalTrades: 0,
    totalPositions: 0,
  });

  // 从API配置页面跳转过来时自动开始同步
  useEffect(() => {
    if (session && router.query.auto === 'true') {
      setTimeout(() => {
        handleSync();
      }, 1000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, router.query]);

  const handleSync = async () => {
    setMessage({ type: '', text: '' });
    setSyncing(true);

    try {
      const res = await fetch('/api/sync/manual', {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `同步成功！导入了 ${data.tradesCount || 0} 笔交易，${data.positionsCount || 0} 个持仓`
        });
        setSyncStatus({
          lastSync: new Date().toISOString(),
          totalTrades: data.tradesCount || 0,
          totalPositions: data.positionsCount || 0,
        });
      } else {
        setMessage({
          type: 'error',
          text: data.message || '同步失败，请检查 API 配置'
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: '网络错误，请稍后重试'
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AuthGuard message="登录管理数据同步">
      <Layout maxWidth="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">数据同步</h1>
          <p className="text-gray-600">手动同步您的币安交易数据</p>
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
              <h3 className="text-sm font-medium text-blue-800">关于数据同步</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>首次同步会拉取最近 90 天的交易数据</li>
                  <li>后续同步只会拉取新的数据</li>
                  <li>同步可能需要几分钟时间</li>
                  <li>请确保已配置币安 API 密钥</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        {syncStatus.lastSync && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-green-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-800">上次同步成功</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>时间：{new Date(syncStatus.lastSync).toLocaleString('zh-CN')}</p>
                  <p>交易：{syncStatus.totalTrades} 笔</p>
                  <p>持仓：{syncStatus.totalPositions} 个</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {message.text && (
            <div className={`p-4 rounded mb-6 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-600'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {message.text}
            </div>
          )}

          <div className="text-center py-8">
            <svg
              className={`mx-auto h-16 w-16 mb-4 ${syncing ? 'animate-spin text-blue-600' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {syncing ? '正在同步数据...' : '准备同步'}
            </h2>
            <p className="text-gray-600 mb-6">
              {syncing
                ? '请稍候，正在从币安拉取您的交易数据'
                : '点击下方按钮开始同步币安交易数据'
              }
            </p>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed text-lg font-medium"
            >
              {syncing ? '同步中...' : '开始同步'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">同步说明</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <h3 className="font-semibold mb-2">自动同步</h3>
              <p>系统会每隔 5 分钟自动同步一次新数据（后台任务）</p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">同步内容</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>账户余额历史</li>
                <li>期货持仓记录</li>
                <li>订单历史（开仓/平仓）</li>
                <li>成交明细</li>
                <li>资金费率记录</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">注意事项</h3>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>首次同步可能需要较长时间</li>
                <li>如果数据量很大，建议分批同步</li>
                <li>同步期间请不要关闭页面</li>
                <li>如遇错误，请检查 API 配置是否正确</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">快速链接</h3>
              <div className="flex gap-4 mt-2">
                <Link href="/settings/api" className="text-blue-600 hover:underline">
                  → 配置 API 密钥
                </Link>
                <Link href="/positions" className="text-blue-600 hover:underline">
                  → 查看持仓
                </Link>
                <Link href="/" className="text-blue-600 hover:underline">
                  → 账户概览
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">开发提示</h3>
              <p className="mt-1 text-sm text-yellow-700">
                当前为 MVP 版本，数据同步功能需要进一步开发。请确保配置了有效的币安 API 密钥。
              </p>
            </div>
          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
}
