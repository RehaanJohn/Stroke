#!/usr/bin/env python3
"""
Run live trading WITH API server in same process
This ensures logs are shared between the trading logic and the API
"""

import asyncio
import threading
import os
from dotenv import load_dotenv
from agent.api_server import app
import uvicorn

# Load environment
load_dotenv()

# Import live trading dependencies
from agent.live_data_ingestion import LiveDataIngestion
from agent.orchestration import OrchestrationEngine
from agent.contract_executor import ContractExecutor
from agent.log_manager import log_signal, log_execution, log_analysis, log_monitor
from agent.data_ingestion import TokenSignal
from datetime import datetime

def run_api_server():
    """Run FastAPI server in background thread"""
    print("🚀 Starting API server on http://localhost:8000")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="error"  # Reduce noise
    )

async def run_live_system():
    """Run one complete trading cycle"""
    
    log_monitor("Starting NEXUS trading cycle", severity="info")
    
    print(f"\n⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    # STEP 1: Fetch live data
    print("\n📡 STEP 1: FETCHING LIVE MARKET DATA")
    print("-" * 70)
    
    log_monitor("Fetching live market data from all sources...", severity="info")
    
    data_ingestion = LiveDataIngestion()
    live_signals = await data_ingestion.fetch_all_signals()
    
    if not live_signals:
        print("⚠️  No signals received")
        log_monitor("No signals received from data sources", severity="warning")
        return
    
    print(f"\n✅ Received {len(live_signals)} live signals")
    log_signal(f"Received {len(live_signals)} live signals from market", severity="success")
    
    # STEP 2: Orchestration
    print("\n🧠 STEP 2: RUNNING AI ANALYSIS")
    print("-" * 70)
    
    log_analysis("Initializing orchestration engine", severity="info")
    
    try:
        orchestration = OrchestrationEngine(
            tier1_mock=False,
            tier2_mock=True
        )
        
        # Convert signals
        for signal in live_signals[:10]:  # Limit to first 10 for speed
            token_signal = TokenSignal(
                token_address=signal.source,
                token_symbol=signal.token_symbol,
                chain="arbitrum",
                timestamp=signal.timestamp,
                tvl_change_24h=-30.0 if signal.sentiment == 'bearish' else 10.0,
                tvl_usd=1_000_000,
                liquidity_change_24h=-25.0 if signal.sentiment == 'bearish' else 5.0,
                holder_concentration_top10=75.0,
                insider_sells_24h=3 if signal.sentiment == 'bearish' else 0,
                insider_sell_volume_usd=300_000 if signal.sentiment == 'bearish' else 0,
                twitter_engagement_change_48h=-50.0 if signal.sentiment == 'bearish' else 20.0,
                twitter_mentions_24h=100,
                twitter_sentiment_score=-0.6 if signal.sentiment == 'bearish' else 0.3,
                influencer_silence_hours=12.0 if signal.sentiment == 'bearish' else 2.0,
                github_commits_7d=5,
                github_commit_change=-20.0 if signal.sentiment == 'bearish' else 10.0,
                dev_departures_30d=1 if signal.sentiment == 'bearish' else 0,
                recent_vote_type="inflation" if signal.sentiment == 'bearish' else "neutral",
                vote_passed=True if signal.sentiment == 'bearish' else False,
                price_change_24h=-20.0 if signal.sentiment == 'bearish' else 10.0,
                volume_24h_usd=1_000_000,
                market_cap_usd=5_000_000,
                category="crypto"
            )
            orchestration.signal_queue.append(token_signal)
        
        log_analysis(f"Tier 1 screening {len(live_signals)} signals", severity="info")
        flagged_tokens = orchestration.process_tier1_batch()
        
        if flagged_tokens:
            print(f"\n✅ Tier 1 flagged {len(flagged_tokens)} tokens")
            log_analysis(f"Tier 1 flagged {len(flagged_tokens)} tokens", severity="high")
            
            log_analysis(f"Tier 2 analyzing {len(flagged_tokens)} tokens", severity="info")
            trade_plans = orchestration.process_tier2_batch(flagged_tokens)
            
            if trade_plans:
                print(f"\n✅ Generated {len(trade_plans)} trade recommendations")
                log_analysis(f"Generated {len(trade_plans)} trade recommendations", severity="success")
                
                short_plans = [tp for tp in trade_plans if tp.decision == "SHORT"]
                if short_plans:
                    best_plan = max(short_plans, key=lambda x: x.confidence)
                    print(f"\n📊 Best opportunity: {best_plan.token_symbol} ({best_plan.confidence}%)")
                    
                    log_analysis(f"Best SHORT: {best_plan.token_symbol} ({best_plan.confidence}%)", severity="high")
                    
                    if best_plan.confidence >= 75:
                        print(f"\n💰 Executing trade...")
                        log_execution(f"Executing SHORT on {best_plan.token_symbol}", severity="info")
                        
                        executor = ContractExecutor()
                        tx_hash = await executor.execute_trade(best_plan)
                        
                        print(f"\n✅ Transaction: {tx_hash}")
                        log_execution(f"✅ Trade executed: {tx_hash}", severity="success")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        log_execution(f"ERROR: {str(e)[:200]}", severity="critical")
    
    print("\n" + "="*70)
    print("✅ Cycle complete\n")
    log_monitor("Trading cycle completed", severity="success")

async def main():
    """Run both API server and trading system"""
    # Start API server in background thread
    api_thread = threading.Thread(target=run_api_server, daemon=True)
    api_thread.start()
    
    # Wait for API to start
    await asyncio.sleep(2)
    
    print("✅ API server running")
    print("🎯 Starting trading system...\n")
    
    # Run trading system
    await run_live_system()
    
    print("\n✅ Trading cycle complete")
    print("💡 API server still running - check http://localhost:3000/logs for live updates")
    print("Press Ctrl+C to stop")
    
    # Keep running for API access
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")

if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════════╗
║          NEXUS - UNIFIED API + TRADING SYSTEM                 ║
║                                                               ║
║  This runs BOTH the API server and trading script            ║
║  in the same process so logs are shared!                     ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    asyncio.run(main())
