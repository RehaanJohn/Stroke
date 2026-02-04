/**
 * Signal Types and Interfaces
 * Shared across all monitor modules
 */
export declare enum SignalType {
    INSIDER_WALLET_DUMP = "INSIDER_WALLET_DUMP",
    LIQUIDITY_REMOVAL = "LIQUIDITY_REMOVAL",
    TVL_DECLINE = "TVL_DECLINE",
    HOLDER_CONCENTRATION = "HOLDER_CONCENTRATION",
    TWITTER_ENGAGEMENT_DROP = "TWITTER_ENGAGEMENT_DROP",
    INFLUENCER_SILENCE = "INFLUENCER_SILENCE",
    SENTIMENT_COLLAPSE = "SENTIMENT_COLLAPSE",
    GITHUB_INACTIVITY = "GITHUB_INACTIVITY",
    DEV_DEPARTURE = "DEV_DEPARTURE",
    GOVERNANCE_BEARISH = "GOVERNANCE_BEARISH",
    AUDIT_FINDING = "AUDIT_FINDING",
    EARNINGS_MISS = "EARNINGS_MISS",
    REVENUE_MISS = "REVENUE_MISS",
    INSIDER_SELLING_SEC = "INSIDER_SELLING_SEC",
    SEC_FILING_BEARISH = "SEC_FILING_BEARISH",
    MACRO_HEADWIND = "MACRO_HEADWIND"
}
export interface Signal {
    type: SignalType;
    token: string;
    chain?: string;
    score: number;
    metadata: Record<string, any>;
    timestamp: number;
    source: string;
}
export interface MonitorConfig {
    enabled: boolean;
    scanIntervalMs: number;
    cacheTimeMs?: number;
}
