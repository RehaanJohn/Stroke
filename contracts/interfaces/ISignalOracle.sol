// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISignalOracle {
    enum SignalType {
        INSIDER_WALLET_DUMP,
        LIQUIDITY_REMOVAL,
        TWITTER_ENGAGEMENT_DROP,
        TWITTER_SENTIMENT_NEGATIVE,
        GOVERNANCE_BEARISH,
        GITHUB_COMMIT_DROP,
        DEVELOPER_EXODUS,
        WHALE_ALERT,
        REGULATORY_RISK,
        MACRO_EVENT,
        INSTITUTIONAL_MOVE,
        SENTIMENT_SHIFT
    }
    
    function getConfidenceScore(
        address tokenAddress,
        string calldata chain
    ) external view returns (uint16 totalScore, uint8 signalCount);
    
    function getRecentSignalIds(
        address tokenAddress,
        string calldata chain
    ) external view returns (bytes32[] memory);
}
