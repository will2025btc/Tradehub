import { useState, useEffect, useCallback, useRef } from 'react';

interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: string | null;
  error: string | null;
  tradesCount: number;
  positionsCount: number;
}

/**
 * 自动同步Hook
 * - 页面加载时检查是否需要同步（超过5分钟）
 * - 每5分钟自动同步一次
 * - 提供手动同步功能
 */
export function useAutoSync(enabled: boolean = true) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncAt: null,
    error: null,
    tradesCount: 0,
    positionsCount: 0,
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const SYNC_INTERVAL = 5 * 60 * 1000; // 5分钟

  // 检查是否需要同步
  const needsSync = useCallback(() => {
    const lastSync = localStorage.getItem('lastSyncAt');
    if (!lastSync) return true;
    
    const lastSyncTime = new Date(lastSync).getTime();
    const now = Date.now();
    return (now - lastSyncTime) > SYNC_INTERVAL;
  }, []);

  // 执行同步
  const doSync = useCallback(async (silent: boolean = false) => {
    if (syncStatus.isSyncing) return;

    if (!silent) {
      setSyncStatus(prev => ({ ...prev, isSyncing: true, error: null }));
    } else {
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));
    }

    try {
      const res = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      if (!isMountedRef.current) return;

      if (res.ok) {
        const now = new Date().toISOString();
        localStorage.setItem('lastSyncAt', now);
        setSyncStatus({
          isSyncing: false,
          lastSyncAt: now,
          error: null,
          tradesCount: data.tradesCount || 0,
          positionsCount: data.positionsCount || 0,
        });
        return true;
      } else {
        if (data.needsConfig) {
          // 用户未配置API，不算错误
          setSyncStatus(prev => ({
            ...prev,
            isSyncing: false,
            error: null,
          }));
        } else {
          setSyncStatus(prev => ({
            ...prev,
            isSyncing: false,
            error: data.message || '同步失败',
          }));
        }
        return false;
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        error: '网络错误',
      }));
      return false;
    }
  }, [syncStatus.isSyncing]);

  // 手动同步
  const manualSync = useCallback(() => {
    return doSync(false);
  }, [doSync]);

  // 初始化：页面加载时检查并同步
  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) return;

    // 读取上次同步时间
    const lastSync = localStorage.getItem('lastSyncAt');
    if (lastSync) {
      setSyncStatus(prev => ({ ...prev, lastSyncAt: lastSync }));
    }

    // 如果需要同步，延迟1秒后执行（避免阻塞页面渲染）
    if (needsSync()) {
      const timer = setTimeout(() => {
        doSync(true); // 静默同步
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  // 定时轮询
  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(() => {
      if (needsSync()) {
        doSync(true); // 静默同步
      }
    }, SYNC_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, needsSync, doSync]);

  // 清理
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 格式化最后同步时间
  const formatLastSync = useCallback(() => {
    if (!syncStatus.lastSyncAt) return '从未同步';
    
    const diff = Date.now() - new Date(syncStatus.lastSyncAt).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    
    return new Date(syncStatus.lastSyncAt).toLocaleString('zh-CN');
  }, [syncStatus.lastSyncAt]);

  return {
    ...syncStatus,
    manualSync,
    formatLastSync,
    needsSync: needsSync(),
  };
}
