"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";

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
    signals: ["Insider Dump", "Twitter Silence", "LP Removal"]
  },
  {
    id: 2,
    symbol: "$DEFIPROTOCOL",
    chain: "Ethereum",
    entryPrice: 12.50,
    currentPrice: 9.80,
    size: 1200,
    profitLoss: 3240,
    profitLossPercent: -21.60,
    confidence: 88,
    openedAt: "1d ago",
    status: "active",
    signals: ["TVL Decline", "Dev Exit", "Governance Vote"]
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
    signals: ["Coordinated Sells", "Engagement Drop"]
  },
  {
    id: 4,
    symbol: "$RENDER",
    chain: "Optimism",
    entryPrice: 8.20,
    currentPrice: 8.45,
    size: 800,
    profitLoss: -200,
    profitLossPercent: 3.05,
    confidence: 65,
    openedAt: "12h ago",
    status: "active",
    signals: ["TradFi Correlation", "Sector Rotation"]
  }
];

// Mock agent logs
const mockLogs = [
  {
    id: 1,
    timestamp: "2m ago",
    type: "signal",
    message: "Twitter engagement for @CryptoKing dropped 72% (25 pts)",
    severity: "high"
  },
  {
    id: 2,
    timestamp: "5m ago",
    type: "execution",
    message: "Short position opened: $SCAMCOIN on Base",
    severity: "success"
  },
  {
    id: 3,
    timestamp: "8m ago",
    type: "analysis",
    message: "Confidence score: 95/100 - EXECUTE SHORT",
    severity: "high"
  },
  {
    id: 4,
    timestamp: "12m ago",
    type: "signal",
    message: "LP tokens burned - 30% liquidity removed (35 pts)",
    severity: "high"
  },
  {
    id: 5,
    timestamp: "15m ago",
    type: "routing",
    message: "LI.FI route: ARB → Base via Stargate (est. 3min)",
    severity: "info"
  },
  {
    id: 6,
    timestamp: "18m ago",
    type: "signal",
    message: "Deployer wallet sent 100M tokens to DEX (40 pts)",
    severity: "critical"
  },
  {
    id: 7,
    timestamp: "25m ago",
    type: "monitor",
    message: "Scanning 247 tokens across 4 chains...",
    severity: "info"
  },
  {
    id: 8,
    timestamp: "32m ago",
    type: "execution",
    message: "Take-profit hit: $MEMECOIN TP2 at -67%",
    severity: "success"
  },
  {
    id: 9,
    timestamp: "45m ago",
    type: "analysis",
    message: "$DEFIPROTOCOL governance vote passed - bearish",
    severity: "warning"
  },
  {
    id: 10,
    timestamp: "1h ago",
    type: "signal",
    message: "TVL dropped 15% in 6 hours for $DEFIPROTOCOL",
    severity: "warning"
  }
];

interface Tweet {
  id: number;
  username: string;
  text: string;
  time: string;
  likes: string;
  retweets: string;
  replies: string;
  scrapedAt: string;
}

