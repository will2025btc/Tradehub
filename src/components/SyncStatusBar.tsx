import { useAutoSync } from '@/lib/use-auto-sync';

interface SyncStatusBarProps {
  onSyncComplete?: () => void;
}

export default function SyncStatusBar({ onSyncComplete }: SyncStatusBarProps) {
  const { isSyncing, lastSyncAt, error, manualSync, formatLastSync } = useAutoSync(true);

  const handleSync = async () => {
    const result = await manualSync();
    if (result && onSyncComplete) {
      onSyncComplete();
    }
  };

  return (
    <div className="flex items-center justify-between bg-white rounded-lg shadow-sm px-4 py-2 mb-4">
      <div className="flex items-center gap-3">
        {/* 同步状态指示器 */}
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <div className="flex items-center gap-2 text-blue-600">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">同步中...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm">{error}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">已同步</span>
            </div>
          )}
        </div>

        {/* 最后同步时间 */}
        <span className="text-xs text-gray-400">
          {formatLastSync()}
        </span>
      </div>

      {/* 手动同步按钮 */}
      <button
        onClick={handleSync}
        disabled={isSyncing}
        className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {isSyncing ? '同步中' : '刷新数据'}
      </button>
    </div>
  );
}
