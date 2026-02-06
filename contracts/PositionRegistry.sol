// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PositionRegistry
 * @notice On-chain ledger of all shorts with P&L tracking
 * @dev Provides transparent, auditable performance metrics
 */
contract PositionRegistry is Ownable {
    // ============================================
    // ENUMS & STRUCTS
    // ============================================
    
    enum PositionStatus {
        OPEN,
        CLOSED_PROFIT,
        CLOSED_LOSS,
        CLOSED_STOP_LOSS,
        LIQUIDATED
    }
    
    struct Position {
        uint256 id;
        address tokenAddress;
        string chain;
        
        // Entry data
        uint256 entryPrice;
        uint256 entryTimestamp;
        uint256 sizeTokens;
        uint256 sizeUSDC;
        
        // Exit data
        uint256 exitPrice;
        uint256 exitTimestamp;
        int256 pnlUSDC;
        
        // Metadata
        uint16 confidenceScore;
        bytes32[] triggeringSignals;
        
        PositionStatus status;
    }
    
    struct DipBuyPosition {
        uint256 id;
        address tokenAddress;
        string chain;
        
        // Entry data
        uint256 entryPrice;
        uint256 entryTimestamp;
        uint256 sizeTokens;
        uint256 sizeUSDC;
        
        // Exit data
        uint256 exitPrice;
        uint256 exitTimestamp;
        int256 pnlUSDC;
        
        // Targets
        uint256 takeProfitPrice;
        uint256 stopLossPrice;
        
        // Metadata
        uint16 confidenceScore;
        
        PositionStatus status;
    }
    
    struct PerformanceMetrics {
        uint256 totalPositions;
        uint256 closedPositions;
        uint256 profitablePositions;
        int256 totalPnLUSDC;
        uint256 totalVolumeUSDC;
        
        // Calculated fields
        uint16 winRatePercent; // profitablePositions / closedPositions * 10000
        int256 averagePnL;
        int256 largestWin;
        int256 largestLoss;
    }
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public nexusVault;
    
    mapping(uint256 => Position) public positions;
    uint256 public positionIdCounter;
    
    mapping(uint256 => DipBuyPosition) public dipBuyPositions;
    uint256 public dipBuyIdCounter;
    
    PerformanceMetrics public metrics;
    PerformanceMetrics public dipBuyMetrics;
    
    // Chain-specific metrics
    mapping(string => PerformanceMetrics) public chainMetrics;
    
    // Signal type performance tracking
    mapping(uint8 => PerformanceMetrics) public signalTypeMetrics;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event PositionOpened(
        uint256 indexed positionId,
        address indexed token,
        string chain,
        uint256 sizeUSDC,
        uint16 confidenceScore
    );
    
    event PositionClosed(
        uint256 indexed positionId,
        uint256 exitPrice,
        int256 pnlUSDC,
        PositionStatus status
    );
    
    event PerformanceUpdated(
        uint16 winRate,
        int256 totalPnL,
        uint256 totalPositions
    );
    
    event DipBuyOpened(
        uint256 indexed positionId,
        address indexed token,
        string chain,
        uint256 sizeUSDC,
        uint256 takeProfitPrice,
        uint256 stopLossPrice
    );
    
    event DipBuyClosed(
        uint256 indexed positionId,
        uint256 exitPrice,
        int256 pnlUSDC,
        PositionStatus status
    );
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyVault() {
        require(msg.sender == nexusVault, "Not authorized vault");
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor() Ownable(msg.sender) {
        // NexusVault will be set after deployment via setNexusVault()
    }
    
    // ============================================
    // CORE FUNCTIONS
    // ============================================
    
    /**
     * @notice Record a new short position
     */
    function recordPosition(
        address tokenAddress,
        string calldata chain,
        uint256 entryPrice,
        uint256 sizeTokens,
        uint256 sizeUSDC,
        uint16 confidenceScore,
        bytes32[] calldata triggeringSignals
    ) 
        external 
        onlyVault 
        returns (uint256 positionId) 
    {
        positionIdCounter++;
        positionId = positionIdCounter;
        
        positions[positionId] = Position({
            id: positionId,
            tokenAddress: tokenAddress,
            chain: chain,
            entryPrice: entryPrice,
            entryTimestamp: block.timestamp,
            sizeTokens: sizeTokens,
            sizeUSDC: sizeUSDC,
            exitPrice: 0,
            exitTimestamp: 0,
            pnlUSDC: 0,
            confidenceScore: confidenceScore,
            triggeringSignals: triggeringSignals,
            status: PositionStatus.OPEN
        });
        
        // Update metrics
        metrics.totalPositions++;
        metrics.totalVolumeUSDC += sizeUSDC;
        
        chainMetrics[chain].totalPositions++;
        chainMetrics[chain].totalVolumeUSDC += sizeUSDC;
        
        emit PositionOpened(
            positionId,
            tokenAddress,
            chain,
            sizeUSDC,
            confidenceScore
        );
        
        return positionId;
    }
    
    /**
     * @notice Close a position and calculate P&L
     */
    function closePosition(
        uint256 positionId,
        uint256 exitPrice,
        PositionStatus finalStatus
    ) 
        external 
        onlyVault 
    {
        Position storage pos = positions[positionId];
        require(pos.status == PositionStatus.OPEN, "Position not open");
        require(
            finalStatus != PositionStatus.OPEN,
            "Invalid final status"
        );
        
        pos.exitPrice = exitPrice;
        pos.exitTimestamp = block.timestamp;
        pos.status = finalStatus;
        
        // Calculate P&L
        // Short P&L = (entryPrice - exitPrice) * sizeTokens / 1e18
        int256 priceChange = int256(pos.entryPrice) - int256(exitPrice);
        pos.pnlUSDC = (priceChange * int256(pos.sizeTokens)) / 1e18;
        
        // Update global metrics
        updatePerformanceMetrics(pos.pnlUSDC, finalStatus);
        
        // Update chain-specific metrics
        updateChainMetrics(pos.chain, pos.pnlUSDC, finalStatus);
        
        emit PositionClosed(positionId, exitPrice, pos.pnlUSDC, finalStatus);
        
        emit PerformanceUpdated(
            metrics.winRatePercent,
            metrics.totalPnLUSDC,
            metrics.totalPositions
        );
    }
    
    /**
     * @notice Record a new dip buy position
     */
    function recordDipBuy(
        address tokenAddress,
        string calldata chain,
        uint256 entryPrice,
        uint256 sizeTokens,
        uint256 sizeUSDC,
        uint256 takeProfitPrice,
        uint256 stopLossPrice,
        uint16 confidenceScore
    ) 
        external 
        onlyVault 
        returns (uint256 positionId) 
    {
        dipBuyIdCounter++;
        positionId = dipBuyIdCounter;
        
        dipBuyPositions[positionId] = DipBuyPosition({
            id: positionId,
            tokenAddress: tokenAddress,
            chain: chain,
            entryPrice: entryPrice,
            entryTimestamp: block.timestamp,
            sizeTokens: sizeTokens,
            sizeUSDC: sizeUSDC,
            exitPrice: 0,
            exitTimestamp: 0,
            pnlUSDC: 0,
            takeProfitPrice: takeProfitPrice,
            stopLossPrice: stopLossPrice,
            confidenceScore: confidenceScore,
            status: PositionStatus.OPEN
        });
        
        // Update metrics
        dipBuyMetrics.totalPositions++;
        dipBuyMetrics.totalVolumeUSDC += sizeUSDC;
        
        emit DipBuyOpened(
            positionId,
            tokenAddress,
            chain,
            sizeUSDC,
            takeProfitPrice,
            stopLossPrice
        );
        
        return positionId;
    }
    
    /**
     * @notice Close a dip buy position
     */
    function closeDipBuy(
        uint256 positionId,
        uint256 exitPrice,
        PositionStatus finalStatus
    ) 
        external 
        onlyVault 
    {
        DipBuyPosition storage pos = dipBuyPositions[positionId];
        require(pos.status == PositionStatus.OPEN, "Position not open");
        require(
            finalStatus != PositionStatus.OPEN,
            "Invalid final status"
        );
        
        pos.exitPrice = exitPrice;
        pos.exitTimestamp = block.timestamp;
        pos.status = finalStatus;
        
        // Calculate P&L for dip buys (profit when exitPrice > entryPrice)
        int256 priceChange = int256(exitPrice) - int256(pos.entryPrice);
        pos.pnlUSDC = (priceChange * int256(pos.sizeTokens)) / 1e18;
        
        // Update dip buy metrics
        updateDipBuyMetrics(pos.pnlUSDC, finalStatus);
        
        emit DipBuyClosed(positionId, exitPrice, pos.pnlUSDC, finalStatus);
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    function updatePerformanceMetrics(
        int256 pnl,
        PositionStatus status
    ) 
        internal 
    {
        metrics.closedPositions++;
        metrics.totalPnLUSDC += pnl;
        
        if (pnl > 0) {
            metrics.profitablePositions++;
            if (pnl > metrics.largestWin) {
                metrics.largestWin = pnl;
            }
        } else if (pnl < 0) {
            if (pnl < metrics.largestLoss) {
                metrics.largestLoss = pnl;
            }
        }
        
        // Recalculate win rate (in basis points: 10000 = 100%)
        if (metrics.closedPositions > 0) {
            metrics.winRatePercent = uint16(
                (metrics.profitablePositions * 10000) / metrics.closedPositions
            );
            
            // Recalculate average P&L
            metrics.averagePnL = metrics.totalPnLUSDC / int256(metrics.closedPositions);
        }
    }
    
    function updateChainMetrics(
        string memory chain,
        int256 pnl,
        PositionStatus status
    ) 
        internal 
    {
        PerformanceMetrics storage chainMetric = chainMetrics[chain];
        
        chainMetric.closedPositions++;
        chainMetric.totalPnLUSDC += pnl;
        
        if (pnl > 0) {
            chainMetric.profitablePositions++;
        }
        
        if (chainMetric.closedPositions > 0) {
            chainMetric.winRatePercent = uint16(
                (chainMetric.profitablePositions * 10000) / chainMetric.closedPositions
            );
            chainMetric.averagePnL = chainMetric.totalPnLUSDC / int256(chainMetric.closedPositions);
        }
    }
    
    function updateDipBuyMetrics(
        int256 pnl,
        PositionStatus status
    ) 
        internal 
    {
        dipBuyMetrics.closedPositions++;
        dipBuyMetrics.totalPnLUSDC += pnl;
        
        if (pnl > 0) {
            dipBuyMetrics.profitablePositions++;
            if (pnl > dipBuyMetrics.largestWin) {
                dipBuyMetrics.largestWin = pnl;
            }
        } else if (pnl < 0) {
            if (pnl < dipBuyMetrics.largestLoss) {
                dipBuyMetrics.largestLoss = pnl;
            }
        }
        
        // Recalculate win rate
        if (dipBuyMetrics.closedPositions > 0) {
            dipBuyMetrics.winRatePercent = uint16(
                (dipBuyMetrics.profitablePositions * 10000) / dipBuyMetrics.closedPositions
            );
            
            dipBuyMetrics.averagePnL = dipBuyMetrics.totalPnLUSDC / int256(dipBuyMetrics.closedPositions);
        }
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function getPosition(uint256 positionId) 
        external 
        view 
        returns (Position memory) 
    {
        return positions[positionId];
    }
    
    function getOpenPositions() 
        external 
        view 
        returns (Position[] memory) 
    {
        uint256 openCount = 0;
        for (uint256 i = 1; i <= positionIdCounter; i++) {
            if (positions[i].status == PositionStatus.OPEN) {
                openCount++;
            }
        }
        
        Position[] memory openPositions = new Position[](openCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= positionIdCounter; i++) {
            if (positions[i].status == PositionStatus.OPEN) {
                openPositions[index] = positions[i];
                index++;
            }
        }
        
        return openPositions;
    }
    
    function getPositionsByChain(string calldata chain) 
        external 
        view 
        returns (Position[] memory) 
    {
        uint256 chainCount = 0;
        for (uint256 i = 1; i <= positionIdCounter; i++) {
            if (keccak256(bytes(positions[i].chain)) == keccak256(bytes(chain))) {
                chainCount++;
            }
        }
        
        Position[] memory chainPositions = new Position[](chainCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= positionIdCounter; i++) {
            if (keccak256(bytes(positions[i].chain)) == keccak256(bytes(chain))) {
                chainPositions[index] = positions[i];
                index++;
            }
        }
        
        return chainPositions;
    }
    
    function getTopPerformers(uint256 limit) 
        external 
        view 
        returns (Position[] memory) 
    {
        // Simple implementation - would use sorting in production
        uint256 resultSize = limit > positionIdCounter ? positionIdCounter : limit;
        Position[] memory topPositions = new Position[](resultSize);
        
        // This is a simplified version
        // In production, implement proper sorting by pnlUSDC
        uint256 added = 0;
        for (uint256 i = positionIdCounter; i >= 1 && added < limit; i--) {
            if (positions[i].status != PositionStatus.OPEN && positions[i].pnlUSDC > 0) {
                topPositions[added] = positions[i];
                added++;
            }
        }
        
        return topPositions;
    }
    
    function getPerformanceMetrics() 
        external 
        view 
        returns (PerformanceMetrics memory) 
    {
        return metrics;
    }
    
    function getChainPerformance(string calldata chain) 
        external 
        view 
        returns (PerformanceMetrics memory) 
    {
        return chainMetrics[chain];
    }
    
    function getDipBuyPosition(uint256 positionId) 
        external 
        view 
        returns (DipBuyPosition memory) 
    {
        return dipBuyPositions[positionId];
    }
    
    function getOpenDipBuys() 
        external 
        view 
        returns (DipBuyPosition[] memory) 
    {
        uint256 openCount = 0;
        for (uint256 i = 1; i <= dipBuyIdCounter; i++) {
            if (dipBuyPositions[i].status == PositionStatus.OPEN) {
                openCount++;
            }
        }
        
        DipBuyPosition[] memory openDipBuys = new DipBuyPosition[](openCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= dipBuyIdCounter; i++) {
            if (dipBuyPositions[i].status == PositionStatus.OPEN) {
                openDipBuys[index] = dipBuyPositions[i];
                index++;
            }
        }
        
        return openDipBuys;
    }
    
    function getDipBuyMetrics() 
        external 
        view 
        returns (PerformanceMetrics memory) 
    {
        return dipBuyMetrics;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function setNexusVault(address _nexusVault) external onlyOwner {
        require(_nexusVault != address(0), "Invalid vault");
        nexusVault = _nexusVault;
    }
}
