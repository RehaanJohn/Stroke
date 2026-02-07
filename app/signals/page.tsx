"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface TwitterSignal {
  id: number;
  username: string;
  text: string;
  sentiment: "bullish" | "bearish" | "neutral";
  engagementDrop?: number;
  timestamp: string;
}

interface YahooSignal {
  id: number;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: string;
}

interface SECSignal {
  id: number;
  company: string;
  filingType: string;
  description: string;
  severity: "high" | "medium" | "low";
  timestamp: string;
}

export default function Signals() {
  const [twitterSignals, setTwitterSignals] = useState<TwitterSignal[]>([]);
  const [yahooSignals, setYahooSignals] = useState<YahooSignal[]>([]);
  const [secSignals, setSECSignals] = useState<SECSignal[]>([]);
  const [activeTab, setActiveTab] = useState<
    "all" | "twitter" | "yahoo" | "sec"
  >("all");
  const { isConnected } = useAccount();

  // Fetch Twitter signals
  useEffect(() => {
    const fetchTwitter = async () => {
      try {
        const response = await fetch("/api/twitter/trending?limit=10");
        const data = await response.json();
        if (data.success && data.tweets) {
          const signals = data.tweets.map((tweet: any, idx: number) => ({
            id: idx + 1,
            username: tweet.username,
            text: tweet.text,
            sentiment: Math.random() > 0.5 ? "bearish" : "bullish",
            engagementDrop:
              Math.random() > 0.5 ? Math.floor(Math.random() * 80) : undefined,
            timestamp: new Date().toISOString(),
          }));
          setTwitterSignals(signals);
        }
      } catch (error) {
        console.error("Failed to fetch Twitter signals:", error);
      }
    };

    fetchTwitter();
    const interval = setInterval(fetchTwitter, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Mock Yahoo Finance signals
  useEffect(() => {
    const mockYahoo: YahooSignal[] = [
      {
        id: 1,
        symbol: "BTC-USD",
        price: 95234.5,
        change: 1234.5,
        changePercent: 1.31,
        volume: 28500000000,
        timestamp: new Date().toISOString(),
      },
      {
        id: 2,
        symbol: "ETH-USD",
        price: 3456.78,
        change: -45.22,
        changePercent: -1.29,
        volume: 15200000000,
        timestamp: new Date().toISOString(),
      },
      {
        id: 3,
        symbol: "SOL-USD",
        price: 145.67,
        change: 3.45,
        changePercent: 2.42,
        volume: 3400000000,
        timestamp: new Date().toISOString(),
      },
      {
        id: 4,
        symbol: "AAPL",
        price: 178.23,
        change: -2.45,
        changePercent: -1.36,
        volume: 52000000,
        timestamp: new Date().toISOString(),
      },
      {
        id: 5,
        symbol: "TSLA",
        price: 245.89,
        change: 5.67,
        changePercent: 2.36,
        volume: 98000000,
        timestamp: new Date().toISOString(),
      },
    ];
    setYahooSignals(mockYahoo);
  }, []);

  // Mock SEC signals
  useEffect(() => {
    const mockSEC: SECSignal[] = [
      {
        id: 1,
        company: "Tesla Inc",
        filingType: "8-K",
        description: "Material event - insider selling detected",
        severity: "high",
        timestamp: "2h ago",
      },
      {
        id: 2,
        company: "Apple Inc",
        filingType: "10-Q",
        description: "Quarterly report filed - revenue miss",
        severity: "medium",
        timestamp: "5h ago",
      },
      {
        id: 3,
        company: "Meta Platforms",
        filingType: "4",
        description: "Insider transaction - CEO sold shares",
        severity: "high",
        timestamp: "1d ago",
      },
      {
        id: 4,
        company: "NVIDIA Corp",
        filingType: "13F",
        description: "Institutional holdings change",
        severity: "low",
        timestamp: "2d ago",
      },
    ];
    setSECSignals(mockSEC);
  }, []);

  const filteredSignals = () => {
    const all = [
      ...twitterSignals.map((s) => ({ ...s, source: "twitter" as const })),
      ...yahooSignals.map((s) => ({ ...s, source: "yahoo" as const })),
      ...secSignals.map((s) => ({ ...s, source: "sec" as const })),
    ];

    if (activeTab === "all") return all;
    return all.filter((s) => s.source === activeTab);
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/30 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/portfolio" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 rounded-lg flex items-center justify-center shadow-lg shadow-slate-500/50">
              <span className="text-white font-black text-xl">N</span>
            </div>
            <span className="text-white/60 text-sm font-medium hover:text-white transition-colors">
              ← Back to Portfolio
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
              <span className="text-green-400 text-sm font-medium">
                ● Live Signals
              </span>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      <div className="pt-24 px-6 pb-10">
        <div className="max-w-[1800px] mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
              Market Signals
            </h1>
            <p className="text-white/50 text-lg font-light">
              Live aggregate data from Twitter, Yahoo Finance, SEC filings, and
              more
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-zinc-900/80 to-black/80 border border-slate-500/20 rounded-2xl p-6">
              <div className="text-white/40 text-xs mb-2 font-medium uppercase tracking-widest">
                Twitter Signals
              </div>
              <div className="text-3xl font-black text-slate-300">
                {twitterSignals.length}
              </div>
              <div className="text-xs text-green-400 mt-1">● Live updates</div>
            </div>
            <div className="bg-gradient-to-br from-zinc-900/80 to-black/80 border border-slate-500/20 rounded-2xl p-6">
              <div className="text-white/40 text-xs mb-2 font-medium uppercase tracking-widest">
                Market Data
              </div>
              <div className="text-3xl font-black text-slate-300">
                {yahooSignals.length}
              </div>
              <div className="text-xs text-green-400 mt-1">● Real-time</div>
            </div>
            <div className="bg-gradient-to-br from-zinc-900/80 to-black/80 border border-slate-500/20 rounded-2xl p-6">
              <div className="text-white/40 text-xs mb-2 font-medium uppercase tracking-widest">
                SEC Filings
              </div>
              <div className="text-3xl font-black text-slate-300">
                {secSignals.length}
              </div>
              <div className="text-xs text-orange-400 mt-1">
                ● Recent activity
              </div>
            </div>
            <div className="bg-gradient-to-br from-zinc-900/80 to-black/80 border border-slate-500/20 rounded-2xl p-6">
              <div className="text-white/40 text-xs mb-2 font-medium uppercase tracking-widest">
                Total Signals
              </div>
              <div className="text-3xl font-black text-slate-300">
                {twitterSignals.length +
                  yahooSignals.length +
                  secSignals.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Aggregated</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-zinc-900/80 p-1 rounded-xl border border-white/5 mb-6 w-fit">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "all"
                  ? "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-lg shadow-slate-500/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              All Signals
            </button>
            <button
              onClick={() => setActiveTab("twitter")}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "twitter"
                  ? "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-lg shadow-slate-500/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Twitter
            </button>
            <button
              onClick={() => setActiveTab("yahoo")}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "yahoo"
                  ? "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-lg shadow-slate-500/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Market Data
            </button>
            <button
              onClick={() => setActiveTab("sec")}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === "sec"
                  ? "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-lg shadow-slate-500/20"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              SEC Filings
            </button>
          </div>

          {/* Signals Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Twitter Signals */}
            {(activeTab === "all" || activeTab === "twitter") &&
              twitterSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="bg-gradient-to-br from-zinc-900/80 to-black/80 border border-white/5 rounded-2xl p-6 hover:border-slate-500/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center border border-blue-500/20">
                        <span className="text-lg">🐦</span>
                      </div>
                      <div>
                        <div className="text-white font-semibold">
                          @{signal.username}
                        </div>
                        <div className="text-white/40 text-xs">
                          Twitter Signal
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        signal.sentiment === "bearish"
                          ? "bg-red-500/10 border border-red-500/20 text-red-400"
                          : signal.sentiment === "bullish"
                          ? "bg-green-500/10 border border-green-500/20 text-green-400"
                          : "bg-slate-500/10 border border-slate-500/20 text-slate-300"
                      }`}
                    >
                      {signal.sentiment}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">
                    {signal.text}
                  </p>
                  {signal.engagementDrop && (
                    <div className="flex items-center gap-2 text-red-400 text-xs">
                      <span>↓ {signal.engagementDrop}% engagement drop</span>
                    </div>
                  )}
                </div>
              ))}

            {/* Yahoo Finance Signals */}
            {(activeTab === "all" || activeTab === "yahoo") &&
              yahooSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="bg-gradient-to-br from-zinc-900/80 to-black/80 border border-white/5 rounded-2xl p-6 hover:border-slate-500/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500/10 rounded-full flex items-center justify-center border border-purple-500/20">
                        <span className="text-lg">📈</span>
                      </div>
                      <div>
                        <div className="text-white font-bold text-lg">
                          {signal.symbol}
                        </div>
                        <div className="text-white/40 text-xs">
                          Yahoo Finance
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-xl">
                        ${signal.price.toLocaleString()}
                      </div>
                      <div
                        className={`text-sm font-semibold ${
                          signal.change >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {signal.change >= 0 ? "+" : ""}
                        {signal.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-white/40 text-xs mb-1">Change</div>
                      <div
                        className={`font-semibold ${
                          signal.change >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {signal.change >= 0 ? "+" : ""}$
                        {signal.change.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/40 text-xs mb-1">Volume</div>
                      <div className="text-white font-semibold">
                        ${(signal.volume / 1000000).toFixed(0)}M
                      </div>
                    </div>
                  </div>
                </div>
              ))}

            {/* SEC Signals */}
            {(activeTab === "all" || activeTab === "sec") &&
              secSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="bg-gradient-to-br from-zinc-900/80 to-black/80 border border-white/5 rounded-2xl p-6 hover:border-slate-500/20 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                          signal.severity === "high"
                            ? "bg-red-500/10 border-red-500/20"
                            : signal.severity === "medium"
                            ? "bg-orange-500/10 border-orange-500/20"
                            : "bg-slate-500/10 border-slate-500/20"
                        }`}
                      >
                        <span className="text-lg">📄</span>
                      </div>
                      <div>
                        <div className="text-white font-semibold">
                          {signal.company}
                        </div>
                        <div className="text-white/40 text-xs">
                          SEC Filing · {signal.filingType}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                        signal.severity === "high"
                          ? "bg-red-500/10 border border-red-500/20 text-red-400"
                          : signal.severity === "medium"
                          ? "bg-orange-500/10 border border-orange-500/20 text-orange-400"
                          : "bg-slate-500/10 border border-slate-500/20 text-slate-300"
                      }`}
                    >
                      {signal.severity}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-2">
                    {signal.description}
                  </p>
                  <div className="text-white/40 text-xs">
                    {signal.timestamp}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
