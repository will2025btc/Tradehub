import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Trade {
  id: string;
  side: 'BUY' | 'SELL';
  positionSide: string;
  quantity: number;
  price: number;
  fee: number;
  time: string;
  orderType: string;
}

interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  status: string;
  openTime: string;
  closeTime: string | null;
  avgOpenPrice: number;
  avgClosePrice: number | null;
  quantity: number;
  maxQuantity: number;
  maxPositionValue: number;
  maxMargin: number;
  realizedPnl: number;
  fee: number;
  trades: Trade[];
  openTradesCount: number;
  closeTradesCount: number;
  totalTradeVolume: number;
  profitPercentage: number;
}

export default function PositionDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: session, status } = useSession();
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (id && session) {
      fetchPositionDetail();
    }
  }, [id, session]);

  const fetchPositionDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/positions/${id}`);
      const data = await response.json();
      
      if (response.ok) {
        setPosition(data.position);
      } else {
        setError(data.message || '获取持仓详情失败');
      }
    } catch (error) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '持仓不存在'}</p>
          <Link
            href="/positions"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            返回持仓列表
          </Link>
        </div>
      </div>
    );
  }

  const isProfitable = position.realizedPnl >= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 返回按钮 */}
        <Link
          href="/positions"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回持仓列表
        </Link>

        {/* 头部信息卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{position.symbol}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                position.side === 'LONG'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {position.side === 'LONG' ? '多' : '空'}{position.leverage}倍
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                position.status === 'OPEN'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {position.status === 'OPEN' ? '持仓中' : '已平仓'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isProfitable ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingDown className="w-6 h-6 text-red-600" />
              )}
              <span className={`text-2xl font-bold ${
                isProfitable ? 'text-green-600' : 'text-red-600'
              }`}>
                {isProfitable ? '+' : ''}{position.profitPercentage.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* 详细数据 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">开仓均价</p>
              <p className="text-lg font-semibold">${Number(position.avgOpenPrice).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">平仓均价</p>
              <p className="text-lg font-semibold">
                {position.avgClosePrice 
                  ? `$${Number(position.avgClosePrice).toFixed(4)}`
                  : '--'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">收益</p>
              <p className={`text-lg font-semibold ${
                isProfitable ? 'text-green-600' : 'text-red-600'
              }`}>
                {isProfitable ? '+' : ''}${Number(position.realizedPnl).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">手续费</p>
              <p className="text-lg font-semibold">${Number(position.fee).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">持仓量(最大)</p>
              <p className="text-lg font-semibold">{Number(position.maxQuantity).toFixed(4)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">持仓价值(最大)</p>
              <p className="text-lg font-semibold">${Number(position.maxPositionValue).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">保证金(最大)</p>
              <p className="text-lg font-semibold">${Number(position.maxMargin).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">交易额</p>
              <p className="text-lg font-semibold">${Number(position.totalTradeVolume).toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* 操作时间轴 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-6">操作时间轴</h2>
          
          <div className="space-y-4">
            {position.trades.map((trade, index) => {
              const isOpening = 
                (position.side === 'LONG' && trade.side === 'BUY') ||
                (position.side === 'SHORT' && trade.side === 'SELL');
              
              const actionLabel = position.side === 'LONG'
                ? (trade.side === 'BUY' ? '买入开多' : '卖出平多')
                : (trade.side === 'SELL' ? '卖出开空' : '买入平空');
              
              return (
                <div key={trade.id} className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                  {/* 图标 */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    isOpening
                      ? 'bg-green-100 text-green-600'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {isOpening ? (
                      <Plus className="w-5 h-5" />
                    ) : (
                      <Minus className="w-5 h-5" />
                    )}
                  </div>
                  
                  {/* 内容 */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          isOpening
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {actionLabel}
                        </span>
                        <span className="text-sm text-gray-500">
                          {format(new Date(trade.time), 'yyyy-MM-dd HH:mm:ss')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">数量: </span>
                        <span className="font-medium">{Number(trade.quantity).toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">价格: </span>
                        <span className="font-medium">${Number(trade.price).toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">手续费: </span>
                        <span className="font-medium">${Number(trade.fee).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
