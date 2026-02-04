/**
 * Base Monitor Class
 * All monitors extend this for consistent interface
 */
import { Signal, MonitorConfig } from './types';
export declare abstract class BaseMonitor {
    protected config: MonitorConfig;
    protected cache: Map<string, {
        data: any;
        timestamp: number;
    }>;
    constructor(config: MonitorConfig);
    /**
     * Main scan method - implemented by each monitor
     * Returns array of signals detected
     */
    abstract scan(): Promise<Signal[]>;
    /**
     * Get cached data if valid, otherwise return null
     */
    protected getCached<T>(key: string): T | null;
    /**
     * Set cached data with current timestamp
     */
    protected setCached(key: string, data: any): void;
    /**
     * Clear all cached data
     */
    protected clearCache(): void;
    /**
     * Check if monitor is enabled
     */
    isEnabled(): boolean;
}
/**
 * On-Chain Monitor
 * Tracks wallet movements, liquidity, TVL
 */
export declare class OnChainMonitor extends BaseMonitor {
    scan(): Promise<Signal[]>;
}
