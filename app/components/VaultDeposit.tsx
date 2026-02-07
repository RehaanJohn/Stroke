"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { arbitrumSepolia } from "wagmi/chains";

// Contract addresses on Arbitrum Sepolia
const NEXUS_VAULT_ADDRESS = "0x3Fc0ec32Ce95b3f090866C28132E439C475529e5";
const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

// USDC ABI
const USDC_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// NexusVault ABI
const VAULT_ABI = [
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getTotalVaultValue",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export default function VaultDeposit() {
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<
    "input" | "approving" | "depositing" | "success"
  >("input");
  const { address, chain } = useAccount();

  // Read balances
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: arbitrumSepolia.id,
  });

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address ? [address, NEXUS_VAULT_ADDRESS] : undefined,
    chainId: arbitrumSepolia.id,
  });

  const { data: vaultValue } = useReadContract({
    address: NEXUS_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getTotalVaultValue",
    chainId: arbitrumSepolia.id,
  });

  // Transactions
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApproving,
  } = useWriteContract();

  const { isLoading: isApprovingTx } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const {
    writeContract: deposit,
    data: depositHash,
    isPending: isDepositing,
  } = useWriteContract();

  const { isLoading: isDepositingTx, isSuccess: isDepositSuccess } =
    useWaitForTransactionReceipt({
      hash: depositHash,
    });

  const handleApprove = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setStep("approving");
    const amountInWei = parseUnits(amount, 6);
    approve({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: "approve",
      args: [NEXUS_VAULT_ADDRESS, amountInWei],
      chainId: arbitrumSepolia.id,
    });
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setStep("depositing");
    const amountInWei = parseUnits(amount, 6);
    deposit({
      address: NEXUS_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amountInWei],
      chainId: arbitrumSepolia.id,
    });
  };

  // Check approval status
  const amountInWei = amount ? parseUnits(amount, 6) : BigInt(0);
  const needsApproval =
    allowance !== undefined &&
    amountInWei > BigInt(0) &&
    allowance < amountInWei;

  // Auto-transitions
  if (
    step === "approving" &&
    !isApproving &&
    !isApprovingTx &&
    allowance &&
    allowance >= amountInWei
  ) {
    setStep("input");
  }

  if (isDepositSuccess && step !== "success") {
    setStep("success");
  }

  const usdcBalanceFormatted = usdcBalance ? formatUnits(usdcBalance, 6) : "0";
  const vaultValueFormatted = vaultValue ? formatUnits(vaultValue, 6) : "0";
  const isWrongNetwork = chain?.id !== arbitrumSepolia.id;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-black via-zinc-950 to-black backdrop-blur-2xl border border-slate-500/20 rounded-3xl shadow-2xl shadow-slate-500/5">
      {/* Decorative gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 via-transparent to-slate-600/5 pointer-events-none"></div>

      <div className="relative p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-400 to-slate-500 rounded-2xl blur-xl opacity-30 animate-pulse"></div>
              <div className="relative w-14 h-14 bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-400/30">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight mb-0.5">
                Secure Vault
              </h3>
              <p className="text-sm text-white/40 font-light tracking-wide">
                Deposit funds for autonomous trading
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/30 mb-1 font-medium uppercase tracking-widest">
              Total Assets
            </div>
            <div className="text-3xl font-bold text-slate-300">
              $
              {parseFloat(vaultValueFormatted).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="text-xs text-white/20 mt-0.5 font-light">USDC</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-gradient-to-br from-zinc-900/80 to-black/80 rounded-2xl border border-white/5 p-6 backdrop-blur-sm">
          {isWrongNetwork ? (
            <div className="flex items-center gap-4 p-4 bg-slate-500/10 border border-slate-500/20 rounded-xl">
              <div className="flex-shrink-0 w-10 h-10 bg-slate-500/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-300 text-sm mb-0.5">
                  Wrong Network
                </div>
                <div className="text-xs text-slate-400/70 font-light">
                  Please switch to Arbitrum Sepolia testnet
                </div>
              </div>
            </div>
          ) : step === "success" ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-500/30">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="text-xl font-bold text-white mb-2">
                Deposit Successful
              </div>
              <div className="text-sm text-white/50 font-light mb-6">
                <span className="font-semibold text-green-400">
                  {amount} USDC
                </span>{" "}
                has been securely added to your vault
              </div>
              <button
                onClick={() => {
                  setStep("input");
                  setAmount("");
                }}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl text-sm font-medium transition-all duration-200"
              >
                Make Another Deposit
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Input Field */}
              <div className="space-y-3">
                <label className="block text-xs text-white/50 font-medium uppercase tracking-widest">
                  Amount to Deposit
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-slate-500/10 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={step !== "input"}
                    className="relative w-full bg-black/60 border border-white/10 hover:border-slate-400/30 focus:border-slate-400/50 rounded-xl px-5 py-4 pr-28 text-white text-2xl font-bold placeholder-white/10 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                    <span className="text-white/30 text-sm font-semibold tracking-wide">
                      USDC
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    isApproving ||
                    isApprovingTx ||
                    isWrongNetwork
                  }
                  className="relative w-full group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 text-white font-bold py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-500/20">
                    {isApproving || isApprovingTx ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="text-sm tracking-wide">
                          Approving USDC...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="tracking-wide">
                          Approve {amount || "0"} USDC
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    isDepositing ||
                    isDepositingTx ||
                    isWrongNetwork
                  }
                  className="relative w-full group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                  <div className="relative bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 text-white font-bold py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-500/20">
                    {isDepositing || isDepositingTx ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span className="text-sm tracking-wide">
                          Processing Deposit...
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                        <span className="tracking-wide">Deposit to Vault</span>
                      </div>
                    )}
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Information Panel */}
        <div className="mt-6 bg-gradient-to-r from-slate-500/5 via-zinc-900/50 to-slate-600/5 border border-slate-500/10 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-slate-500/10 rounded-lg flex items-center justify-center mt-0.5">
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-300 mb-1.5 tracking-wide">
                How It Works
              </div>
              <div className="text-xs text-white/40 font-light leading-relaxed">
                Your USDC is secured in the{" "}
                <span className="text-slate-300/80 font-medium">
                  NexusVault
                </span>{" "}
                smart contract. The AI agent autonomously executes shorts when
                high-confidence signals are detected. All profits automatically
                flow back to the vault.
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Link */}
        {(approveHash || depositHash) && (
          <div className="mt-5 text-center">
            <a
              href={`https://sepolia.arbiscan.io/tx/${
                depositHash || approveHash
              }`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 font-medium transition-colors duration-200 group"
            >
              <span className="tracking-wide">View Transaction</span>
              <svg
                className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
