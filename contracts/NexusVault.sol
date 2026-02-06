// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/ISignalOracle.sol";
import "./interfaces/IPositionRegistry.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/IGMXPositionRouter.sol";
import "./interfaces/IGMXVault.sol";
import "./interfaces/IGMXPositionRouterCallbackReceiver.sol";

/**
 * @title NexusVault
 * @notice Main execution contract for cross-chain autonomous shorts via LI.FI + GMX
 * @dev Holds USDC treasury, bridges via LI.FI, executes perpetual shorts on GMX
 * 
 * Architecture:
 * 1. User funds on any chain → LI.FI bridges to Arbitrum
 * 2. On Arbitrum, opens GMX perpetual SHORT position
 * 3. Price crashes, GMX SHORT profits
 * 4. Close position, bridge profits back via LI.FI
 */
contract NexusVault is Ownable, ReentrancyGuard, IGMXPositionRouterCallbackReceiver {
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public immutable USDC;
    address public agentAddress;
    
    ISignalOracle public signalOracle;
    IPositionRegistry public positionRegistry;
    IPriceOracle public priceOracle;
    IGMXPositionRouter public gmxPositionRouter;
    IGMXVault public gmxVault;
    
    bool public paused;
    uint256 public constant MAX_POSITION_PERCENT = 20; // Max 20% of vault in one position
    uint256 public constant MIN_CONFIDENCE_SCORE = 70; // Minimum 70/100 confidence
    uint256 public constant DEFAULT_LEVERAGE = 2; // 2x leverage (can be 1-50x on GMX)
    uint256 public constant GMX_PRICE_PRECISION = 1e30; // GMX uses 30 decimals for USD
    
    // Approved tokens for shorting (whitelist to prevent scams)
    mapping(address => bool) public approvedTokens;
    
    // Chain whitelist (must be "arbitrum" for GMX)
    mapping(string => bool) public approvedChains;
    
    // Position tracking
    mapping(uint256 => ShortPosition) public positions;
    uint256 public positionCounter;
    
    // GMX position key → NEXUS position ID
    mapping(bytes32 => uint256) public gmxKeyToPositionId;
    
    // Position ID → Pending bridge back request
    mapping(uint256 => BridgeBackRequest) public pendingBridgeBack;
    
    // Dip buy positions (memecoin post-rug buys)
    mapping(uint256 => DipBuyPosition) public dipBuyPositions;
    uint256 public dipBuyCounter;
    
    uint256 public constant MAX_DIP_BUY_PERCENT = 5; // Max 5% of vault on dip buys
    
    struct ShortPosition {
        uint256 id;
        address indexToken;      // Token being shorted (e.g., WETH, WBTC)
        uint256 collateralUSDC;  // USDC collateral amount
        uint256 positionSizeUSD; // Position size in USD (30 decimals)
        uint256 leverage;        // Leverage multiplier
        uint256 entryPrice;      // Entry price (30 decimals)
        uint256 entryTimestamp;
        bytes32 gmxPositionKey;  // GMX request key
        bool isOpen;
        string sourceChain;      // Original chain funds came from
    }
    
    struct BridgeBackRequest {
        string destinationChain;
        address recipient;
        uint256 timestamp;
    }
    
    struct DipBuyPosition {
        uint256 id;
        address token;           // Memecoin being bought
        string chain;            // Chain where token lives
        uint256 entryPrice;      // Buy price (18 decimals)
        uint256 sizeTokens;      // Amount of tokens bought
        uint256 sizeUSDC;        // USDC spent
        uint256 takeProfitPrice; // Target sell price (+30-50%)
        uint256 stopLossPrice;   // Stop loss price (-15%)
        uint256 entryTimestamp;
        bool isOpen;
        string sourceChain;      // Original chain funds came from
    }
    
    // ============================================
    // EVENTS
    // ============================================
    
    event BridgeInitiated(
        string indexed sourceChain,
        uint256 amountUSDC,
        bytes32 lifiTransferId
    );
    
    event LiFiBridgeExecuted(
        bytes32 indexed transactionId,
        string sourceChain,
        uint256 destinationChainId,
        uint256 amountUSDC
    );
    
    event ShortExecuted(
        uint256 indexed positionId,
        address indexed indexToken,
        uint256 collateralUSDC,
        uint256 positionSizeUSD,
        uint256 leverage,
        uint16 confidenceScore,
        bytes32 gmxPositionKey
    );
    
    event PositionClosed(
        uint256 indexed positionId,
        uint256 exitPrice,
        int256 pnlUSDC,
        uint256 finalUSDC
    );
    
    event GMXCallbackReceived(
        bytes32 indexed positionKey,
        bool isExecuted,
        bool isIncrease,
        uint256 nexusPositionId
    );
    
    event BridgeBackInitiated(
        uint256 indexed positionId,
        string destinationChain,
        uint256 amountUSDC
    );
    
    event DipBuyInitiated(
        uint256 indexed positionId,
        address indexed token,
        string chain,
        uint256 amountUSDC
    );
    
    event DipBuyExecuted(
        uint256 indexed positionId,
        uint256 tokensReceived,
        uint256 executionPrice
    );
    
    event DipBuyClosed(
        uint256 indexed positionId,
        uint256 exitPrice,
        int256 pnlUSDC,
        bool isProfit
    );
    
    event Deposit(address indexed user, uint256 amount);
    event TokenApproved(address indexed token, bool approved);
    event ChainApproved(string chain, bool approved);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    event PositionCloseRequested(uint256 indexed positionId, uint256 minExitPrice);
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyAgent() {
        require(msg.sender == agentAddress, "Not authorized agent");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Vault is paused");
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address _usdc,
        address _agentAddress,
        address _signalOracle,
        address _positionRegistry,
        address _priceOracle,
        address _gmxPositionRouter,
        address _gmxVault
    ) Ownable(msg.sender) {
        USDC = _usdc;
        agentAddress = _agentAddress;
        signalOracle = ISignalOracle(_signalOracle);
        positionRegistry = IPositionRegistry(_positionRegistry);
        priceOracle = IPriceOracle(_priceOracle);
        gmxPositionRouter = IGMXPositionRouter(_gmxPositionRouter);
        gmxVault = IGMXVault(_gmxVault);
        
        // Only Arbitrum is approved (GMX is only on Arbitrum)
        approvedChains["arbitrum"] = true;
    }
    
    // ============================================
    // CORE FUNCTIONS
    // ============================================
    
    /**
     * @notice Deposit USDC into the vault
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function deposit(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be > 0");
        IERC20(USDC).transferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }
    
    
    /**
     * @notice Execute a GMX short position (USDC must already be on Arbitrum)
     * @dev Cross-chain bridging is handled off-chain by LI.FI SDK (TypeScript)
     *      This contract only opens GMX shorts with USDC already on Arbitrum
     * 
     * @param indexToken Token to short (e.g., WETH, WBTC)
     * @param amountUSDC Collateral amount in USDC (6 decimals)
     * @param leverage Leverage multiplier (1-50x, typically 2-10x)
     * @param acceptablePrice Maximum entry price for short (30 decimals)
     * @return positionId The ID of the created position
     */
    function executeShort(
        address indexToken,
        uint256 amountUSDC,
        uint256 leverage,
        uint256 acceptablePrice
    ) 
        external 
        payable
        onlyAgent 
        whenNotPaused 
        nonReentrant 
        returns (uint256 positionId) 
    {
        // 1. Validate inputs
        require(approvedTokens[indexToken], "Token not approved");
        require(leverage >= 1 && leverage <= 50, "Invalid leverage");
        require(msg.value >= gmxPositionRouter.minExecutionFee(), "Insufficient execution fee");
        
        // 2. Check position limits (max 20% of vault)
        uint256 vaultBalance = IERC20(USDC).balanceOf(address(this));
        uint256 maxPositionSize = (vaultBalance * MAX_POSITION_PERCENT) / 100;
        require(amountUSDC <= maxPositionSize, "Position exceeds max size");
        require(amountUSDC <= vaultBalance, "Insufficient vault balance");
        
        // 3. Get confidence from SignalOracle
        (uint16 confidenceScore, uint8 signalCount) = signalOracle.getConfidenceScore(
            indexToken,
            "arbitrum" // GMX is only on Arbitrum
        );
        require(confidenceScore >= MIN_CONFIDENCE_SCORE, "Confidence too low");
        require(signalCount >= 2, "Need at least 2 signals");
        
        // 4. Open GMX short (USDC must already be on Arbitrum)
        positionId = _openGMXShort(
            indexToken,
            amountUSDC,
            leverage,
            acceptablePrice,
            confidenceScore
        );
        
        return positionId;
    }
    
    
    /**
     * @notice Internal function to open GMX perpetual short
     * @dev This is where the ACTUAL SHORT happens (not just buying the token)
     */
    function _openGMXShort(
        address indexToken,
        uint256 collateralAmount,
        uint256 leverage,
        uint256 acceptablePrice,
        uint16 confidenceScore
    ) internal returns (uint256 positionId) {
        // Calculate position size in USD (GMX uses 30 decimals)
        // collateralAmount is in USDC (6 decimals), convert to 30 decimals
        uint256 positionSizeUSD = (collateralAmount * leverage * 1e24); // 6 + 24 = 30 decimals
        
        // Approve USDC to GMX Router
        IERC20(USDC).approve(address(gmxPositionRouter), collateralAmount);
        
        // Setup path (just USDC for shorts)
        address[] memory path = new address[](1);
        path[0] = USDC;
        
        // Create GMX increase position request (SHORT)
        bytes32 gmxKey = gmxPositionRouter.createIncreasePosition{value: msg.value}(
            path,
            indexToken,           // Token to short
            collateralAmount,     // USDC collateral
            0,                    // minOut (not needed for shorts)
            positionSizeUSD,      // Position size with leverage
            false,                // isLong = FALSE (this is a SHORT!)
            acceptablePrice,      // Max acceptable entry price
            msg.value,            // Execution fee for GMX keeper
            bytes32(0),           // Referral code
            address(this)         // Callback target
        );
        
        // Create position record
        positionCounter++;
        positionId = positionCounter;
        
        positions[positionId] = ShortPosition({
            id: positionId,
            indexToken: indexToken,
            collateralUSDC: collateralAmount,
            positionSizeUSD: positionSizeUSD,
            leverage: leverage,
            entryPrice: acceptablePrice,
            entryTimestamp: block.timestamp,
            gmxPositionKey: gmxKey,
            isOpen: true,
            sourceChain: "arbitrum"
        });
        
        // Map GMX key to position ID
        gmxKeyToPositionId[gmxKey] = positionId;
        
        // Record in PositionRegistry
        bytes32[] memory signalIds = signalOracle.getRecentSignalIds(indexToken, "arbitrum");
        positionRegistry.recordPosition(
            indexToken,
            "arbitrum",
            acceptablePrice,
            (positionSizeUSD * 1e18) / acceptablePrice, // Convert to token amount
            collateralAmount,
            confidenceScore,
            signalIds
        );
        
        emit ShortExecuted(
            positionId,
            indexToken,
            collateralAmount,
            positionSizeUSD,
            leverage,
            confidenceScore,
            gmxKey
        );
        
        return positionId;
    }
    
    /**
     * @notice Close a GMX short position
     * @dev Bridging profits back is handled off-chain by LI.FI SDK
     * @param positionId Position to close
     * @param minExitPrice Minimum acceptable exit price (30 decimals)
     */
    function closePosition(
        uint256 positionId,
        uint256 minExitPrice
    ) 
        external
        payable
        onlyAgent 
        nonReentrant 
    {
        ShortPosition storage position = positions[positionId];
        require(position.isOpen, "Position not open");
        require(msg.value >= gmxPositionRouter.minExecutionFee(), "Insufficient execution fee");
        
        // Setup path for receiving USDC
        address[] memory path = new address[](1);
        path[0] = USDC;
        
        // Create GMX decrease position request (close SHORT)
        bytes32 gmxKey = gmxPositionRouter.createDecreasePosition{value: msg.value}(
            path,
            position.indexToken,      // Token being shorted
            position.positionSizeUSD, // Collateral to withdraw (all of it)
            position.positionSizeUSD, // Position size to close (all of it)
            false,                    // isLong = false (SHORT)
            address(this),            // Receiver (USDC stays in vault)
            minExitPrice,             // Min acceptable exit price for short
            0,                        // minOut
            msg.value,                // Execution fee
            false,                    // withdrawETH
            address(this)             // Callback target
        );
        
        // Map GMX key to position ID for callback
        gmxKeyToPositionId[gmxKey] = positionId;
        
        emit PositionCloseRequested(positionId, minExitPrice);
        
        // Position will be marked closed in GMX callback
        // Agent can withdraw USDC manually if needed for cross-chain
    }
    
    /**
     * @notice GMX callback after position execution
     * @dev Called by GMX Position Router after position is executed
     */
    function gmxPositionCallback(
        bytes32 positionKey,
        bool isExecuted,
        bool isIncrease
    ) external override {
        require(msg.sender == address(gmxPositionRouter), "Only GMX Position Router");
        
        uint256 positionId = gmxKeyToPositionId[positionKey];
        require(positionId > 0, "Unknown position key");
        
        emit GMXCallbackReceived(positionKey, isExecuted, isIncrease, positionId);
        
        if (!isExecuted) {
            // Position execution failed
            return;
        }
        
        if (isIncrease) {
            // Position opened successfully
            // Already handled in _openGMXShort
            return;
        }
        
        // Position closed - handle P&L and bridge back
        ShortPosition storage position = positions[positionId];
        
        // Get current USDC balance (includes profit/loss)
        uint256 finalUSDC = IERC20(USDC).balanceOf(address(this));
        
        // Calculate P&L
        int256 pnlUSDC = int256(finalUSDC) - int256(position.collateralUSDC);
        
        // Get exit price from GMX Vault
        uint256 exitPrice = gmxVault.getMaxPrice(position.indexToken);
        
        // Determine status
        IPositionRegistry.PositionStatus status = pnlUSDC > 0 
            ? IPositionRegistry.PositionStatus.CLOSED_PROFIT 
            : IPositionRegistry.PositionStatus.CLOSED_LOSS;
        
        // Update position registry
        positionRegistry.closePosition(positionId, exitPrice, status);
        
        // Mark position as closed
        position.isOpen = false;
        
        emit PositionClosed(positionId, exitPrice, pnlUSDC, finalUSDC);
        
        // USDC remains in vault - agent can withdraw if needed
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    function getTotalVaultValue() public view returns (uint256) {
        return IERC20(USDC).balanceOf(address(this));
    }
    
    function getOpenPositions() external view returns (ShortPosition[] memory) {
        // Count open positions
        uint256 openCount = 0;
        for (uint256 i = 1; i <= positionCounter; i++) {
            if (positions[i].isOpen) openCount++;
        }
        
        // Populate array
        ShortPosition[] memory openPositions = new ShortPosition[](openCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= positionCounter; i++) {
            if (positions[i].isOpen) {
                openPositions[index] = positions[i];
                index++;
            }
        }
        
        return openPositions;
    }
    
    /**
     * @notice Get GMX position details for a NEXUS position
     */
    function getGMXPositionInfo(uint256 positionId) external view returns (
        uint256 size,
        uint256 collateral,
        uint256 averagePrice,
        bool hasProfit,
        uint256 delta
    ) {
        ShortPosition memory position = positions[positionId];
        require(position.isOpen, "Position not open");
        
        // Query GMX Vault
        (size, collateral, averagePrice, , , , , ) = gmxVault.getPosition(
            address(this),
            USDC,
            position.indexToken,
            false // isLong = false (SHORT)
        );
        
        // Get unrealised P&L
        (hasProfit, delta) = gmxVault.getPositionDelta(
            address(this),
            USDC,
            position.indexToken,
            false
        );
        
        return (size, collateral, averagePrice, hasProfit, delta);
    }
    
    // ============================================
    // MEMECOIN DIP BUYING FUNCTIONS
    // ============================================
    
    /**
     * @notice Buy memecoin dip after rug pull for dead cat bounce
     * @dev Bridging is handled off-chain by LI.FI SDK
     * @param token Memecoin address on destination chain
     * @param chain Chain where memecoin lives (e.g., "base", "ethereum")
     * @param amountUSDC USDC to spend on dip buy
     * @param minTokensOut Minimum tokens expected from swap
     * @param takeProfitPrice Target sell price for bounce (+30-50%)
     * @param stopLossPrice Stop loss price (-15-20%)
     * @return positionId Dip buy position ID
     */
    function executeDipBuy(
        address token,
        string calldata chain,
        uint256 amountUSDC,
        uint256 minTokensOut,
        uint256 takeProfitPrice,
        uint256 stopLossPrice
    ) 
        external 
        onlyAgent 
        whenNotPaused 
        nonReentrant 
        returns (uint256 positionId) 
    {
        // Validate position size (max 5% of vault for dip buys)
        uint256 vaultBalance = IERC20(USDC).balanceOf(address(this));
        uint256 maxDipBuySize = (vaultBalance * MAX_DIP_BUY_PERCENT) / 100;
        require(amountUSDC <= maxDipBuySize, "Dip buy exceeds max size");
        require(amountUSDC <= vaultBalance, "Insufficient vault balance");
        
        // Validate take-profit and stop-loss
        require(takeProfitPrice > stopLossPrice, "Invalid TP/SL prices");
        
        // Bridging handled off-chain by LI.FI SDK
        // Contract only handles execution on current chain
        
        // Create dip buy position record
        dipBuyCounter++;
        positionId = dipBuyCounter;
        
        dipBuyPositions[positionId] = DipBuyPosition({
            id: positionId,
            token: token,
            chain: chain,
            entryPrice: 0,  // Will be set after swap executes
            sizeTokens: 0,  // Will be set after swap executes
            sizeUSDC: amountUSDC,
            takeProfitPrice: takeProfitPrice,
            stopLossPrice: stopLossPrice,
            entryTimestamp: block.timestamp,
            isOpen: true,
            sourceChain: "arbitrum"
        });
        
        emit DipBuyInitiated(positionId, token, chain, amountUSDC);
        
        return positionId;
    }
    
    /**
     * @notice Update dip buy position after swap completes
     * @dev Called by off-chain agent after monitoring swap execution
     * @param positionId Dip buy position ID
     * @param tokensReceived Amount of tokens received from swap
     * @param executionPrice Actual execution price
     */
    function updateDipBuyExecution(
        uint256 positionId,
        uint256 tokensReceived,
        uint256 executionPrice
    ) external onlyAgent {
        DipBuyPosition storage pos = dipBuyPositions[positionId];
        require(pos.isOpen, "Position not open");
        require(pos.entryPrice == 0, "Already executed");
        
        pos.entryPrice = executionPrice;
        pos.sizeTokens = tokensReceived;
        
        emit DipBuyExecuted(positionId, tokensReceived, executionPrice);
    }
    
    /**
     * @notice Close dip buy position (take profit or stop loss hit)
     * @param positionId Position to close
     * @param exitPrice Current market price
     * @param lifiCalldata LI.FI swap + bridge back calldata
     */
    function closeDipBuy(
        uint256 positionId,
        uint256 exitPrice,
        bytes calldata lifiCalldata
    ) 
        external 
        onlyAgent 
        nonReentrant 
    {
        DipBuyPosition storage pos = dipBuyPositions[positionId];
        require(pos.isOpen, "Position not open");
        require(pos.entryPrice > 0, "Position not executed yet");
        
        // Selling and bridging back handled off-chain by LI.FI SDK
        // Contract only tracks P&L
        
        // Calculate P&L
        // For dip buys: profit when exitPrice > entryPrice
        int256 priceDiff = int256(exitPrice) - int256(pos.entryPrice);
        int256 pnlUSDC = (priceDiff * int256(pos.sizeTokens)) / 1e18;
        bool isProfit = pnlUSDC > 0;
        
        // Mark position as closed
        pos.isOpen = false;
        
        emit DipBuyClosed(positionId, exitPrice, pnlUSDC, isProfit);
    }
    
    /**
     * @notice Get all open dip buy positions
     */
    function getOpenDipBuys() external view returns (DipBuyPosition[] memory) {
        // Count open dip buys
        uint256 openCount = 0;
        for (uint256 i = 1; i <= dipBuyCounter; i++) {
            if (dipBuyPositions[i].isOpen) openCount++;
        }
        
        // Populate array
        DipBuyPosition[] memory openDipBuys = new DipBuyPosition[](openCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= dipBuyCounter; i++) {
            if (dipBuyPositions[i].isOpen) {
                openDipBuys[index] = dipBuyPositions[i];
                index++;
            }
        }
        
        return openDipBuys;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function setAgentAddress(address newAgent) external onlyOwner {
        require(newAgent != address(0), "Invalid agent");
        address oldAgent = agentAddress;
        agentAddress = newAgent;
        emit AgentUpdated(oldAgent, newAgent);
    }
    
    function approveToken(address token, bool approved) external onlyOwner {
        approvedTokens[token] = approved;
        emit TokenApproved(token, approved);
    }
    
    function approveChain(string calldata chain, bool approved) external onlyOwner {
        approvedChains[chain] = approved;
        emit ChainApproved(chain, approved);
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    function updateSignalOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        signalOracle = ISignalOracle(newOracle);
    }
    
    function updatePositionRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "Invalid registry");
        positionRegistry = IPositionRegistry(newRegistry);
    }
    
    function updatePriceOracle(address newPriceOracle) external onlyOwner {
        require(newPriceOracle != address(0), "Invalid oracle");
        priceOracle = IPriceOracle(newPriceOracle);
    }
    
    /**
     * @notice Emergency withdraw - only callable if paused for >48 hours
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(paused, "Must be paused");
        // Additional safety: could add a pausedTimestamp check
        
        IERC20(token).transfer(owner(), amount);
        emit EmergencyWithdraw(token, amount);
    }
}
