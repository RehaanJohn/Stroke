/**
 * TradFi Monitor
 * Monitors traditional finance signals that correlate to crypto assets
 * - Yahoo Finance earnings data
 * - SEC Form 4 insider trading filings
 * - Maps stock tickers to correlated crypto tokens
 */
import { BaseMonitor } from './OnChainMonitor';
import { Signal, MonitorConfig } from './types';
interface StockCryptoMapping {
    ticker: string;
    cryptoTokens: Array<{
        symbol: string;
        chain: string;
        address: string;
        correlationStrength: number;
    }>;
}
export declare class TradFiMonitor extends BaseMonitor {
    private httpClient;
    private secClient;
    private readonly TICKER_MAPPINGS;
    private recentTransactions;
    constructor(config: MonitorConfig);
    scan(): Promise<Signal[]>;
    /**
     * Check earnings data from Yahoo Finance
     */
    private checkEarnings;
    /**
     * Check SEC Form 4 insider trading filings
     */
    private checkInsiderTrading;
    /**
     * Fetch earnings data from Yahoo Finance API
     */
    private fetchEarningsData;
    /**
     * Fetch insider trading data from SEC EDGAR
     */
    private fetchInsiderTradings;
    /**
     * Get CIK (Central Index Key) for a stock ticker
     */
    private getCIK;
    /**
     * Parse Form 4 filing for transaction details
     * Simplified version - real implementation needs XML parsing
     */
    private parseForm4;
    /**
     * Detect large insider sells (CEO/CFO > $5M)
     */
    private detectLargeInsiderSells;
    /**
     * Detect coordinated selling (multiple insiders within 7 days)
     */
    private detectCoordinatedSells;
    /**
     * Get all tracked tickers
     */
    getTrackedTickers(): string[];
    /**
     * Get crypto tokens for a specific ticker
     */
    getCryptoTokensForTicker(ticker: string): StockCryptoMapping | undefined;
    /**
     * Add custom ticker mapping
     */
    addTickerMapping(mapping: StockCryptoMapping): void;
}
export {};
