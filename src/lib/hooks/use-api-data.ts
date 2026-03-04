import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

// ---- Generic fetcher ----

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `API error: ${res.status}`);
  }
  return res.json();
}

// ---- Types ----

export interface AccountMetrics {
  accountAsset: number;
  totalReturnRate: number;
  totalProfit: number;
  monthlyReturnRate: number;
  winRate: number;
  maxDrawdown: number;
  daysActive: number;
  initialCapital: number;
}

export interface AssetSnapshot {
  date: string;
  returnRate: number;
  equity: number;
}

export interface Position {
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

// ---- Hooks ----

/**
 * 获取账户核心指标
 */
export function useMetrics() {
  const { data: session } = useSession();

  return useQuery<AccountMetrics>({
    queryKey: ['account-metrics'],
    queryFn: () => apiFetch<AccountMetrics>('/api/account/metrics'),
    enabled: !!session,
  });
}

/**
 * 获取资产快照（曲线图数据）
 */
export function useSnapshots(timeRange: string) {
  const { data: session } = useSession();

  return useQuery<AssetSnapshot[]>({
    queryKey: ['asset-snapshots', timeRange],
    queryFn: () => apiFetch<AssetSnapshot[]>(`/api/account/snapshots?range=${timeRange}`),
    enabled: !!session,
  });
}

/**
 * 获取持仓列表
 */
export function usePositions(filter: 'all' | 'open' | 'closed') {
  const { data: session } = useSession();

  return useQuery<Position[]>({
    queryKey: ['positions', filter],
    queryFn: () => apiFetch<Position[]>(`/api/positions?status=${filter}`),
    enabled: !!session,
  });
}
