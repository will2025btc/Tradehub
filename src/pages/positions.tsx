import { useSession, signIn } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import SyncStatusBar from '@/components/SyncStatusBar';

interface Position {
  id: string;
  symbol: string;
  side: string;
  leverage: number;
  status: string;
  openTime: string;
  closeTime: string | null;
  avgOpenPrice: number;
  avgClosePrice: number | null;
  quantity: number;
  realizedPnl: number;
  fee: number;
}

export default function Positions() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [symbolFilter, setSymbolFilter] = useState('');

  const handleSyncComplete = () => {
    // 同步完成后刷新持仓数据
    queryClient.invalidateQueries({ queryKey: ['positions'] });
  };

  const { data: positions, isLoading } = useQuery<Position[]>({
    queryKey: ['positions', filter],
    queryFn: async () => {
      const res = await fetch(`/api/positions?status=${filter}`);
      if (!res.ok) throw new Error('Failed to fetch positions');
      return res.json();
    },
    enabled: !!session,
  });

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0a1a1f] to-[#1a2f35]">
        <h1 className="text-4xl font-bold text-white">Followin Tradehub</h1>
        <p className="text-gray-300">登录查看您的持仓</p>
        <div className="flex gap-4">
          <Link
            href="/auth/signin"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            登录
          </Link>
          <Link
            href="/auth/register"
            className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition"
          >
            注册
          </Link>
        </div>
      </div>
    );
  }

  const filteredPositions = positions?.filter(p => 
    symbolFilter === '' || p.symbol.toLowerCase().includes(symbolFilter.toLowerCase())
  ) || [];

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
              <Link href="/positions" className="text-blue-600 font-semibold">
                持仓
              </Link>
              <Link href="/settings/api" className="text-gray-600 hover:text-gray-900">
                API设置
              </Link>
            </nav>
          </div>
          <span className="text-sm text-gray-600">{session.user?.email}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
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
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                全部
              </button>
              <button
                onClick={() => setFilter('open')}
                className={`px-4 py-2 rounded ${
                  filter === 'open' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                持仓中
              </button>
              <button
                onClick={() => setFilter('closed')}
                className={`px-4 py-2 rounded ${
                  filter === 'closed' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                已平仓
              </button>
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
        ) : filteredPositions.length === 0 ? (
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      交易对
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      方向
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      杠杆
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      开仓价
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      平仓价
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      盈亏
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPositions.map((position) => {
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {position.leverage}x
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${Number(position.avgOpenPrice).toFixed(2)}
                        </td>
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
                          <Link
                            href={`/positions/${position.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
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
        {filteredPositions.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">总持仓数</div>
              <div className="text-2xl font-bold">{filteredPositions.length}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">持仓中</div>
              <div className="text-2xl font-bold">
                {filteredPositions.filter(p => p.status === 'OPEN').length}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">总盈亏</div>
              <div className={`text-2xl font-bold ${
                filteredPositions.reduce((sum, p) => sum + Number(p.realizedPnl), 0) >= 0 ? 'text-profit' : 'text-loss'
              }`}>
                ${filteredPositions.reduce((sum, p) => sum + Number(p.realizedPnl), 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="text-sm text-gray-600">总手续费</div>
              <div className="text-2xl font-bold text-gray-900">
                ${filteredPositions.reduce((sum, p) => sum + Number(p.fee), 0).toFixed(2)}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
