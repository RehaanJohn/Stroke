// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGMXVault
 * @notice Interface for GMX Vault to query positions
 * @dev Used to read position data and validate state
 */
interface IGMXVault {
    /**
     * @notice Get position details
     * @param _account Position owner
     * @param _collateralToken Collateral token address
     * @param _indexToken Token being shorted/longed
     * @param _isLong true for long, false for short
     * @return size Position size in USD (30 decimals)
     * @return collateral Collateral amount in USD (30 decimals)
     * @return averagePrice Average entry price (30 decimals)
     * @return entryFundingRate Funding rate at entry
     * @return reserveAmount Reserved amount
     * @return realisedPnl Realised P&L
     * @return hasProfit Whether position has unrealised profit
     * @return lastIncreasedTime Last time position was increased
     */
    function getPosition(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    ) external view returns (
        uint256 size,
        uint256 collateral,
        uint256 averagePrice,
        uint256 entryFundingRate,
        uint256 reserveAmount,
        uint256 realisedPnl,
        bool hasProfit,
        uint256 lastIncreasedTime
    );

    /**
     * @notice Get position delta (unrealised P&L)
     * @return hasProfit Whether position is profitable
     * @return delta Absolute P&L amount
     */
    function getPositionDelta(
        address _account,
        address _collateralToken,
        address _indexToken,
        bool _isLong
    ) external view returns (bool hasProfit, uint256 delta);

    /**
     * @notice Get current price of token
     */
    function getMaxPrice(address _token) external view returns (uint256);
    
    /**
     * @notice Get minimum price of token
     */
    function getMinPrice(address _token) external view returns (uint256);
}
