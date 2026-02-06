// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IGMXPositionRouter
 * @notice Interface for GMX Position Router for opening/closing leveraged positions
 * @dev Used to execute perpetual shorts on GMX
 */
interface IGMXPositionRouter {
    /**
     * @notice Create an increase position request (open or add to position)
     * @param _path Token path for collateral (e.g., [USDC])
     * @param _indexToken Token to long/short (e.g., WETH, WBTC)
     * @param _amountIn Collateral amount
     * @param _minOut Minimum tokens out (0 for shorts)
     * @param _sizeDelta Position size increase in USD (30 decimals)
     * @param _isLong true for long, false for short
     * @param _acceptablePrice Max price for longs, min price for shorts (30 decimals)
     * @param _executionFee Fee paid to keeper (msg.value)
     * @param _referralCode Referral code for fee sharing
     * @param _callbackTarget Address to call after execution
     * @return requestKey Unique identifier for this position request
     */
    function createIncreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _amountIn,
        uint256 _minOut,
        uint256 _sizeDelta,
        bool _isLong,
        uint256 _acceptablePrice,
        uint256 _executionFee,
        bytes32 _referralCode,
        address _callbackTarget
    ) external payable returns (bytes32 requestKey);

    /**
     * @notice Create a decrease position request (close or reduce position)
     * @param _path Token path for receiving collateral (e.g., [USDC])
     * @param _indexToken Token being shorted/longed
     * @param _collateralDelta Collateral to withdraw in USD (30 decimals)
     * @param _sizeDelta Position size to decrease in USD (30 decimals)
     * @param _isLong true for long, false for short
     * @param _receiver Address to receive withdrawn collateral
     * @param _acceptablePrice Min price for longs, max price for shorts (30 decimals)
     * @param _minOut Minimum tokens to receive
     * @param _executionFee Fee paid to keeper (msg.value)
     * @param _withdrawETH Whether to withdraw as ETH instead of WETH
     * @param _callbackTarget Address to call after execution
     * @return requestKey Unique identifier for this position request
     */
    function createDecreasePosition(
        address[] memory _path,
        address _indexToken,
        uint256 _collateralDelta,
        uint256 _sizeDelta,
        bool _isLong,
        address _receiver,
        uint256 _acceptablePrice,
        uint256 _minOut,
        uint256 _executionFee,
        bool _withdrawETH,
        address _callbackTarget
    ) external payable returns (bytes32 requestKey);

    /**
     * @notice Get minimum execution fee required
     */
    function minExecutionFee() external view returns (uint256);

    /**
     * @notice Get position request by key
     */
    function increasePositionRequests(bytes32 key) external view returns (
        address account,
        address[] memory path,
        address indexToken,
        uint256 amountIn,
        uint256 minOut,
        uint256 sizeDelta,
        bool isLong,
        uint256 acceptablePrice,
        uint256 executionFee,
        uint256 blockNumber,
        uint256 blockTime,
        bool hasCollateralInETH,
        address callbackTarget
    );

    /**
     * @notice Get decrease position request by key
     */
    function decreasePositionRequests(bytes32 key) external view returns (
        address account,
        address[] memory path,
        address indexToken,
        uint256 collateralDelta,
        uint256 sizeDelta,
        bool isLong,
        address receiver,
        uint256 acceptablePrice,
        uint256 minOut,
        uint256 executionFee,
        uint256 blockNumber,
        uint256 blockTime,
        bool withdrawETH,
        address callbackTarget
    );

    /**
     * @notice Cancel an increase position request
     */
    function cancelIncreasePosition(
        bytes32 _key,
        address payable _executionFeeReceiver
    ) external returns (bool);

    /**
     * @notice Cancel a decrease position request
     */
    function cancelDecreasePosition(
        bytes32 _key,
        address payable _executionFeeReceiver
    ) external returns (bool);
}
