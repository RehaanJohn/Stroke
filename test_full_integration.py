"""
Full Integration Demo: AI Agent → Blockchain Execution
Shows signals → Tier 1 → Tier 2 → Publish to SignalOracle → Execute shorts via NexusVault
"""

import logging
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add agent to path
sys.path.insert(0, str(Path(__file__).parent / 'agent'))

from agent.orchestration import OrchestrationEngine

# Load environment
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def main():
    print("\n" + "="*80)
    print("🚀 NEXUS FULL INTEGRATION DEMO")
    print("AI Agent → Blockchain Execution Pipeline")
    print("="*80 + "\n")
    
    # Initialize orchestration engine with blockchain enabled
    engine = OrchestrationEngine(
        batch_size=50,
        tier1_mock=False,  # Use real HuggingFace
        tier2_mock=True,   # Use mock Claude (or set False if you have API key)
        max_tier2_parallel=5
    )
    
    print("\n📊 STEP 1: INGEST SOCIAL SIGNALS")
    print("-" * 80)
    
    # Ingest social signals from Twitter
    social_count = engine.ingest_social_signals(min_urgency=7, limit=20)
    print(f"✅ Ingested {social_count} high-urgency social signals")
    
    print("\n🧠 STEP 2: TIER 1 SCREENING (HuggingFace)")
    print("-" * 80)
    
    # Process through Tier 1
    flagged = engine.process_tier1_batch()
    print(f"✅ Tier 1 flagged {len(flagged)} signals for deep analysis")
    
    if flagged:
        # Show top flagged signals
        print("\n📌 Top Flagged Signals:")
        for i, f in enumerate(flagged[:5], 1):
            print(f"{i}. Urgency {f.urgency}/10 - {f.reasoning[:80]}...")
    
    print("\n📡 STEP 3: PUBLISH SIGNALS TO BLOCKCHAIN")
    print("-" * 80)
    
    # Publish signals to SignalOracle
    if engine.blockchain.enabled:
        # Convert flagged signals to publishable format
        signals_to_publish = []
        for flag in flagged[:10]:  # Publish top 10
            signals_to_publish.append({
                'signal_type': 'REGULATORY_RISK',  # Map from flagged.reasoning
                'urgency': flag.urgency,
                'token': 'BTC',  # Extract from signal
                'chain': 'arbitrum'
            })
        
        tx_hash = engine.blockchain.publish_signals(signals_to_publish)
        if tx_hash:
            print(f"✅ Signals published on-chain: {tx_hash}")
    else:
        print("⚠️  Blockchain disabled - skipping on-chain publish")
    
    print("\n🔍 STEP 4: TIER 2 DEEP ANALYSIS (Claude/Gemini)")
    print("-" * 80)
    
    # Process through Tier 2
    trade_plans = engine.process_tier2_batch(flagged)
    
    # Show shorts
    shorts = [tp for tp in trade_plans if tp.decision == "SHORT"]
    if shorts:
        print(f"\n🎯 IDENTIFIED {len(shorts)} SHORT OPPORTUNITIES:")
        for i, short in enumerate(shorts[:3], 1):
            print(f"\n{i}. {short.token_symbol}")
            print(f"   Confidence: {short.confidence}/100")
            print(f"   Entry: ${short.entry_price}")
            print(f"   Target: ${short.target_price}")
            print(f"   Reasoning: {short.reasoning[:100]}...")
    
    print("\n💰 STEP 5: EXECUTE SHORTS VIA NEXUS VAULT")
    print("-" * 80)
    
    # Execute top short if confidence is high enough
    if shorts and engine.blockchain.enabled:
        top_short = shorts[0]
        
        if top_short.confidence >= 75:
            result = engine.blockchain.execute_short(
                token_symbol=top_short.token_symbol,
                chain='arbitrum',  # Or extract from short
                amount_usdc=20_000_000,  # 20 USDC (6 decimals)
                confidence=top_short.confidence
            )
            
            if result:
                print(f"\n✅ SHORT EXECUTED!")
                print(f"   TX Hash: {result['txHash']}")
                print(f"   Position ID: {result['positionId']}")
        else:
            print(f"⚠️  Top short confidence ({top_short.confidence}%) below threshold (75%)")
    else:
        if not shorts:
            print("ℹ️  No shorts identified in this cycle")
        else:
            print("⚠️  Blockchain disabled - shorts not executed")
    
    print("\n📈 STEP 6: PERFORMANCE METRICS")
    print("-" * 80)
    
    # Show agent stats
    stats = engine.get_stats()
    print(f"\n🤖 Agent Stats:")
    print(f"   Social signals: {stats['social_signals_ingested']}")
    print(f"   Tier 1 flagged: {stats['tier1_flagged']}")
    print(f"   Tier 2 shorts: {stats['tier2_shorts']}")
    
    # Show blockchain stats
    if engine.blockchain.enabled:
        blockchain_stats = engine.blockchain.get_stats()
        print(f"\n⛓️  Blockchain Stats:")
        print(f"   Signals published: {blockchain_stats['signals_published']}")
        print(f"   Shorts executed: {blockchain_stats['shorts_executed']}")
        
        # Get on-chain metrics
        metrics = engine.blockchain.get_performance_metrics()
        if metrics:
            print(f"\n📊 On-Chain Performance:")
            print(f"   Total positions: {metrics.get('totalPositions', 0)}")
            print(f"   Win rate: {metrics.get('winRate', '0%')}")
            print(f"   Total P&L: {metrics.get('totalPnL', '0')} USDC")
    
    print("\n" + "="*80)
    print("✅ INTEGRATION DEMO COMPLETE")
    print("="*80 + "\n")
    
    print("💡 Next Steps:")
    print("   1. Deploy contracts to testnet (Arbitrum Sepolia)")
    print("   2. Start blockchain service: cd blockchain && npm run dev")
    print("   3. Enable blockchain: Set BLOCKCHAIN_ENABLED=true in .env")
    print("   4. Schedule automated runs every 30 minutes")
    print("   5. Monitor positions via frontend dashboard\n")

if __name__ == "__main__":
    main()
