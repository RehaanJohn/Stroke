"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import BlockchainMonitor from "./components/BlockchainMonitor";
import Orb from "./components/Orb";

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

export default function Home() {
  const [mounted, setMounted] = useState(false);
  
  // Only use wagmi hooks on client side
  const { isConnected } = useAccount();
  const router = useRouter();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch latest tweets
  useEffect(() => {
    const fetchTweets = async () => {
      try {
        setLoadingTweets(true);
        const response = await fetch("/api/twitter/trending?limit=10");
        const data = await response.json();
        if (data.success && data.tweets) {
          setTweets(data.tweets);
        }
      } catch (error) {
        console.error("Failed to fetch tweets:", error);
      } finally {
        setLoadingTweets(false);
      }
    };

    fetchTweets();
    const interval = setInterval(fetchTweets, 30 * 60 * 1000); // Refresh every 30 mins
    return () => clearInterval(interval);
  }, []);

  // Don't render until mounted to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading NEXUS...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated Orb Background */}
      <div className="fixed inset-0 z-0">
        <Orb
          hoverIntensity={2}
          rotateOnHover
          hue={280}
          forceHoverState={false}
          backgroundColor="#000000"
        />
      </div>

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="fixed top-0 w-full z-50 bg-black/30 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3"></div>
            <div className="flex items-center gap-4">
              {/* Twitter Feed Icon */}
              <Link
                href="#signals"
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all group backdrop-blur-sm"
              >
                <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center shadow-sm shadow-purple-500/50">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="text-white/90 text-sm font-medium group-hover:text-white transition-colors">
                  Signals
                </span>
                <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/20 rounded-full text-purple-300 text-xs font-semibold">
                  {loadingTweets ? "..." : tweets.length}
                </span>
              </Link>
              <ConnectButton />
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <main className="pt-48 pb-32 px-6">
          <div className="max-w-5xl mx-auto">
            {/* Hero Content */}
            <div className="text-center mb-40">
              <h1 className="text-6xl md:text-9xl font-black text-white mb-10 leading-none tracking-tight">
                Cross-Chain
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">
                  Autonomous Shorting
                </span>
              </h1>
              <p className="text-base text-white/50 mb-16 max-w-xl mx-auto font-light leading-relaxed">
                AI-powered market detection → Cross-chain execution → Automated
                profit taking
              </p>
              {isConnected ? (
                <Link
                  href="/portfolio"
                  className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-base hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
                >
                  Launch Dashboard
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
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              ) : (
                <ConnectButton />
              )}
            </div>

            {/* Visual Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
              {[
                {
                  label: "Multi-Signal",
                  value: "5+",
                  desc: "Signal categories",
                },
                { label: "Cross-Chain", value: "4+", desc: "EVM chains" },
                { label: "Win Rate", value: "65%+", desc: "Target accuracy" },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-10 hover:bg-white/10 transition-all"
                >
                  <div className="text-4xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                    {stat.value}
                  </div>
                  <div className="text-white font-semibold mb-1 tracking-tight text-sm">
                    {stat.label}
                  </div>
                  <div className="text-white/40 text-xs font-light">
                    {stat.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* How It Works */}
            <div className="mb-32">
              <h2 className="text-3xl font-black text-white text-center mb-20 tracking-tight">
                How It Works
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {[
                  {
                    step: "01",
                    title: "Signal Collection",
                    desc: "Monitor on-chain data, social sentiment, and market events",
                  },
                  {
                    step: "02",
                    title: "AI Analysis",
                    desc: "Multi-factor analysis with weighted confidence scoring",
                  },
                  {
                    step: "03",
                    title: "Cross-Chain Routing",
                    desc: "Execute via GMX + LI.FI with optimal liquidity routing",
                  },
                  {
                    step: "04",
                    title: "Position Management",
                    desc: "Automated TP/SL with real-time monitoring",
                  },
                ].map((item, i) => (
                  <div key={i} className="relative group">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-8 h-full hover:border-purple-500/30 transition-all">
                      <div className="text-purple-400/60 font-mono text-xs mb-4 font-semibold">
                        {item.step}
                      </div>
                      <h3 className="text-base font-bold text-white mb-3 tracking-tight">
                        {item.title}
                      </h3>
                      <p className="text-white/50 text-sm leading-relaxed font-light">
                        {item.desc}
                      </p>
                    </div>
                    {i < 3 && (
                      <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-px bg-gradient-to-r from-purple-500/20 to-transparent"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Market Signals Section - Hidden by default */}
            {false && (
              <div id="signals" className="mb-20">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/50">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </div>
                    <h2 className="text-4xl font-black text-white tracking-tight">
                      Market Signals
                    </h2>
                  </div>
                  <p className="text-white/60 max-w-2xl mx-auto font-light">
                    Real-time updates from regulators, institutions, and
                    on-chain trackers
                  </p>
                </div>

                {loadingTweets ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-white/60 font-light">
                        Loading signals...
                      </p>
                    </div>
                  </div>
                ) : tweets.length === 0 ? (
                  <div className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-12 text-center">
                    <div className="text-5xl mb-4">📡</div>
                    <p className="text-white/80 mb-2 font-medium">
                      No signals yet
                    </p>
                    <p className="text-white/50 text-sm font-light">
                      Run the scraper to fetch market data
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tweets.map((tweet) => (
                      <div
                        key={tweet.id}
                        className="bg-white/5 backdrop-blur-xl border border-white/5 rounded-xl p-5 hover:border-purple-500/30 transition-all group"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
                            <span className="text-white text-sm font-bold">
                              {tweet.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold truncate tracking-tight">
                                @{tweet.username}
                              </span>
                              {[
                                "elonmusk",
                                "VitalikButerin",
                                "saylor",
                                "cz_binance",
                                "SECgov",
                                "federalreserve",
                                "WhiteHouse",
                              ].includes(tweet.username) && (
                                <svg
                                  className="w-4 h-4 text-purple-400 flex-shrink-0"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </div>
                            <span className="text-white/50 text-xs font-light">
                              {tweet.time}
                            </span>
                          </div>
                        </div>
                        <p className="text-white/80 text-sm leading-relaxed mb-3 line-clamp-3 group-hover:line-clamp-none font-light">
                          {tweet.text}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-white/50 font-light">
                          <span className="flex items-center gap-1">
                            💬 {tweet.replies}
                          </span>
                          <span className="flex items-center gap-1">
                            🔄 {tweet.retweets}
                          </span>
                          <span className="flex items-center gap-1">
                            ❤️ {tweet.likes}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-center mt-10">
                  <Link
                    href="/portfolio"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white transition-all backdrop-blur-sm font-medium"
                  >
                    View All Signals
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* CTA Section - Simplified */}
            <div className="text-center bg-white/5 backdrop-blur-xl border border-white/5 rounded-3xl p-16 max-w-3xl mx-auto">
              <h2 className="text-3xl font-black text-white mb-6 tracking-tight">
                Ready to Start
              </h2>
              <p className="text-white/60 mb-10 max-w-lg mx-auto font-light text-sm">
                Access the dashboard to view positions and monitor trading
              </p>
              {isConnected ? (
                <Link
                  href="/portfolio"
                  className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-base hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
                >
                  Open Dashboard
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
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
              ) : (
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button
                      onClick={openConnectModal}
                      className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-base hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
                    >
                      Connect Wallet
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
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </button>
                  )}
                </ConnectButton.Custom>
              )}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 bg-black/30 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-6 text-center text-white/40 font-light text-xs">
            <p>Powered by LI.FI · AI x Smart App</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
