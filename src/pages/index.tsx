import { useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useState } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import SyncStatusBar from '@/components/SyncStatusBar';
import { useMetrics, useSnapshots } from '@/lib/hooks/use-api-data';

export default function Home() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState('all');
  const [activeTab, setActiveTab] = useState('returnRate');

  const { data: metrics, isLoading: metricsLoading } = useMetrics();
  const { data: snapshots, isLoading: snapshotsLoading } = useSnapshots(timeRange);

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['account-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['asset-snapshots'] });
  };

  return (
    <AuthGuard message="登录查看您的交易分析">
      <Layout>
        {/* 同步状态栏 */}
        <SyncStatusBar onSyncComplete={handleSyncComplete} />

        {/* Metrics Grid */}
        {metricsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MetricCard title="账户资产" value={`$${metrics.accountAsset.toFixed(2)}`} />
            <MetricCard
              title="总收益率"
              value={`${metrics.totalReturnRate.toFixed(2)}%`}
              valueClass={metrics.totalReturnRate >= 0 ? 'text-profit' : 'text-loss'}
            />
            <MetricCard
              title="累计收益"
              value={`$${metrics.totalProfit.toFixed(2)}`}
              valueClass={metrics.totalProfit >= 0 ? 'text-profit' : 'text-loss'}
            />
            <MetricCard
              title="月收益率"
              value={`${metrics.monthlyReturnRate.toFixed(2)}%`}
              valueClass={metrics.monthlyReturnRate >= 0 ? 'text-profit' : 'text-loss'}
            />
            <MetricCard title="历史胜率" value={`${metrics.winRate.toFixed(2)}%`} />
            <MetricCard title="最大回撤" value={`${metrics.maxDrawdown.toFixed(2)}%`} valueClass="text-loss" />
            <MetricCard title="活跃天数" value={metrics.daysActive.toString()} />
            <MetricCard title="初始资金" value={`$${metrics.initialCapital.toFixed(2)}`} />
          </div>
        ) : null}

        {/* Chart Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('returnRate')}
                className={`px-4 py-2 rounded ${activeTab === 'returnRate' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                总收益率
              </button>
              <button
                onClick={() => setActiveTab('equity')}
                className={`px-4 py-2 rounded ${activeTab === 'equity' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                账户资产
              </button>
            </div>
            <div className="flex gap-2">
              {['1M', '3M', '1Y', 'All'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range.toLowerCase().replace('m', 'month').replace('y', 'year'))}
                  className={`px-3 py-1 rounded text-sm ${
                    timeRange === range.toLowerCase().replace('m', 'month').replace('y', 'year')
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          {snapshotsLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="text-gray-400">Loading chart...</div>
            </div>
          ) : snapshots && snapshots.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={snapshots}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" style={{ fontSize: '12px' }} />
                <YAxis
                  stroke="#6B7280"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => activeTab === 'returnRate' ? `${value}%` : `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  formatter={(value: number) => [
                    activeTab === 'returnRate' ? `${value.toFixed(2)}%` : `$${value.toFixed(2)}`,
                    activeTab === 'returnRate' ? 'Return Rate' : 'Equity'
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={activeTab === 'returnRate' ? 'returnRate' : 'equity'}
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center">
              <div className="text-gray-400">No data available. Please configure your API keys.</div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <ActionCard title="查看持仓" description="查看当前和历史持仓记录" href="/positions" />
          <ActionCard title="每日复盘" description="AI 深度分析今日交易，给出真诚建议" href="/review" highlight />
          <ActionCard title="配置API" description="设置或更新币安API密钥" href="/settings/api" />
          <ActionCard title="同步数据" description="手动触发数据同步" href="/settings/sync" />
        </div>
      </Layout>
    </AuthGuard>
  );
}

function MetricCard({ title, value, valueClass = '' }: { title: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

function ActionCard({ title, description, href, highlight = false }: { title: string; description: string; href: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`p-6 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer block ${
        highlight
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-white'
      }`}
    >
      <h3 className={`text-lg font-semibold mb-2 ${highlight ? 'text-white' : ''}`}>{title}</h3>
      <p className={`text-sm ${highlight ? 'text-blue-100' : 'text-gray-600'}`}>{description}</p>
    </Link>
  );
}
