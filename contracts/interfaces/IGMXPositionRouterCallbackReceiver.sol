// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGMXPositionRouterCallbackReceiver
 * @notice Interface for receiving callbacks from GMX Position Router
 * @dev Implement this to handle position execution confirmations
 */
interface IGMXPositionRouterCallbackReceiver {
    /**
     * @notice Called by GMX Position Router after position is executed
     * @param positionKey Unique key identifying the position request
     * @param isExecuted true if position was successfully executed
     * @param isIncrease true for increase position, false for decrease
     */
    function gmxPositionCallback(
        bytes32 positionKey,
        bool isExecuted,
        bool isIncrease
    ) external;
}
