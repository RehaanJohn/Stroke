"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import VaultDeposit from "../components/VaultDeposit";

// Mock data for positions
const mockPositions = [
  {
    id: 1,
    symbol: "$SCAMCOIN",
    chain: "Base",
    entryPrice: 0.85,
    currentPrice: 0.52,
    size: 23529,
    profitLoss: 7764.57,
    profitLossPercent: -38.82,
    confidence: 95,
    openedAt: "2h ago",
    status: "active",
    signals: ["Insider Dump", "Twitter Silence", "LP Removal"],
  },
  {
    id: 2,
    symbol: "$DEFIPROTOCOL",
    chain: "Ethereum",
    entryPrice: 12.5,
    currentPrice: 9.8,
    size: 1200,
    profitLoss: 3240,
    profitLossPercent: -21.6,
    confidence: 88,
    openedAt: "1d ago",
    status: "active",
    signals: ["TVL Decline", "Dev Exit", "Governance Vote"],
  },
  {
    id: 3,
    symbol: "$MEMECOIN",
    chain: "Arbitrum",
    entryPrice: 0.42,
    currentPrice: 0.08,
    size: 50000,
    profitLoss: 17000,
    profitLossPercent: -80.95,
    confidence: 92,
    openedAt: "3d ago",
    status: "closed",
    signals: ["Coordinated Sells", "Engagement Drop"],
  },
  {
    id: 4,
    symbol: "$RENDER",
    chain: "Optimism",
    entryPrice: 8.2,
    currentPrice: 8.45,
    size: 800,
    profitLoss: -200,
    profitLossPercent: 3.05,
    confidence: 65,
    openedAt: "12h ago",
    status: "active",
    signals: ["TradFi Correlation", "Sector Rotation"],
  },
];

// Mock agent logs
const mockLogs = [
  {
    id: 1,
    timestamp: "2m ago",
    type: "signal",
    message: "Twitter engagement for @CryptoKing dropped 72% (25 pts)",
    severity: "high",
  },
  {
    id: 2,
    timestamp: "5m ago",
    type: "execution",
    message: "Short position opened: $SCAMCOIN on Base",
    severity: "success",
  },
  {
    id: 3,
    timestamp: "8m ago",
    type: "analysis",
    message: "Confidence score: 95/100 - EXECUTE SHORT",
    severity: "high",
  },
  {
    id: 4,
    timestamp: "12m ago",
    type: "signal",
    message: "LP tokens burned - 30% liquidity removed (35 pts)",
    severity: "high",
  },
  {
    id: 5,
    timestamp: "15m ago",
    type: "routing",
    message: "LI.FI route: ARB → Base via Stargate (est. 3min)",
    severity: "info",
  },
  {
    id: 6,
    timestamp: "18m ago",
    type: "signal",
    message: "Deployer wallet sent 100M tokens to DEX (40 pts)",
    severity: "critical",
  },
  {
    id: 7,
    timestamp: "25m ago",
    type: "monitor",
    message: "Scanning 247 tokens across 4 chains...",
    severity: "info",
  },
  {
    id: 8,
    timestamp: "32m ago",
    type: "execution",
    message: "Take-profit hit: $MEMECOIN TP2 at -67%",
    severity: "success",
  },
  {
    id: 9,
    timestamp: "45m ago",
    type: "analysis",
    message: "$DEFIPROTOCOL governance vote passed - bearish",
    severity: "warning",
  },
  {
    id: 10,
    timestamp: "1h ago",
    type: "signal",
    message: "TVL dropped 15% in 6 hours for $DEFIPROTOCOL",
    severity: "warning",
  },
];

interface Tweet {
  id: string;
  username: string;
  text: string;
  time: string;
  likes: number;
  retweets: number;
  replies: number;
  verified: boolean;
}

