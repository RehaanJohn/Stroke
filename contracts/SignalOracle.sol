// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SignalOracle
 * @notice Publishes and aggregates AI agent signals on-chain
 * @dev Provides verifiable, auditable record of all signals that trigger shorts
 */
contract SignalOracle is Ownable {
    // ============================================
    // ENUMS & STRUCTS
    // ============================================
    
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
    
    struct Signal {
        SignalType signalType;
        address tokenAddress;
        string chain;
        uint8 score; // 0-100
        uint64 timestamp;
        bytes32 metadataHash; // IPFS hash of full metadata
        address publisher;
    }
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    address public publisherAddress; // Off-chain AI agent
    address public nexusVault;
    
    // tokenKey => array of signals
    // tokenKey = keccak256(abi.encodePacked(tokenAddress, chain))
    mapping(bytes32 => Signal[]) public signalHistory;
    
    // Global signal counter for unique IDs
    mapping(bytes32 => bytes32[]) public signalIds;
    uint256 public globalSignalCounter;
    
    uint256 public constant SIGNAL_EXPIRY = 24 hours;
    uint256 public constant SIGNAL_CLEANUP_WINDOW = 7 days;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event SignalPublished(
        address indexed token,
        string chain,
        SignalType signalType,
        uint8 score,
        uint64 timestamp,
        bytes32 indexed signalId
    );
    
    event SignalBatchPublished(
        uint256 count,
        uint64 timestamp
    );
    
    event SignalsAggregated(
        address indexed token,
        string chain,
        uint16 totalScore,
        uint8 signalCount
    );
    
    event PublisherUpdated(address indexed oldPublisher, address indexed newPublisher);
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyPublisher() {
        require(msg.sender == publisherAddress, "Not authorized publisher");
        _;
    }
    
    modifier onlyVault() {
        require(msg.sender == nexusVault, "Not authorized vault");
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(address _publisherAddress) {
        publisherAddress = _publisherAddress;
    }
    
    // ============================================
    // CORE FUNCTIONS
    // ============================================
    
    /**
     * @notice Publish a single signal
     * @param signalType Type of signal
     * @param tokenAddress Token being signaled
     * @param chain Chain where token exists
     * @param score Signal strength (0-100)
     * @param metadataHash IPFS hash of full signal data
     */
    function publishSignal(
        SignalType signalType,
        address tokenAddress,
        string calldata chain,
        uint8 score,
        bytes32 metadataHash
    ) 
        external 
        onlyPublisher 
        returns (bytes32 signalId)
    {
        require(score <= 100, "Invalid score");
        
        bytes32 tokenKey = keccak256(abi.encodePacked(tokenAddress, chain));
        
        Signal memory newSignal = Signal({
            signalType: signalType,
            tokenAddress: tokenAddress,
            chain: chain,
            score: score,
            timestamp: uint64(block.timestamp),
            metadataHash: metadataHash,
            publisher: msg.sender
        });
        
        signalHistory[tokenKey].push(newSignal);
        
        // Generate unique signal ID
        globalSignalCounter++;
        signalId = keccak256(abi.encodePacked(
            globalSignalCounter,
            tokenAddress,
            chain,
            block.timestamp
        ));
        signalIds[tokenKey].push(signalId);
        
        emit SignalPublished(
            tokenAddress,
            chain,
            signalType,
            score,
            uint64(block.timestamp),
            signalId
        );
        
        return signalId;
    }
    
    /**
     * @notice Publish multiple signals in one transaction (gas efficient)
     * @param signals Array of signals to publish
     */
    function publishSignalBatch(Signal[] calldata signals) 
        external 
        onlyPublisher 
    {
        require(signals.length > 0, "Empty batch");
        require(signals.length <= 50, "Batch too large"); // Gas limit
        
        for (uint256 i = 0; i < signals.length; i++) {
            Signal memory signal = signals[i];
            require(signal.score <= 100, "Invalid score");
            
            bytes32 tokenKey = keccak256(abi.encodePacked(
                signal.tokenAddress,
                signal.chain
            ));
            
            Signal memory newSignal = Signal({
                signalType: signal.signalType,
                tokenAddress: signal.tokenAddress,
                chain: signal.chain,
                score: signal.score,
                timestamp: uint64(block.timestamp),
                metadataHash: signal.metadataHash,
                publisher: msg.sender
            });
            
            signalHistory[tokenKey].push(newSignal);
            
            // Generate signal ID
            globalSignalCounter++;
            bytes32 signalId = keccak256(abi.encodePacked(
                globalSignalCounter,
                signal.tokenAddress,
                signal.chain,
                block.timestamp
            ));
            signalIds[tokenKey].push(signalId);
            
            emit SignalPublished(
                signal.tokenAddress,
                signal.chain,
                signal.signalType,
                signal.score,
                uint64(block.timestamp),
                signalId
            );
        }
        
        emit SignalBatchPublished(signals.length, uint64(block.timestamp));
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get aggregated confidence score for a token
     * @param tokenAddress Token to check
     * @param chain Chain where token exists
     * @return totalScore Sum of all recent signal scores
     * @return signalCount Number of recent signals
     */
    function getConfidenceScore(
        address tokenAddress,
        string calldata chain
    ) 
        external 
        view 
        returns (uint16 totalScore, uint8 signalCount) 
    {
        bytes32 tokenKey = keccak256(abi.encodePacked(tokenAddress, chain));
        Signal[] memory signals = signalHistory[tokenKey];
        
        uint64 cutoffTime = uint64(block.timestamp) - uint64(SIGNAL_EXPIRY);
        
        for (uint256 i = 0; i < signals.length; i++) {
            if (signals[i].timestamp > cutoffTime) {
                totalScore += signals[i].score;
                signalCount++;
            }
        }
        
        return (totalScore, signalCount);
    }
    
    /**
     * @notice Get recent signal IDs for position recording
     */
    function getRecentSignalIds(
        address tokenAddress,
        string calldata chain
    ) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        bytes32 tokenKey = keccak256(abi.encodePacked(tokenAddress, chain));
        bytes32[] memory allIds = signalIds[tokenKey];
        
        // Count recent signals
        Signal[] memory signals = signalHistory[tokenKey];
        uint64 cutoffTime = uint64(block.timestamp) - uint64(SIGNAL_EXPIRY);
        
        uint256 recentCount = 0;
        for (uint256 i = 0; i < signals.length; i++) {
            if (signals[i].timestamp > cutoffTime) {
                recentCount++;
            }
        }
        
        // Return only recent IDs
        bytes32[] memory recentIds = new bytes32[](recentCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < signals.length; i++) {
            if (signals[i].timestamp > cutoffTime && index < recentCount) {
                recentIds[index] = allIds[i];
                index++;
            }
        }
        
        return recentIds;
    }
    
    /**
     * @notice Get all signals for a token
     */
    function getSignalHistory(
        address tokenAddress,
        string calldata chain
    ) 
        external 
        view 
        returns (Signal[] memory) 
    {
        bytes32 tokenKey = keccak256(abi.encodePacked(tokenAddress, chain));
        return signalHistory[tokenKey];
    }
    
    /**
     * @notice Get signals by type
     */
    function getSignalsByType(
        address tokenAddress,
        string calldata chain,
        SignalType signalType
    ) 
        external 
        view 
        returns (Signal[] memory) 
    {
        bytes32 tokenKey = keccak256(abi.encodePacked(tokenAddress, chain));
        Signal[] memory allSignals = signalHistory[tokenKey];
        
        // Count matching signals
        uint256 matchCount = 0;
        for (uint256 i = 0; i < allSignals.length; i++) {
            if (allSignals[i].signalType == signalType) {
                matchCount++;
            }
        }
        
        // Populate result
        Signal[] memory result = new Signal[](matchCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allSignals.length; i++) {
            if (allSignals[i].signalType == signalType) {
                result[index] = allSignals[i];
                index++;
            }
        }
        
        return result;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    function setPublisher(address newPublisher) external onlyOwner {
        require(newPublisher != address(0), "Invalid publisher");
        address oldPublisher = publisherAddress;
        publisherAddress = newPublisher;
        emit PublisherUpdated(oldPublisher, newPublisher);
    }
    
    function setNexusVault(address _nexusVault) external onlyOwner {
        require(_nexusVault != address(0), "Invalid vault");
        nexusVault = _nexusVault;
    }
    
    /**
     * @notice Clean up expired signals to save gas on reads
     */
    function cleanExpiredSignals(
        address tokenAddress,
        string calldata chain
    ) 
        external 
    {
        bytes32 tokenKey = keccak256(abi.encodePacked(tokenAddress, chain));
        Signal[] storage signals = signalHistory[tokenKey];
        
        uint64 cleanupCutoff = uint64(block.timestamp) - uint64(SIGNAL_CLEANUP_WINDOW);
        
        // Remove signals older than cleanup window
        uint256 i = 0;
        while (i < signals.length) {
            if (signals[i].timestamp < cleanupCutoff) {
                // Swap with last element and pop
                signals[i] = signals[signals.length - 1];
                signals.pop();
            } else {
                i++;
            }
        }
    }
}
