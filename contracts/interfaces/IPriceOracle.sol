// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPriceOracle {
    function getPrice(
        address tokenAddress,
        string calldata chain
    ) external view returns (uint256 price);
}
