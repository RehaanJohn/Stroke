"use client";

import Link from "next/link";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

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
  const { isConnected } = useAccount();
  const router = useRouter();
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loadingTweets, setLoadingTweets] = useState(true);

  // Fetch latest tweets
  useEffect(() => {
    const fetchTweets = async () => {
      try {
        setLoadingTweets(true);
        const response = await fetch('/api/twitter/trending?limit=10');
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
    const interval = setInterval(fetchTweets, 30 * 60 * 1000); // Refresh every 30 mins
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">N</span>
            </div>
            <span className="text-white font-bold text-xl">NEXUS</span>
          </div>
          <div className="flex items-center gap-4">
            {/* Twitter Feed Icon */}
            <Link 
              href="#signals" 
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group"
            >
              <div className="w-5 h-5 bg-black rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span className="text-white text-sm font-medium group-hover:text-purple-300 transition-colors">
                Market Signals
              </span>
              <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-300 text-xs font-bold">
                {loadingTweets ? '...' : tweets.length}
              </span>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Hero Content */}
          <div className="text-center mb-20">
            <div className="inline-block mb-4 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full">
              <span className="text-purple-300 text-sm font-medium">🎯 ETHGlobal HackMoney 2025</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Cross-Chain<br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Autonomous Shorting
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              Detect market manipulation, track social sentiment, monitor financial events — 
              then short across chains before the crash hits.
            </p>
            {isConnected ? (
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/50 transition-all transform hover:scale-105"
              >
                Launch Dashboard
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ConnectButton />
                <p className="text-sm text-gray-400">Connect your wallet to access the dashboard</p>
              </div>
            )}
          </div>

          {/* Visual Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {[
              { label: "Multi-Signal Fusion", value: "5+", desc: "Signal categories" },
              { label: "Cross-Chain", value: "4+", desc: "EVM chains supported" },
              { label: "Win Rate", value: "65%+", desc: "Target accuracy" }
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all">
                <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-white font-semibold mb-1">{stat.label}</div>
                <div className="text-gray-400 text-sm">{stat.desc}</div>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="mb-20">
            <h2 className="text-4xl font-bold text-white text-center mb-12">How NEXUS Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  step: "01",
                  title: "Signal Collection",
                  desc: "Monitor on-chain data, Twitter engagement, TVL changes, and governance votes across chains",
                  icon: "📊"
                },
                {
                  step: "02",
                  title: "AI Analysis",
                  desc: "Aggregate signals into weighted confidence scores using multi-factor analysis",
                  icon: "🤖"
                },
                {
                  step: "03",
                  title: "Cross-Chain Routing",
                  desc: "Execute shorts via LI.FI on optimal chains with best liquidity and lowest costs",
                  icon: "🌉"
                },
                {
                  step: "04",
                  title: "Position Management",
                  desc: "Automated take-profits, stop-losses, and real-time monitoring",
                  icon: "🎯"
                }
              ].map((item, i) => (
                <div key={i} className="relative group">
                  <div className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-lg border border-white/10 rounded-2xl p-6 h-full hover:border-purple-500/50 transition-all">
                    <div className="text-5xl mb-4">{item.icon}</div>
                    <div className="text-purple-400 font-mono text-sm mb-2">{item.step}</div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-gradient-to-r from-purple-500 to-transparent"></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            {[
              {
                title: "Twitter Engagement Oracle",
                desc: "Track influencer activity, follower engagement, and sentiment shifts to detect rug-pulls before they happen",
                icon: "🐦"
              },
              {
                title: "Multi-Chain Execution",
                desc: "Route shorts to chains with optimal liquidity via LI.FI SDK across Ethereum, Arbitrum, Base, and Optimism",
                icon: "⛓️"
              },
              {
                title: "Real-Time Monitoring",
                desc: "Monitor wallet movements, TVL changes, governance votes, and protocol health metrics 24/7",
                icon: "👁️"
              },
              {
                title: "Automated Risk Management",
                desc: "Layered take-profits, intelligent stop-losses, and position sizing based on confidence scores",
                icon: "🛡️"
              }
            ].map((feature, i) => (
              <div key={i} className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-lg border border-white/10 rounded-2xl p-8 hover:border-purple-500/50 transition-all">
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>

          {/* Live Market Signals Section */}
          <div id="signals" className="mb-20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
                <h2 className="text-4xl font-bold text-white">Live Market Signals</h2>
              </div>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Real-time updates from 150+ sources including regulators, institutions, political figures, and on-chain trackers
              </p>
            </div>

            {loadingTweets ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading signals...</p>
                </div>
              </div>
            ) : tweets.length === 0 ? (
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">📡</div>
                <p className="text-gray-400 mb-2">No signals yet</p>
                <p className="text-gray-500 text-sm">Run the scraper to fetch market-moving data</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tweets.map((tweet) => (
                  <div
                    key={tweet.id}
                    className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-lg border border-white/10 rounded-xl p-5 hover:border-purple-500/50 transition-all group"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-bold">{tweet.username.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-semibold truncate">@{tweet.username}</span>
                          {['elonmusk', 'VitalikButerin', 'saylor', 'cz_binance', 'SECgov', 'federalreserve', 'WhiteHouse'].includes(tweet.username) && (
                            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          )}
                        </div>
                        <span className="text-gray-400 text-xs">{tweet.time}</span>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed mb-3 line-clamp-3 group-hover:line-clamp-none">
                      {tweet.text}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
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
            
            <div className="text-center mt-8">
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-all"
              >
                View All Signals in Dashboard
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-3xl p-12">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Start Shorting?</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Access the dashboard to view active positions, monitor signal confidence, and track autonomous trading decisions in real-time.
            </p>
            {isConnected ? (
              <Link
                href="/portfolio"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-900 rounded-full font-semibold text-lg hover:shadow-2xl hover:shadow-white/50 transition-all transform hover:scale-105"
              >
                Open Portfolio Dashboard
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button
                    onClick={openConnectModal}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-white text-purple-900 rounded-full font-semibold text-lg hover:shadow-2xl hover:shadow-white/50 transition-all transform hover:scale-105"
                  >
                    Connect Wallet to Continue
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/20 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-gray-400">
          <p>Built for ETHGlobal HackMoney 2025 | LI.FI AI x Smart App Prize</p>
        </div>
      </footer>
    </div>
  );
}
