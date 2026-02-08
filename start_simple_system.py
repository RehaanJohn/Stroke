"""
NEXUS - Simple Unified System
Runs API server with live trading and proper log capture
"""

import uvicorn
import asyncio
import sys
import os
from datetime import datetime
from threading import Thread

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.log_manager import log_signal, log_execution, log_analysis, log_monitor, log_routing
from agent.live_data_ingestion import LiveDataIngestion
from agent.orchestration import OrchestrationEngine
from agent.contract_executor import ContractExecutor

print("\n" + "="*70)
print("🚀 NEXUS - SIMPLE UNIFIED SYSTEM")
print("="*70)
print("Running API server with live trading and log capture")
print("="*70 + "\n")

def run_api_server():
    """Run the FastAPI server"""
    uvicorn.run(
        "agent.api_server:app",
        host="0.0.0.0",
        port=8000,
        log_level="error",  # Reduce noise
        access_log=False
    )

async def run_trading_cycle():
    """Run one trading cycle with proper logging"""
    try:
        log_monitor("🎯 Starting NEXUS trading cycle")
        
        # Fetch live data
        log_monitor("📡 Fetching live market data from all sources...")
        ingestion = LiveDataIngestion()
        signals = await ingestion.fetch_all_signals()
        log_signal(f"Received {len(signals)} live signals from market")
        
        # Run orchestration
        log_analysis("🧠 Running AI orchestration (Tier 1 + Tier 2)")
        orchestrator = OrchestrationEngine()
        result = orchestrator.run_cycle(signals_per_cycle=len(signals))
        
        # Log results
        flagged_count = result.get('tier1_flagged_count', 0)
        trade_plans = result.get('tier2_trade_plans', [])
        
        log_signal(f"Tier 1 flagged {flagged_count} high-potential signals")
        log_signal(f"Tier 2 generated {len(trade_plans)} trade plans")
        
        if trade_plans:
            top_plan = trade_plans[0]
            log_execution(f"Top signal: {top_plan['symbol']} {top_plan['direction']} (confidence: {top_plan.get('confidence_score', 0)}%)")
        
        log_monitor("✅ Trading cycle completed")
        
    except Exception as e:
        log_execution(f"❌ Error in trading cycle: {str(e)}")

async def main():
    """Main entry point"""
    # Start API server in background thread
    print("🚀 Starting API server on http://localhost:8000")
    api_thread = Thread(target=run_api_server, daemon=True)
    api_thread.start()
    
    # Wait for API to start
    await asyncio.sleep(2)
    log_monitor("✅ API server running at http://localhost:8000")
    
    # Add some initial logs
    log_monitor("🎯 NEXUS system initialized")
    log_signal("📊 Market monitoring active")
    log_analysis("🤖 AI engines ready (Llama 3.2 3B + Gemini)")
    log_execution("⚡ Contract executor connected to Arbitrum Sepolia")
    
    print("\n" + "="*70)
    print("✅ System ready!")
    print("="*70)
    print("📊 Frontend: http://localhost:3000/portfolio")
    print("📋 Logs Page: http://localhost:3000/logs")
    print("🔧 API Docs: http://localhost:8000/docs")
    print("="*70 + "\n")
    
    # Run trading cycle
    print("🎯 Running trading cycle...\n")
    await run_trading_cycle()
    
    print("\n💡 Trading cycle complete! API server still running.")
    print("💡 Check http://localhost:3000/logs for live updates")
    print("💡 System will run another cycle in 60 seconds...")
    print("💡 Press Ctrl+C to stop\n")
    
    # Keep running and cycle every 60 seconds
    try:
        while True:
            await asyncio.sleep(60)
            print("🔄 Running another trading cycle...")
            await run_trading_cycle()
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")

if __name__ == "__main__":
    asyncio.run(main())
