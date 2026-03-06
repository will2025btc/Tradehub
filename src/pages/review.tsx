import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import Layout from '@/components/Layout';
import AuthGuard from '@/components/AuthGuard';

// ─── types ────────────────────────────────────────────────────────────────────
interface ReviewSummary {
  id: string;
  date: string;
  posCount: number;
  totalPnl: number;
  createdAt: string;
}

interface ReviewDetail {
  id: string;
  date: string;
  posCount: number;
  totalPnl: number;
  aiReview: string;
  createdAt: string;
}

// ─── simple markdown renderer (no external lib) ───────────────────────────────
function renderMarkdown(text: string): string {
  return text
    // h2
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2 text-gray-800">$1</h2>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // paragraphs (wrap double-newline blocks)
    .replace(/\n{2,}/g, '</p><p class="mb-2">')
    // single newline → <br>
    .replace(/\n/g, '<br/>');
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function ReviewPage() {
  const [reviews,       setReviews]       = useState<ReviewSummary[]>([]);
  const [selectedDate,  setSelectedDate]  = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [detail,        setDetail]        = useState<ReviewDetail | null>(null);
  const [streaming,     setStreaming]      = useState(false);
  const [streamText,    setStreamText]     = useState('');
  const [statusMsg,     setStatusMsg]      = useState('');
  const [error,         setError]          = useState('');
  const streamRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── scroll to bottom while streaming ──
  useEffect(() => {
    if (streaming) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamText, streaming]);

  // ── fetch list on mount ────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    try {
      const r = await fetch('/api/review/list');
      if (r.ok) setReviews(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── fetch detail for a date ────────────────────────────────────────────────
  const fetchDetail = useCallback(async (date: string) => {
    setDetail(null);
    setStreamText('');
    setError('');
    try {
      const r = await fetch(`/api/review/${date}`);
      if (r.ok) {
        const d: ReviewDetail = await r.json();
        setDetail(d);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchDetail(selectedDate); }, [selectedDate, fetchDetail]);

  // ── generate review (SSE streaming) ───────────────────────────────────────
  const generate = async () => {
    if (streaming) return;
    setStreaming(true);
    setStreamText('');
    setDetail(null);
    setError('');
    setStatusMsg('');

    streamRef.current = new AbortController();

    try {
      const resp = await fetch('/api/review/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date: selectedDate }),
        signal:  streamRef.current.signal,
      });

      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        setError(j.message || '生成失败，请重试');
        setStreaming(false);
        return;
      }

      const reader  = resp.body!.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const evt = JSON.parse(raw);
            if (evt.type === 'text')   setStreamText(prev => prev + evt.text);
            if (evt.type === 'status') setStatusMsg(evt.message);
            if (evt.type === 'error')  setError(evt.message);
            if (evt.type === 'done') {
              // refresh list & detail after completion
              await fetchList();
              await fetchDetail(selectedDate);
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError('网络错误，请重试');
    } finally {
      setStreaming(false);
      setStatusMsg('');
    }
  };

  const cancelStream = () => {
    streamRef.current?.abort();
    setStreaming(false);
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  const displayText = detail?.aiReview ?? streamText;
  const hasContent  = displayText.length > 0;

  return (
    <AuthGuard message="登录查看每日复盘">
      <Layout maxWidth="max-w-7xl">
        <div className="flex gap-6">

          {/* ── 左侧：历史列表 ──────────────────────────────────── */}
          <aside className="w-56 flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              历史复盘
            </h2>
            <ul className="space-y-1">
              {reviews.length === 0 && (
                <li className="text-sm text-gray-400 py-2">暂无记录</li>
              )}
              {reviews.map(r => (
                <li key={r.id}>
                  <button
                    onClick={() => { setSelectedDate(r.date); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition text-sm ${
                      selectedDate === r.date
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium">{r.date}</div>
                    <div className={`text-xs mt-0.5 ${r.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {r.totalPnl >= 0 ? '+' : ''}{r.totalPnl.toFixed(2)} USDT · {r.posCount} 笔
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* ── 右侧：主内容 ────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* 顶栏 */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">📊 每日复盘</h1>
                <input
                  type="date"
                  value={selectedDate}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                {streaming ? (
                  <button
                    onClick={cancelStream}
                    className="px-4 py-2 rounded-lg text-sm border border-red-300 text-red-600 hover:bg-red-50 transition"
                  >
                    停止生成
                  </button>
                ) : (
                  <button
                    onClick={generate}
                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition"
                  >
                    🤖 {detail ? '重新生成' : '生成今日复盘'}
                  </button>
                )}
              </div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* 流式状态提示 */}
            {streaming && statusMsg && (
              <div className="mb-3 flex items-center gap-2 text-sm text-blue-600">
                <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                {statusMsg}
              </div>
            )}

            {/* 复盘内容 */}
            {hasContent ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                {/* 元信息 */}
                {detail && (
                  <div className="flex gap-4 mb-5 pb-4 border-b border-gray-100 text-sm text-gray-500">
                    <span>📅 {detail.date}</span>
                    <span>📊 {detail.posCount} 笔平仓</span>
                    <span className={detail.totalPnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                      {detail.totalPnl >= 0 ? '📈 +' : '📉 '}{detail.totalPnl.toFixed(2)} USDT
                    </span>
                    <span className="ml-auto text-gray-400 text-xs">
                      生成于 {new Date(detail.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                )}

                {/* AI 报告正文 */}
                <div
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + renderMarkdown(displayText) + '</p>' }}
                />

                {/* 流式光标 */}
                {streaming && (
                  <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 animate-pulse" />
                )}

                <div ref={bottomRef} />
              </div>
            ) : (
              /* 空状态 */
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                {streaming ? (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <span className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
                    </div>
                    <p className="text-gray-500 text-sm">AI 正在分析您的交易数据，请稍候...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-5xl">📈</div>
                    <p className="text-gray-700 font-semibold">
                      {selectedDate} 暂无复盘记录
                    </p>
                    <p className="text-gray-400 text-sm">
                      点击「生成今日复盘」，AI 将自动分析您的实盘数据并给出建议
                    </p>
                    <button
                      onClick={generate}
                      className="mt-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                    >
                      🤖 立即生成复盘
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </Layout>
    </AuthGuard>
  );
}
