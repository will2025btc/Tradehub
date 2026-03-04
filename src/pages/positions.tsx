import { useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';
import SyncStatusBar from '@/components/SyncStatusBar';
import { usePositions } from '@/lib/hooks/use-api-data';

export default function Positions() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [symbolFilter, setSymbolFilter] = useState('');

  const { data: positions, isLoading } = usePositions(filter);

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({ queryKey: ['positions'] });
  };

  // Memoize filtered positions and summary stats
  const { filtered, totalCount, openCount, totalPnl, totalFee } = useMemo(() => {
    const filtered = positions?.filter(p =>
      symbolFilter === '' || p.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
    ) || [];

    return {
      filtered,
      totalCount: filtered.length,
      openCount: filtered.filter(p => p.status === 'OPEN').length,
      totalPnl: filtered.reduce((sum, p) => sum + Number(p.realizedPnl), 0),
      totalFee: filtered.reduce((sum, p) => sum + Number(p.fee), 0),
    };
  }, [positions, symbolFilter]);

  return (
    <AuthGuard message="登录查看您的持仓">
      <Layout>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">持仓管理</h1>
          <p className="text-gray-600">查看和分析您的交易持仓</p>
        </div>

        {/* 同步状态栏 */}
        <SyncStatusBar onSyncComplete={handleSyncComplete} />

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex gap-2">
              {(['all', 'open', 'closed'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded ${
                    filter === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? '全部' : status === 'open' ? '持仓中' : '已平仓'}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="按交易对筛选 (例如: BTC, ETH)"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Positions Table */}
        {isLoading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-gray-400">暂无持仓记录。请配置API密钥并同步数据。</div>
            <Link
              href="/settings/api"
              className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              配置API密钥
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">交易对</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">方向</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">杠杆</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开仓价</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平仓价</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">盈亏</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((position) => {
                    const pnl = Number(position.realizedPnl);
                    const isProfitable = pnl >= 0;
                    const returnRate = position.avgClosePrice && position.avgOpenPrice
                      ? ((position.avgClosePrice - position.avgOpenPrice) / position.avgOpenPrice * 100 * position.leverage * (position.side === 'LONG' ? 1 : -1))
                      : 0;

                    return (
                      <tr key={position.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {position.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            position.side === 'LONG' ? 'bg-profit text-white' : 'bg-loss text-white'
                          }`}>
                            {position.side}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{position.leverage}x</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${Number(position.avgOpenPrice).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {position.avgClosePrice ? `$${Number(position.avgClosePrice).toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className={isProfitable ? 'text-profit' : 'text-loss'}>
                            <div className="font-semibold">${pnl.toFixed(2)}</div>
                            {position.status === 'CLOSED' && (
                              <div className="text-xs">{returnRate > 0 ? '+' : ''}{returnRate.toFixed(2)}%</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            position.status === 'OPEN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {position.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link href={`/positions/${position.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                            查看详情 →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {totalCount > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">总持仓数</div>
              <div className="text-2xl font-bold">{totalCount}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">持仓中</div>
              <div className="text-2xl font-bold">{openCount}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">总盈亏</div>
              <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                ${totalPnl.toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">总手续费</div>
              <div className="text-2xl font-bold text-gray-900">${totalFee.toFixed(2)}</div>
            </div>
          </div>
        )}
      </Layout>
    </AuthGuard>
  );
}
