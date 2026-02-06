// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPositionRegistry {
    enum PositionStatus {
        OPEN,
        CLOSED_PROFIT,
        CLOSED_LOSS,
        CLOSED_STOP_LOSS,
        LIQUIDATED
    }
    
    function recordPosition(
        address tokenAddress,
        string calldata chain,
        uint256 entryPrice,
        uint256 sizeTokens,
        uint256 sizeUSDC,
        uint16 confidenceScore,
        bytes32[] calldata triggeringSignals
    ) external returns (uint256 positionId);
    
    function closePosition(
        uint256 positionId,
        uint256 exitPrice,
        PositionStatus finalStatus
    ) external;
}
