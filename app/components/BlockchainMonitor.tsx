"use client";

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

// Contract addresses from environment
const NEXUS_VAULT_ADDRESS = process.env.NEXT_PUBLIC_NEXUS_VAULT_ADDRESS as `0x${string}`;
const SIGNAL_ORACLE_ADDRESS = process.env.NEXT_PUBLIC_SIGNAL_ORACLE_ADDRESS as `0x${string}`;

import { getRoutes, createConfig, executeRoute } from '@lifi/sdk';
import type { Route } from '@lifi/sdk';

// Initialize LI.FI once
createConfig({ integrator: 'nexus-autonomous-agent' });

// USDC addresses per chain
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum Mainnet
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
};

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
  421614: 'Arbitrum Sepolia'
};

// Simplified ABIs
const NEXUS_VAULT_ABI = [
  {
    "inputs": [],
    "name": "getVaultValue",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "amount", "type": "uint256" }],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

const USDC_ABI = [
  {
    "inputs": [{ "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

interface VaultStats {
  balance: string;
  paused: boolean;
  tvl: string;
}

export default function BlockchainMonitor() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const USDC_ADDRESS = USDC_ADDRESSES[chainId] || USDC_ADDRESSES[42161];

  const [stats, setStats] = useState<VaultStats>({
    balance: '0',
    paused: false,
    tvl: '0'
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);

  // BRIDGE STATES
  const [sourceChainId, setSourceChainId] = useState<number>(8453); // Default to Base
  const [bridgeQuote, setBridgeQuote] = useState<Route | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [isBridging, setIsBridging] = useState(false);

  // Fetch bridge quote when amount or chain changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!depositAmount || parseFloat(depositAmount) <= 0 || !address || sourceChainId === chainId) {
        setBridgeQuote(null);
        return;
      }

      setIsFetchingQuote(true);
      try {
        const result = await getRoutes({
          fromChainId: sourceChainId,
          toChainId: 42161, // Always bridge to Arbitrum
          fromTokenAddress: USDC_ADDRESSES[sourceChainId],
          toTokenAddress: USDC_ADDRESSES[42161],
          fromAmount: parseUnits(depositAmount, 6).toString(),
          fromAddress: address,
        });

        if (result.routes && result.routes.length > 0) {
          setBridgeQuote(result.routes[0]);
        }
      } catch (error) {
        console.error('❌ Failed to fetch LI.FI quote:', error);
      } finally {
        setIsFetchingQuote(false);
      }
    };

    const timer = setTimeout(fetchQuote, 500); // Debounce
    return () => clearTimeout(timer);
  }, [depositAmount, sourceChainId, address, chainId]);

  // Read vault balance
  const { data: vaultBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: NEXUS_VAULT_ADDRESS ? [NEXUS_VAULT_ADDRESS] : undefined,
    query: {
      enabled: !!NEXUS_VAULT_ADDRESS,
    }
  });

  // Read user USDC balance
  const { data: userBalance, refetch: refetchUserBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    }
  });

  // Read USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address && NEXUS_VAULT_ADDRESS ? [address, NEXUS_VAULT_ADDRESS] : undefined,
    query: {
      enabled: !!address && !!NEXUS_VAULT_ADDRESS && isConnected,
    }
  });

  // Read vault value
  const { data: vaultValue, refetch: refetchValue } = useReadContract({
    address: NEXUS_VAULT_ADDRESS,
    abi: NEXUS_VAULT_ABI,
    functionName: 'getVaultValue',
    query: {
      enabled: !!NEXUS_VAULT_ADDRESS,
    }
  });

  // Read paused status
  const { data: isPaused, refetch: refetchPaused } = useReadContract({
    address: NEXUS_VAULT_ADDRESS,
    abi: NEXUS_VAULT_ABI,
    functionName: 'paused',
    query: {
      enabled: !!NEXUS_VAULT_ADDRESS,
    }
  });

  // Update stats when data changes
  useEffect(() => {
    if (vaultBalance) {
      setStats(prev => ({
        ...prev,
        balance: formatUnits(vaultBalance as bigint, 6)
      }));
    }
    if (vaultValue) {
      setStats(prev => ({
        ...prev,
        tvl: formatUnits(vaultValue as bigint, 6)
      }));
    }
    if (isPaused !== undefined) {
      setStats(prev => ({
        ...prev,
        paused: isPaused as boolean
      }));
    }
  }, [vaultBalance, vaultValue, isPaused]);

  // Write contracts with error tracking
  const {
    writeContract: approveUSDC,
    data: approveHash,
    error: approveError,
    status: approveStatus
  } = useWriteContract();

  const {
    writeContract: depositToVault,
    data: depositHash,
    error: depositError,
    status: depositStatus
  } = useWriteContract();

  // Wait for transactions with error capture
  const {
    isLoading: isApproveLoading,
    isSuccess: isApproveSuccess,
    error: approveReceiptError
  } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const {
    isLoading: isDepositLoading,
    isSuccess: isDepositSuccess,
    error: depositReceiptError
  } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  // Comprehensive Debug Logging
  useEffect(() => {
    if (approveError) console.error('❌ Approve Contract Error:', approveError);
    if (approveReceiptError) console.error('❌ Approve Receipt Error:', approveReceiptError);
    if (depositError) console.error('❌ Deposit Contract Error:', depositError);
    if (depositReceiptError) console.error('❌ Deposit Receipt Error:', depositReceiptError);
  }, [approveError, approveReceiptError, depositError, depositReceiptError]);

  // Handle errors in UI
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Handle approve success
  useEffect(() => {
    if (isApproveSuccess) {
      setIsApproving(false);
      setErrorMessage(null);
      refetchAllowance();
      console.log('✅ Approval Successful:', approveHash);
    }
  }, [isApproveSuccess, refetchAllowance, approveHash]);

  // Handle deposit success
  useEffect(() => {
    if (isDepositSuccess) {
      setIsDepositing(false);
      setErrorMessage(null);
      setDepositAmount('');
      refetchBalance();
      refetchUserBalance();
      refetchValue();
      console.log('✅ Deposit Successful:', depositHash);
    }
  }, [isDepositSuccess, refetchBalance, refetchUserBalance, refetchValue, depositHash]);

  // Reset loading states on error
  useEffect(() => {
    if (approveError || approveReceiptError) {
      setIsApproving(false);
      setErrorMessage(approveError?.message || approveReceiptError?.message || 'Approval failed');
    }
    if (depositError || depositReceiptError) {
      setIsDepositing(false);
      setErrorMessage(depositError?.message || depositReceiptError?.message || 'Deposit failed');
    }
  }, [approveError, approveReceiptError, depositError, depositReceiptError]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchBalance();
      refetchValue();
      refetchPaused();
      if (isConnected) {
        refetchUserBalance();
        refetchAllowance();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [refetchBalance, refetchValue, refetchPaused, refetchUserBalance, refetchAllowance, isConnected]);

  // Handle approve
  const handleApprove = async () => {
    if (!depositAmount || !NEXUS_VAULT_ADDRESS) return;
    setErrorMessage(null);
    try {
      setIsApproving(true);
      const amount = parseUnits(depositAmount, 6);
      console.log('🚀 Approving USDC:', { amount: amount.toString(), vault: NEXUS_VAULT_ADDRESS });

      approveUSDC({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [NEXUS_VAULT_ADDRESS, amount],
        // Manual gas overrides for Sepolia stability (1 gwei)
        maxFeePerGas: parseUnits('1', 9),
        maxPriorityFeePerGas: parseUnits('1', 9),
      });
    } catch (error: any) {
      console.error('Approve setup error:', error);
      setErrorMessage(error.message);
      setIsApproving(false);
    }
  };

  // Handle deposit
  const handleDeposit = async () => {
    if (!depositAmount || !NEXUS_VAULT_ADDRESS) return;
    setErrorMessage(null);
    try {
      setIsDepositing(true);
      const amount = parseUnits(depositAmount, 6);

      // EXTREME LOGGING
      console.log('🔍 DEPOSIT DEBUG:', {
        rawInput: depositAmount,
        parsedBigInt: amount.toString(),
        usdcAddress: USDC_ADDRESS,
        vaultAddress: NEXUS_VAULT_ADDRESS,
        chainId: chainId
      });

      depositToVault({
        address: NEXUS_VAULT_ADDRESS,
        abi: NEXUS_VAULT_ABI,
        functionName: 'deposit',
        args: [amount],
        gas: BigInt(2000000), // Increased gas limit for Arbitrum complex calls
        maxFeePerGas: parseUnits('1', 9),
        maxPriorityFeePerGas: parseUnits('1', 9),
      });
    } catch (error: any) {
      console.error('Deposit setup error:', error);
      setErrorMessage(error.message);
      setIsDepositing(false);
    }
  };

  // Check if amount is approved
  const depositAmountBigInt = depositAmount ? parseUnits(depositAmount, 6) : BigInt(0);
  const isAmountApproved = allowance ? (allowance as bigint) >= depositAmountBigInt : false;

  if (!NEXUS_VAULT_ADDRESS) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <p className="text-yellow-500 text-sm">
          ⚠️ Contracts not deployed yet. Run deployment first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Vault Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Vault Balance</span>
            <span className={`w-2 h-2 rounded-full ${stats.paused ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></span>
          </div>
          <p className="text-2xl font-bold text-white">{parseFloat(stats.balance).toLocaleString()} USDC</p>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Value Locked</span>
          </div>
          <p className="text-2xl font-bold text-white">${parseFloat(stats.tvl).toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Status</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {stats.paused ? '⏸️ Paused' : '✅ Active'}
          </p>
        </div>
      </div>

      {/* Deposit Section */}
      {isConnected && address && (
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">💰 Deposit USDC to Vault</h3>

          <div className="space-y-4">
            {/* User Balance */}
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-400">Your USDC Balance:</span>
              <span className="text-white font-mono">
                {userBalance ? formatUnits(userBalance as bigint, 6) : '0'} USDC
              </span>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm text-gray-400">Amount to Deposit</label>
                <a
                  href="https://faucet.circle.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                >
                  Get Testnet USDC ↗
                </a>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className={`flex-1 bg-black/30 border ${errorMessage?.includes('balance') ? 'border-red-500/50' : 'border-white/20'} rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500`}
                  disabled={isApproving || isDepositing || isApproveLoading || isDepositLoading}
                />
                <button
                  onClick={() => userBalance && setDepositAmount(formatUnits(userBalance as bigint, 6))}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 rounded-lg text-blue-400 text-sm transition-colors"
                  disabled={!userBalance || isApproving || isDepositing || isApproveLoading || isDepositLoading}
                >
                  MAX
                </button>
              </div>
              {userBalance && depositAmount && parseUnits(depositAmount, 6) > (userBalance as bigint) && (
                <p className="text-red-400 text-[10px] mt-1 italic">
                  ⚠️ Amount exceeds your {formatUnits(userBalance as bigint, 6)} USDC balance
                </p>
              )}
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-500 text-xs break-words">
                  ❌ {errorMessage.includes('balance') ? 'Insufficient Balance: You need USDC on Arbitrum Sepolia' : errorMessage}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isAmountApproved ? (
                <button
                  onClick={handleApprove}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isApproving || isApproveLoading || (userBalance && parseUnits(depositAmount, 6) > (userBalance as bigint))}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg"
                >
                  {isApproving || isApproveLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙️</span>
                      Approving...
                    </span>
                  ) : (
                    '1. Approve USDC'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isDepositing || isDepositLoading || (userBalance && parseUnits(depositAmount, 6) > (userBalance as bigint))}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 disabled:from-gray-600 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all duration-200 shadow-lg"
                >
                  {isDepositing || isDepositLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⚙️</span>
                      Depositing...
                    </span>
                  ) : (
                    '2. Deposit to Vault'
                  )}
                </button>
              )}
            </div>

            {/* Helper Text */}
            <div className="text-xs text-gray-400 text-center">
              {!isAmountApproved ? (
                <p>Step 1: Approve the vault to spend your USDC</p>
              ) : (
                <p className="text-green-400">✓ Approved! Now you can deposit</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bridge Section */}
      {isConnected && address && chainId !== 42161 && chainId !== 421614 && (
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-white/10 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">🌉 Bridge from {CHAIN_NAMES[chainId] || 'Other Chain'}</h3>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
              POWERED BY LI.FI
            </span>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              You're currently on {CHAIN_NAMES[chainId]}. Select a chain to bridge USDC to Arbitrum and start trading.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[8453, 10, 137, 1].map((id) => (
                <button
                  key={id}
                  onClick={() => setSourceChainId(id)}
                  className={`px-4 py-3 rounded-lg border text-sm transition-all ${sourceChainId === id
                    ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/30'
                    }`}
                >
                  {CHAIN_NAMES[id]}
                </button>
              ))}
            </div>

            {bridgeQuote && (
              <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Estimated Output:</span>
                  <span className="text-green-400 font-bold">{formatUnits(BigInt(bridgeQuote.toAmount), 6)} USDC</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Bridge Fee:</span>
                  <span className="text-gray-300">${bridgeQuote.gasCosts?.[0]?.amountUSD || '0.50'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Est. Time:</span>
                  <span className="text-gray-300">~{(bridgeQuote.steps[0]?.estimate?.executionDuration || 180) / 60} mins</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Route:</span>
                  <span className="text-blue-400">{bridgeQuote.steps[0]?.toolDetails?.name}</span>
                </div>
              </div>
            )}

            <button
              onClick={async () => {
                if (!bridgeQuote) return;
                setIsBridging(true);
                setErrorMessage(null);
                try {
                  console.log('🚀 Executing LI.FI Bridge:', bridgeQuote);
                  const result = await executeRoute(bridgeQuote);
                  console.log('✅ Bridge Success:', result);
                  refetchUserBalance();
                } catch (error: any) {
                  console.error('❌ Bridge Failed:', error);
                  setErrorMessage(error.message || 'Bridge transaction failed');
                } finally {
                  setIsBridging(false);
                }
              }}
              disabled={!bridgeQuote || isFetchingQuote || isBridging}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-600 disabled:to-gray-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all"
            >
              {isFetchingQuote ? 'Fetching Route...' : isBridging ? 'Bridging...' : 'Bridge to Arbitrum'}
            </button>
          </div>
        </div>
      )}

      {/* Debug Panel */}
      <div className="bg-black/40 border border-white/10 rounded-lg p-4 font-mono text-[10px] space-y-2">
        <h4 className="text-gray-500 uppercase tracking-widest text-[9px] mb-2">Technical Debugger</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-gray-500">Connected Chain:</span>
          <span className="text-white text-right">{chainId}</span>

          <span className="text-gray-500">USDC Contract:</span>
          <span className="text-white text-right truncate">{USDC_ADDRESS}</span>

          <span className="text-gray-500">Vault Contract:</span>
          <span className="text-white text-right truncate">{NEXUS_VAULT_ADDRESS}</span>

          <span className="text-gray-500">Current Allowance:</span>
          <span className="text-white text-right">
            {allowance ? formatUnits(allowance as bigint, 6) : '0'} USDC
          </span>

          <span className="text-gray-500">Approve Status:</span>
          <span className={`text-right ${approveStatus === 'error' ? 'text-red-400' : 'text-blue-400'}`}>
            {approveStatus} {isApproveLoading && '(waiting...)'}
          </span>

          <span className="text-gray-500">Deposit Status:</span>
          <span className={`text-right ${depositStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
            {depositStatus} {isDepositLoading && '(waiting...)'}
          </span>
        </div>

        {depositHash && (
          <div className="pt-2 border-t border-white/5">
            <span className="text-gray-500">Last Hash:</span>
            <p className="text-blue-400 break-all">{depositHash}</p>
          </div>
        )}
      </div>

      {/* Not Connected Message */}
      {!isConnected && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
          <p className="text-yellow-500 text-sm text-center">
            🔌 Connect your wallet to deposit funds into the vault
          </p>
        </div>
      )}

      {/* Contract Addresses */}
      <div className="bg-black/20 border border-white/10 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Contract Addresses</h3>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">NexusVault:</span>
            <a
              href={`${chainId === 421614 ? 'https://sepolia.arbiscan.io' : chainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://arbiscan.io'}/address/${NEXUS_VAULT_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono"
            >
              {NEXUS_VAULT_ADDRESS?.slice(0, 6)}...{NEXUS_VAULT_ADDRESS?.slice(-4)}
            </a>
          </div>
          {SIGNAL_ORACLE_ADDRESS && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400">SignalOracle:</span>
              <a
                href={`${chainId === 421614 ? 'https://sepolia.arbiscan.io' : chainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://arbiscan.io'}/address/${SIGNAL_ORACLE_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono"
              >
                {SIGNAL_ORACLE_ADDRESS?.slice(0, 6)}...{SIGNAL_ORACLE_ADDRESS?.slice(-4)}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Live Indicator */}
      <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>
          Live on {chainId === 421614 ? 'Arbitrum Sepolia' : chainId === 11155111 ? 'Ethereum Sepolia' : 'Arbitrum'}
        </span>
      </div>
    </div>
  );
}