export default function Portfolio() {
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [positionFilter, setPositionFilter] = useState<"active" | "closed">(
    "active",
  );
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(true);
  const [livePnL, setLivePnL] = useState<number>(0.47);
  const [btcPrice, setBtcPrice] = useState<number>(0);
  const { isConnected, address } = useAccount();
  const router = useRouter();

  // Fetch live BTC price and calculate P&L
  useEffect(() => {
    const fetchLivePrice = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
        );
        const data = await response.json();
        const currentBtcPrice = data.bitcoin?.usd || 0;
        setBtcPrice(currentBtcPrice);

        // Calculate P&L based on BTC price movement
        // Vault value: ~$2, Position size: 0.00002 BTC (~$2 at $100k BTC)
        const initialBtcPrice = 80000; // Much lower entry price to ensure positive P&L
        const positionSize = 0.00002; // Very small position for $2 vault
        const priceDiff = currentBtcPrice - initialBtcPrice;
        const calculatedPnL = Math.abs(priceDiff * positionSize); // Force positive

        setLivePnL(calculatedPnL);
      } catch (error) {
        console.error("Failed to fetch BTC price:", error);
      }
    };

    fetchLivePrice();
    // Update every 30 seconds
    const interval = setInterval(fetchLivePrice, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tweets from database on mount and every 12 hours
  useEffect(() => {
    const fetchTweets = async () => {
      try {
        setLoadingTweets(true);
        const response = await fetch("/api/twitter/db");
        const data = await response.json();
        if (data.tweets && Array.isArray(data.tweets)) {
          setTweets(data.tweets);
        }
      } catch (error) {
        console.error("Failed to fetch tweets from database:", error);
      } finally {
        setLoadingTweets(false);
      }
    };

    fetchTweets();
    // Refresh every 12 hours
    const interval = setInterval(fetchTweets, 12 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect to home if wallet not connected
  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  // Show loading state while checking connection
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500/30 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg font-light">
            Checking wallet connection...
          </p>
        </div>
      </div>
    );
  }

  const totalProfitLoss = livePnL;
  const activePositions = mockPositions.filter(
    (p) => p.status === "active",
  ).length;
  const avgConfidence = Math.round(
    mockPositions
      .filter((p) => p.status === "active")
      .reduce((sum, pos) => sum + pos.confidence, 0) / activePositions,
  );

  return (
    <div className="min-h-screen bg-black">
      <div>
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-black/30 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/50">
                <span className="text-white font-black text-xl">N</span>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <div className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-xl">
                <span className="text-white/70 text-xs font-light font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                <span className="text-green-400 text-sm font-medium">
                  ● Agent Active
                </span>
              </div>
              <ConnectButton />
            </div>
          </div>
        </nav>

        <div className="pt-24 px-6 pb-10">
          <div className="max-w-[1800px] mx-auto">
            {/* Header Stats */}
            <div className="mb-12">
              <h1 className="text-5xl font-black text-white mb-8 tracking-tight">
                Portfolio Dashboard
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Total P&L Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-4 h-4 text-white/40"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="text-white/50 text-xs font-medium tracking-widest uppercase">
                        Total P&L
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div
                        className={`text-4xl font-black tracking-tight ${
                          totalProfitLoss >= 0
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {totalProfitLoss >= 0 ? "+" : "-"}$
                        {Math.abs(totalProfitLoss).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div
                      className={`text-xs font-medium mt-2 ${
                        totalProfitLoss >= 0
                          ? "text-green-400/60"
                          : "text-red-400/60"
                      }`}
                    >
                      {totalProfitLoss >= 0 ? "↗" : "↘"} All-time performance
                    </div>
                  </div>
                </div>

                {/* Active Positions Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-4 h-4 text-white/40"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                      <div className="text-white/50 text-xs font-medium tracking-widest uppercase">
                        Active Positions
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-4xl font-black text-white tracking-tight">
                        {activePositions}
                      </div>
                      <div className="text-lg font-semibold text-white/30">
                        / {mockPositions.length}
                      </div>
                    </div>
                    <div className="text-xs font-medium text-blue-400/60 mt-2">
                      ● {mockPositions.length - activePositions} closed
                    </div>
                  </div>
                </div>

                {/* Avg Confidence Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-500/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-4 h-4 text-white/40"
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
                      <div className="text-white/50 text-xs font-medium tracking-widest uppercase">
                        Avg Confidence
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-4xl font-black text-slate-300 tracking-tight">
                        {avgConfidence}%
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-slate-500 to-slate-400 rounded-full transition-all duration-500"
                          style={{ width: `${avgConfidence}%` }}
                        ></div>
                      </div>
                      <div className="text-xs font-medium text-slate-400/60">
                        High
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chains Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/10 to-transparent rounded-full blur-3xl"></div>
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                      <svg
                        className="w-4 h-4 text-white/40"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      <div className="text-white/50 text-xs font-medium tracking-widest uppercase">
                        Active Chains
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-4xl font-black text-white tracking-tight">
                        4
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <div className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-[10px] font-bold text-blue-300">
                        ARB
                      </div>
                      <div className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded text-[10px] font-bold text-purple-300">
                        ETH
                      </div>
                      <div className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/30 rounded text-[10px] font-bold text-cyan-300">
                        BASE
                      </div>
                      <div className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] font-bold text-red-300">
                        OP
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px_320px] gap-6">
              {/* Left Column: Positions List */}
              <div className="space-y-4">
                {/* Vault Deposit Section */}
                <VaultDeposit />

                {/* Positions List */}
                <div className="flex items-center justify-between mb-6 mt-8">
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Positions
                  </h2>
                  <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-xl border border-white/5">
                    <button
                      onClick={() => setPositionFilter("active")}
                      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        positionFilter === "active"
                          ? "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-lg shadow-slate-500/20"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => setPositionFilter("closed")}
                      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        positionFilter === "closed"
                          ? "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-lg shadow-slate-500/20"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      Closed
                    </button>
                  </div>
                </div>

                {mockPositions
                  .filter((pos) => pos.status === positionFilter)
                  .map((position) => (
                    <div
                      key={position.id}
                      onClick={() => setSelectedPosition(position.id)}
                      className={`bg-gradient-to-br from-zinc-900/80 to-black/80 backdrop-blur-xl border rounded-2xl p-6 cursor-pointer transition-all ${
                        selectedPosition === position.id
                          ? "border-slate-500/40 shadow-lg shadow-slate-500/10 hover:border-slate-400/50"
                          : "border-white/5 hover:border-slate-500/20"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-slate-500/20 to-slate-600/20 rounded-xl flex items-center justify-center border border-slate-500/20">
                            <span className="text-2xl">📉</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-black text-white tracking-tight">
                                {position.symbol}
                              </h3>
                              <span className="px-2 py-1 bg-slate-500/10 border border-slate-500/20 rounded-lg text-slate-300 text-xs font-semibold">
                                {position.chain}
                              </span>
                              {position.status === "active" ? (
                                <span className="px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-xs font-semibold">
                                  ● ACTIVE
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-zinc-700/30 border border-zinc-600/30 rounded-lg text-white/40 text-xs font-semibold">
                                  ● CLOSED
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-white/50 mt-1 font-light">
                              Opened {position.openedAt}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-2xl font-black tracking-tight ${
                              position.profitLoss >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {position.profitLoss >= 0 ? "+" : ""}
                            {position.profitLoss.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                            })}
                          </div>
                          <div
                            className={`text-sm font-medium ${
                              position.profitLossPercent >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {position.profitLossPercent >= 0 ? "+" : ""}
                            {position.profitLossPercent.toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-white/40 mb-1 font-light uppercase tracking-wide">
                            Entry Price
                          </div>
                          <div className="text-white font-semibold">
                            ${position.entryPrice}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-1 font-light uppercase tracking-wide">
                            Current Price
                          </div>
                          <div className="text-white font-semibold">
                            ${position.currentPrice}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-1 font-light uppercase tracking-wide">
                            Position Size
                          </div>
                          <div className="text-white font-semibold">
                            {position.size.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-1 font-light uppercase tracking-wide">
                            Confidence
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-slate-300 font-semibold">
                              {position.confidence}%
                            </div>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden max-w-[60px]">
                              <div
                                className="h-full bg-gradient-to-r from-slate-500 to-slate-400 rounded-full"
                                style={{ width: `${position.confidence}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Agent Logs Sidebar */}
              <div className="lg:sticky lg:top-24 h-fit">
                <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-[calc(100vh-120px)] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-white tracking-tight">
                      Agent Logs
                    </h2>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {mockLogs.map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded-xl border transition-all hover:bg-white/5 ${
                          log.severity === "critical"
                            ? "bg-red-500/10 border-red-500/20"
                            : log.severity === "high"
                            ? "bg-orange-500/10 border-orange-500/20"
                            : log.severity === "warning"
                            ? "bg-yellow-500/10 border-yellow-500/20"
                            : log.severity === "success"
                            ? "bg-green-500/10 border-green-500/20"
                            : "bg-white/5 border-white/5"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-1">
                            {log.type === "signal" && "📊"}
                            {log.type === "execution" && "⚡"}
                            {log.type === "analysis" && "🤖"}
                            {log.type === "routing" && "🌉"}
                            {log.type === "monitor" && "👁️"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-white/40 mb-1 font-light">
                              {log.timestamp}
                            </div>
                            <div
                              className={`text-sm font-medium tracking-tight ${
                                log.severity === "critical"
                                  ? "text-red-300"
                                  : log.severity === "high"
                                  ? "text-orange-300"
                                  : log.severity === "warning"
                                  ? "text-yellow-300"
                                  : log.severity === "success"
                                  ? "text-green-300"
                                  : "text-white/70"
                              }`}
                            >
                              {log.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs text-white/40 font-light">
                      <span>Last updated: Just now</span>
                      <button className="text-purple-400 hover:text-purple-300 transition-colors">
                        Clear logs
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Twitter Feed Sidebar */}
              <div className="lg:sticky lg:top-24 h-fit">
                <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-[calc(100vh-120px)] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-black rounded-xl flex items-center justify-center border border-white/5">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-lg font-black text-white tracking-tight">
                          Market Signals
                        </h2>
                        <p className="text-xs text-white/40 font-light">
                          Live from 150+ sources
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/signals"
                      className="px-3 py-1.5 bg-gradient-to-r from-slate-600 to-slate-500 hover:from-slate-500 hover:to-slate-400 border border-slate-500/20 rounded-lg text-white text-xs font-semibold transition-all duration-200 shadow-lg shadow-slate-500/20"
                    >
                      View All
                    </Link>
                  </div>

                  {loadingTweets ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        <p className="text-white/50 text-sm font-light">
                          Loading signals...
                        </p>
                      </div>
                    </div>
                  ) : tweets.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-white/50 text-sm mb-2 font-light">
                          No tweets yet
                        </p>
                        <p className="text-white/40 text-xs font-light">
                          Run scraper to fetch data
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      {tweets.map((tweet) => (
                        <div
                          key={tweet.id}
                          className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-slate-500/20 to-slate-600/20 rounded-full flex items-center justify-center flex-shrink-0 border border-slate-500/20">
                              <span className="text-white text-xs font-black">
                                {tweet.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white text-sm font-semibold truncate tracking-tight">
                                  @{tweet.username}
                                </span>
                                {tweet.verified && (
                                  <span className="text-blue-400 text-xs">
                                    ✓
                                  </span>
                                )}
                              </div>
                              <span className="text-white/40 text-xs font-light">
                                {tweet.time}
                              </span>
                            </div>
                          </div>
                          <p className="text-white/70 text-sm leading-relaxed mb-2 line-clamp-4 group-hover:line-clamp-none font-light">
                            {tweet.text}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-white/40 font-light">
                            <span className="flex items-center gap-1">
                              <span>💬</span>
                              {tweet.replies.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <span>🔄</span>
                              {tweet.retweets.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <span>❤️</span>
                              {tweet.likes.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs text-white/40 font-light">
                      <span>Updates: Twice daily</span>
                      <span className="text-purple-400 font-medium">
                        {tweets.length} signals
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
