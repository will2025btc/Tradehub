import { useState, useEffect, useCallback } from 'react';
import Layout from '@/components/Layout';

interface NewsTag {
  id: number;
  type: string;
  name: string;
  symbol: string;
  logo: string;
  price: string;
  percent_change_24h: string;
}

interface NewsItem {
  id: number;
  title: string;
  content: string;
  translated_title: string;
  translated_content: string;
  tags: NewsTag[];
  publish_time: number;
  important: boolean;
  source_name: string;
  nickname: string;
  avatar: string;
  source_url: string;
}

export default function News() {
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastCursor, setLastCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');

  const fetchNews = useCallback(async (cursor?: string) => {
    try {
      let url = '/api/news/flash?count=20';
      if (cursor) {
        url += `&last_cursor=${cursor}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (res.ok) {
        const items = data.list || [];
        if (cursor) {
          setNewsList(prev => [...prev, ...items]);
        } else {
          setNewsList(items);
        }
        setLastCursor(data.last_cursor || null);
        setHasMore(data.has_more !== false);
      } else {
        setError(data.message || '加载失败');
      }
    } catch (err) {
      setError('网络错误');
    }
  }, []);

  // 初始加载
  useEffect(() => {
    setLoading(true);
    fetchNews().finally(() => setLoading(false));
  }, [fetchNews]);

  // 自动刷新（每60秒）
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNews();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // 加载更多
  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastCursor) return;
    setLoadingMore(true);
    await fetchNews(lastCursor);
    setLoadingMore(false);
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;

    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  // 格式化涨跌幅颜色
  const getPriceChangeColor = (change: string) => {
    if (!change) return 'text-gray-500';
    const num = parseFloat(change);
    if (num > 0) return 'text-green-500';
    if (num < 0) return 'text-red-500';
    return 'text-gray-500';
  };

  return (
    <Layout maxWidth="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">加密快讯</h1>
          <p className="text-gray-600">实时追踪加密货币行业最新动态</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* 快讯列表 */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : newsList.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-400">
            暂无快讯
          </div>
        ) : (
          <div className="space-y-3">
            {newsList.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition ${
                  item.important ? 'border-l-4 border-blue-500' : ''
                }`}
              >
                {/* 头部：来源 + 时间 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {item.avatar && (
                      <img
                        src={item.avatar}
                        alt={item.nickname}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    <span className="text-xs font-medium text-gray-500">{item.nickname}</span>
                    {item.important && (
                      <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded font-medium">
                        重要
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(item.publish_time)}</span>
                </div>

                {/* 标题 */}
                {(item.translated_title || item.title) && (
                  <h3 className="font-semibold text-gray-900 mb-2 leading-snug">
                    {item.translated_title || item.title}
                  </h3>
                )}

                {/* 内容 */}
                <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                  {item.translated_content || item.content}
                </p>

                {/* 代币标签 */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {item.tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1"
                      >
                        {tag.logo && (
                          <img src={tag.logo} alt={tag.symbol} className="w-4 h-4 rounded-full" />
                        )}
                        <span className="text-xs font-medium text-gray-700">{tag.symbol}</span>
                        {tag.price && (
                          <span className="text-xs text-gray-500">{tag.price}</span>
                        )}
                        {tag.percent_change_24h && (
                          <span className={`text-xs font-medium ${getPriceChangeColor(tag.percent_change_24h)}`}>
                            {tag.percent_change_24h.startsWith('-') ? '' : '+'}{tag.percent_change_24h}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 来源链接 */}
                {item.source_url && (
                  <div className="mt-3">
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-600 hover:underline"
                    >
                      查看原文 →
                    </a>
                  </div>
                )}
              </div>
            ))}

            {/* 加载更多 */}
            {hasMore && (
              <div className="text-center py-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      加载中...
                    </span>
                  ) : '加载更多'}
                </button>
              </div>
            )}
          </div>
        )}
    </Layout>
  );
}
