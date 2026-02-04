"use strict";
/**
 * Signal Types and Interfaces
 * Shared across all monitor modules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalType = void 0;
var SignalType;
(function (SignalType) {
    // On-chain signals
    SignalType["INSIDER_WALLET_DUMP"] = "INSIDER_WALLET_DUMP";
    SignalType["LIQUIDITY_REMOVAL"] = "LIQUIDITY_REMOVAL";
    SignalType["TVL_DECLINE"] = "TVL_DECLINE";
    SignalType["HOLDER_CONCENTRATION"] = "HOLDER_CONCENTRATION";
    // Social signals
    SignalType["TWITTER_ENGAGEMENT_DROP"] = "TWITTER_ENGAGEMENT_DROP";
    SignalType["INFLUENCER_SILENCE"] = "INFLUENCER_SILENCE";
    SignalType["SENTIMENT_COLLAPSE"] = "SENTIMENT_COLLAPSE";
    // Protocol signals
    SignalType["GITHUB_INACTIVITY"] = "GITHUB_INACTIVITY";
    SignalType["DEV_DEPARTURE"] = "DEV_DEPARTURE";
    SignalType["GOVERNANCE_BEARISH"] = "GOVERNANCE_BEARISH";
    SignalType["AUDIT_FINDING"] = "AUDIT_FINDING";
    // TradFi signals
    SignalType["EARNINGS_MISS"] = "EARNINGS_MISS";
    SignalType["REVENUE_MISS"] = "REVENUE_MISS";
    SignalType["INSIDER_SELLING_SEC"] = "INSIDER_SELLING_SEC";
    SignalType["SEC_FILING_BEARISH"] = "SEC_FILING_BEARISH";
    SignalType["MACRO_HEADWIND"] = "MACRO_HEADWIND";
})(SignalType || (exports.SignalType = SignalType = {}));