export default function Portfolio() {
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(true);
  const { isConnected, address } = useAccount();
  const router = useRouter();

  // Fetch tweets on mount and every 12 hours
  useEffect(() => {
    const fetchTweets = async () => {
      try {
        setLoadingTweets(true);
        const response = await fetch('/api/twitter/trending?limit=30');
        const data = await response.json();
        if (data.success && data.tweets) {
          setTweets(data.tweets);
        }
      } catch (error) {
        console.error('Failed to fetch tweets:', error);
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
      router.push('/');
    }
  }, [isConnected, router]);

  // Show loading state while checking connection
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Checking wallet connection...</p>
        </div>
      </div>
    );
  }

  const totalProfitLoss = mockPositions.reduce((sum, pos) => sum + pos.profitLoss, 0);
  const activePositions = mockPositions.filter(p => p.status === "active").length;
  const avgConfidence = Math.round(
    mockPositions.filter(p => p.status === "active")
      .reduce((sum, pos) => sum + pos.confidence, 0) / activePositions
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <span className="text-white font-bold text-xl">NEXUS</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
              <span className="text-gray-300 text-xs font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
            </div>
            <div className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
              <span className="text-green-400 text-sm font-medium">● Agent Active</span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      <div className="pt-24 px-6 pb-10">
        <div className="max-w-[1800px] mx-auto">
          {/* Header Stats */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-6">Portfolio Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
                <div className="text-gray-400 text-sm mb-1">Total P&L</div>
                <div className={`text-3xl font-bold ${totalProfitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalProfitLoss >= 0 ? '+' : ''}{totalProfitLoss.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </div>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
                <div className="text-gray-400 text-sm mb-1">Active Positions</div>
                <div className="text-3xl font-bold text-white">{activePositions}</div>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
                <div className="text-gray-400 text-sm mb-1">Avg Confidence</div>
                <div className="text-3xl font-bold text-purple-400">{avgConfidence}%</div>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-5">
                <div className="text-gray-400 text-sm mb-1">Chains Monitored</div>
                <div className="text-3xl font-bold text-white">4</div>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px_320px] gap-6">
            {/* Positions List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">Active Shorts</h2>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                    All
                  </button>
                  <button className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
                    Active
                  </button>
                  <button className="px-4 py-2 bg-white/5 text-gray-400 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors">
                    Closed
                  </button>
                </div>
              </div>

              {mockPositions.map((position) => (
                <div
                  key={position.id}
                  onClick={() => setSelectedPosition(position.id)}
                  className={`bg-white/5 backdrop-blur-lg border rounded-xl p-6 cursor-pointer transition-all hover:bg-white/10 ${
                    selectedPosition === position.id ? 'border-purple-500' : 'border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center border border-purple-500/30">
                        <span className="text-2xl">📉</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-white">{position.symbol}</h3>
                          <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-400 text-xs font-medium">
                            {position.chain}
                          </span>
                          {position.status === 'active' ? (
                            <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-400 text-xs font-medium">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-500/20 border border-gray-500/30 rounded text-gray-400 text-xs font-medium">
                              CLOSED
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">Opened {position.openedAt}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${position.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.profitLoss >= 0 ? '+' : ''}{position.profitLoss.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </div>
                      <div className={`text-sm ${position.profitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {position.profitLossPercent >= 0 ? '+' : ''}{position.profitLossPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Entry Price</div>
                      <div className="text-white font-medium">${position.entryPrice}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Current Price</div>
                      <div className="text-white font-medium">${position.currentPrice}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Position Size</div>
                      <div className="text-white font-medium">{position.size.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-1">Confidence</div>
                      <div className="text-purple-400 font-medium">{position.confidence}%</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {position.signals.map((signal, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-xs font-medium"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Agent Logs Sidebar */}
            <div className="lg:sticky lg:top-24 h-fit">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 h-[calc(100vh-120px)] flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Agent Logs</h2>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                  {mockLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border transition-all hover:bg-white/5 ${
                        log.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                        log.severity === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                        log.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
                        log.severity === 'success' ? 'bg-green-500/10 border-green-500/30' :
                        'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-1">
                          {log.type === 'signal' && '📊'}
                          {log.type === 'execution' && '⚡'}
                          {log.type === 'analysis' && '🤖'}
                          {log.type === 'routing' && '🌉'}
                          {log.type === 'monitor' && '👁️'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-gray-400 mb-1">{log.timestamp}</div>
                          <div className={`text-sm font-medium ${
                            log.severity === 'critical' ? 'text-red-300' :
                            log.severity === 'high' ? 'text-orange-300' :
                            log.severity === 'warning' ? 'text-yellow-300' :
                            log.severity === 'success' ? 'text-green-300' :
                            'text-gray-300'
                          }`}>
                            {log.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Last updated: Just now</span>
                    <button className="text-purple-400 hover:text-purple-300">Clear logs</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Twitter Feed Sidebar */}
            <div className="lg:sticky lg:top-24 h-fit">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 h-[calc(100vh-120px)] flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Market Signals</h2>
                    <p className="text-xs text-gray-400">Live from 150+ sources</p>
                  </div>
                </div>

                {loadingTweets ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-gray-400 text-sm">Loading signals...</p>
                    </div>
                  </div>
                ) : tweets.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-gray-400 text-sm mb-2">No tweets yet</p>
                      <p className="text-gray-500 text-xs">Run scraper to fetch data</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {tweets.map((tweet) => (
                      <div
                        key={tweet.id}
                        className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{tweet.username.charAt(0).toUpperCase()}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white text-sm font-medium truncate">@{tweet.username}</span>
                              {['elonmusk', 'VitalikButerin', 'saylor', 'cz_binance'].includes(tweet.username) && (
                                <span className="text-xs">✓</span>
                              )}
                            </div>
                            <span className="text-gray-400 text-xs">{tweet.time}</span>
                          </div>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed mb-2 line-clamp-4 group-hover:line-clamp-none">
                          {tweet.text}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <span>💬</span>{tweet.replies}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>🔄</span>{tweet.retweets}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>❤️</span>{tweet.likes}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Updates: Twice daily</span>
                    <span className="text-purple-400">{tweets.length} signals</span>
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
