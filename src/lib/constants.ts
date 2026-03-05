/** Binance futures taker fee rate (0.04%). Maker rate is 0.02%. */
export const BINANCE_FEE_RATE = 0.0004;

/** Default sync window for manual sync (days) */
export const MANUAL_SYNC_DAYS = 7;

/** Default sync window for cron sync (days) */
export const CRON_SYNC_DAYS = 1;

/** Concurrency limit for parallel Binance API requests */
export const BINANCE_API_CONCURRENCY = 5;

/** Max retries for failed Binance API calls */
export const BINANCE_API_MAX_RETRIES = 3;

/** Concurrency limit for parallel OKX API requests */
export const OKX_API_CONCURRENCY = 3;

/** Max retries for failed OKX API calls */
export const OKX_API_MAX_RETRIES = 3;
