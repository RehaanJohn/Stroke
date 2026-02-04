/**
 * Base Monitor Class
 * All monitors extend this for consistent interface
 */

import { Signal, MonitorConfig } from './types';

export abstract class BaseMonitor {
  protected config: MonitorConfig;
  protected cache: Map<string, { data: any; timestamp: number }>;
  
  constructor(config: MonitorConfig) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * Main scan method - implemented by each monitor
   * Returns array of signals detected
   */
  abstract scan(): Promise<Signal[]>;

  /**
   * Get cached data if valid, otherwise return null
   */
  protected getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const cacheTimeMs = this.config.cacheTimeMs || 3600000; // 1 hour default
    const isValid = Date.now() - cached.timestamp < cacheTimeMs;
    
    return isValid ? cached.data : null;
  }

  /**
   * Set cached data with current timestamp
   */
  protected setCached(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached data
   */
  protected clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if monitor is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}

/**
 * On-Chain Monitor
 * Tracks wallet movements, liquidity, TVL
 */
export class OnChainMonitor extends BaseMonitor {
  async scan(): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    // TODO: Implement on-chain monitoring logic
    // - Track insider wallet movements
    // - Monitor liquidity pool events
    // - Watch TVL changes
    // - Check holder concentration
    
    return signals;
  }
}
