/**
 * Signal Types and Interfaces
 * Shared across all monitor modules
 */

export enum SignalType {
  // On-chain signals
  INSIDER_WALLET_DUMP = 'INSIDER_WALLET_DUMP',
  LIQUIDITY_REMOVAL = 'LIQUIDITY_REMOVAL',
  TVL_DECLINE = 'TVL_DECLINE',
  HOLDER_CONCENTRATION = 'HOLDER_CONCENTRATION',
  
  // Social signals
  TWITTER_ENGAGEMENT_DROP = 'TWITTER_ENGAGEMENT_DROP',
  INFLUENCER_SILENCE = 'INFLUENCER_SILENCE',
  SENTIMENT_COLLAPSE = 'SENTIMENT_COLLAPSE',
  
  // Protocol signals
  GITHUB_INACTIVITY = 'GITHUB_INACTIVITY',
  DEV_DEPARTURE = 'DEV_DEPARTURE',
  GOVERNANCE_BEARISH = 'GOVERNANCE_BEARISH',
  AUDIT_FINDING = 'AUDIT_FINDING',
  
  // TradFi signals
  EARNINGS_MISS = 'EARNINGS_MISS',
  REVENUE_MISS = 'REVENUE_MISS',
  INSIDER_SELLING_SEC = 'INSIDER_SELLING_SEC',
  SEC_FILING_BEARISH = 'SEC_FILING_BEARISH',
  MACRO_HEADWIND = 'MACRO_HEADWIND',
}

export interface Signal {
  type: SignalType;
  token: string; // Token address or symbol
  chain?: string; // Optional chain identifier
  score: number; // Signal strength (0-100)
  metadata: Record<string, any>; // Signal-specific data
  timestamp: number; // Unix timestamp
  source: string; // Monitor name
}

export interface MonitorConfig {
  enabled: boolean;
  scanIntervalMs: number;
  cacheTimeMs?: number;
}
