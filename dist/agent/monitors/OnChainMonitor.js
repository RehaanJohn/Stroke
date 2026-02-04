"use strict";
/**
 * Base Monitor Class
 * All monitors extend this for consistent interface
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnChainMonitor = exports.BaseMonitor = void 0;
class BaseMonitor {
    constructor(config) {
        this.config = config;
        this.cache = new Map();
    }
    /**
     * Get cached data if valid, otherwise return null
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (!cached)
            return null;
        const cacheTimeMs = this.config.cacheTimeMs || 3600000; // 1 hour default
        const isValid = Date.now() - cached.timestamp < cacheTimeMs;
        return isValid ? cached.data : null;
    }
    /**
     * Set cached data with current timestamp
     */
    setCached(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }
    /**
     * Clear all cached data
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Check if monitor is enabled
     */
    isEnabled() {
        return this.config.enabled;
    }
}
exports.BaseMonitor = BaseMonitor;
/**
 * On-Chain Monitor
 * Tracks wallet movements, liquidity, TVL
 */
class OnChainMonitor extends BaseMonitor {
    async scan() {
        const signals = [];
        // TODO: Implement on-chain monitoring logic
        // - Track insider wallet movements
        // - Monitor liquidity pool events
        // - Watch TVL changes
        // - Check holder concentration
        return signals;
    }
}
exports.OnChainMonitor = OnChainMonitor;
