"use client";

import Link from "next/link";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { isConnected } = useAccount();
  const router = useRouter();
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
          <ConnectButton />
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
