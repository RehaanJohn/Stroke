"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";

interface LogEntry {
  id: number;
  timestamp: string;
  type: string;
  message: string;
  severity: string;
  metadata?: any;
}

interface LogStats {
  total_logs: number;
  by_type: {
    signal: number;
    execution: number;
    analysis: number;
    routing: number;
    monitor: number;
  };
  by_severity: {
    critical: number;
    high: number;
    warning: number;
    success: number;
    info: number;
  };
}

export default function Logs() {
  const [activeTab, setActiveTab] = useState<
    "all" | "signal" | "execution" | "analysis"
  >("all");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { isConnected, address } = useAccount();
  const router = useRouter();

  // Fetch logs from API
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const params = new URLSearchParams();
        if (activeTab !== "all") {
          params.append("type", activeTab);
        }

        const response = await fetch(`/api/logs?${params.toString()}`);
        const data = await response.json();
        setLogs(data.logs || []);
      } catch (error) {
        console.error("Failed to fetch logs:", error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
    // Poll every 2 seconds for real-time updates
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/logs/stats");
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };

    fetchStats();
    // Update stats every 5 seconds
    const interval = setInterval(fetchStats, 5000);
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

  const filteredLogs = logs;

  return (
    <div className="min-h-screen bg-black">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/30 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/50">
              <span className="text-white font-black text-xl">N</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/portfolio"
              className="px-4 py-2 text-white/60 hover:text-white transition-colors text-sm font-medium"
            >
              ← Back to Portfolio
            </Link>
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
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-5xl font-black text-white mb-4 tracking-tight">
              Agent Logs
            </h1>
            <p className="text-white/50 text-lg font-light">
              Real-time monitoring of autonomous trading agent activity
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <div className="flex gap-3 bg-zinc-900/80 p-2 rounded-xl border border-white/5 w-fit">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === "all"
                    ? "bg-gradient-to-r from-slate-600 to-slate-500 text-white shadow-lg shadow-slate-500/20"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                All Logs
              </button>
              <button
                onClick={() => setActiveTab("signal")}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === "signal"
                    ? "bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg shadow-orange-500/20"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                📊 Signals
              </button>
              <button
                onClick={() => setActiveTab("execution")}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === "execution"
                    ? "bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                ⚡ Execution
              </button>
              <button
                onClick={() => setActiveTab("analysis")}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  activeTab === "analysis"
                    ? "bg-gradient-to-r from-purple-600 to-purple-500 text-white shadow-lg shadow-purple-500/20"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                🤖 Analysis
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <div className="text-white/50 text-xs font-medium tracking-widest uppercase mb-2">
                Total Logs
              </div>
              <div className="text-4xl font-black text-white tracking-tight">
                {stats?.total || filteredLogs.length}
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 backdrop-blur-xl border border-red-500/20 rounded-2xl p-6">
              <div className="text-white/50 text-xs font-medium tracking-widest uppercase mb-2">
                Critical Events
              </div>
              <div className="text-4xl font-black text-red-400 tracking-tight">
                {stats?.by_severity?.critical ||
                  filteredLogs.filter((l) => l.severity === "critical").length}
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 backdrop-blur-xl border border-orange-500/20 rounded-2xl p-6">
              <div className="text-white/50 text-xs font-medium tracking-widest uppercase mb-2">
                Signals Detected
              </div>
              <div className="text-4xl font-black text-orange-400 tracking-tight">
                {stats?.by_type?.signal ||
                  filteredLogs.filter((l) => l.type === "signal").length}
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6">
              <div className="text-white/50 text-xs font-medium tracking-widest uppercase mb-2">
                Executions
              </div>
              <div className="text-4xl font-black text-green-400 tracking-tight">
                {stats?.by_type?.execution ||
                  filteredLogs.filter((l) => l.type === "execution").length}
              </div>
            </div>
          </div>

          {/* Logs List */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-purple-500/30 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white/50 text-sm font-light">
                    Loading logs...
                  </p>
                </div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <p className="text-white/50 text-lg mb-2 font-light">
                    No logs yet
                  </p>
                  <p className="text-white/40 text-sm font-light">
                    Run the live trading script to see real-time logs
                  </p>
                </div>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-5 rounded-xl border transition-all hover:bg-white/5 ${
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
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1 text-2xl">
                      {log.type === "signal" && "📊"}
                      {log.type === "execution" && "⚡"}
                      {log.type === "analysis" && "🤖"}
                      {log.type === "routing" && "🌉"}
                      {log.type === "monitor" && "👁️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2 py-1 rounded-lg text-xs font-semibold uppercase tracking-wide ${
                            log.type === "signal"
                              ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                              : log.type === "execution"
                              ? "bg-green-500/20 text-green-300 border border-green-500/30"
                              : log.type === "analysis"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                              : log.type === "routing"
                              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              : "bg-slate-500/20 text-slate-300 border border-slate-500/30"
                          }`}
                        >
                          {log.type}
                        </span>
                        <span className="text-xs text-white/40 font-light font-mono">
                          {log.timestamp}
                        </span>
                        {log.severity === "critical" && (
                          <span className="px-2 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-base font-medium tracking-tight leading-relaxed ${
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
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
            <div className="text-sm text-white/40 font-light">
              Last updated: Just now • Auto-refresh: ON
            </div>
            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-white/60 hover:text-white text-sm font-medium transition-all">
              Clear all logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
