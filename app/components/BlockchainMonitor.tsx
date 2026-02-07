"use client";

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';

// Contract addresses from environment
const NEXUS_VAULT_ADDRESS = process.env.NEXT_PUBLIC_NEXUS_VAULT_ADDRESS as `0x${string}`;
const SIGNAL_ORACLE_ADDRESS = process.env.NEXT_PUBLIC_SIGNAL_ORACLE_ADDRESS as `0x${string}`;

// USDC addresses per chain
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum Mainnet
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
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

  // Write contracts
  const { writeContract: approveUSDC, data: approveHash } = useWriteContract();
  const { writeContract: depositToVault, data: depositHash } = useWriteContract();

  // Wait for approve transaction
  const { isLoading: isApproveLoading, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Wait for deposit transaction
  const { isLoading: isDepositLoading, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({
    hash: depositHash,
  });

  // Handle approve success
  useEffect(() => {
    if (isApproveSuccess) {
      console.log('✅ UI: USDC Approval Successful!', approveHash);
      setIsApproving(false);
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance, approveHash]);

  // Handle deposit success
  useEffect(() => {
    if (isDepositSuccess) {
      console.log('✅ UI: Deposit to Vault Successful!', depositHash);
      setIsDepositing(false);
      setDepositAmount('');
      refetchBalance();
      refetchUserBalance();
      refetchValue();
    }
  }, [isDepositSuccess, refetchBalance, refetchUserBalance, refetchValue, depositHash]);

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
    console.log('🚀 UI: Initiating USDC Approval...');
    if (!depositAmount || !NEXUS_VAULT_ADDRESS) {
      console.error('❌ UI: Approval aborted - missing amount or vault address', { depositAmount, NEXUS_VAULT_ADDRESS });
      return;
    }
    try {
      setIsApproving(true);
      const amount = parseUnits(depositAmount, 6);
      console.log('📊 UI: Approval Details:', {
        amount: amount.toString(),
        token: USDC_ADDRESS,
        spender: NEXUS_VAULT_ADDRESS,
        chainId
      });
      
      approveUSDC({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [NEXUS_VAULT_ADDRESS, amount],
        gas: BigInt(100000), // Sufficient gas limit for approve
        maxFeePerGas: BigInt(50000000000), // 50 gwei
        maxPriorityFeePerGas: BigInt(2000000000), // 2 gwei
      });
    } catch (error) {
      console.error('❌ UI: Approval error:', error);
      setIsApproving(false);
    }
  };

  // Handle deposit
  const handleDeposit = async () => {
    console.log('🚀 UI: Initiating Deposit to Vault...');
    if (!depositAmount || !NEXUS_VAULT_ADDRESS) {
      console.error('❌ UI: Deposit aborted - missing amount or vault address', { depositAmount, NEXUS_VAULT_ADDRESS });
      return;
    }
    try {
      setIsDepositing(true);
      const amount = parseUnits(depositAmount, 6);
      console.log('📊 UI: Deposit Details:', {
        amount: amount.toString(),
        vault: NEXUS_VAULT_ADDRESS,
        chainId
      });
      
      depositToVault({
        address: NEXUS_VAULT_ADDRESS,
        abi: NEXUS_VAULT_ABI,
        functionName: 'deposit',
        args: [amount],
        gas: BigInt(500000), // Sufficient gas limit
        maxFeePerGas: BigInt(50000000000), // 50 gwei
        maxPriorityFeePerGas: BigInt(2000000000), // 2 gwei
      });
    } catch (error: any) {
      console.error('❌ UI: Deposit error:', error);
      if (error.message?.includes('max fee per gas')) {
        console.warn('💡 UI: Gas fee too low. Try increasing gas in MetaMask or waiting for network congestion to clear.');
      }
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
              <label className="block text-sm text-gray-400 mb-2">Amount to Deposit</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {!isAmountApproved ? (
                <button
                  onClick={handleApprove}
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isApproving || isApproveLoading}
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
                  disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isDepositing || isDepositLoading}
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
