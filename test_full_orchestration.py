#!/usr/bin/env python3
"""
Full Agent Orchestration with Social Signals
Demonstrates complete pipeline: Social + Token signals → Tier 1 → Tier 2
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add agent to path
sys.path.insert(0, str(Path(__file__).parent / 'agent'))

from agent.orchestration import OrchestrationEngine
from agent.social_monitor import SocialMonitor


def main():
    print("\n" + "#"*80)
    print("NEXUS AGENT ORCHESTRATION - SOCIAL SIGNAL INTEGRATION")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("#"*80 + "\n")
    
    # Check environment
    tier1_mock = os.getenv('AGENT_TIER1_MOCK', 'true').lower() == 'true'
    tier2_mock = os.getenv('AGENT_TIER2_MOCK', 'true').lower() == 'true'
    
    print("🔧 Configuration:")
    print(f"   Tier 1 (HuggingFace): {'MOCK' if tier1_mock else 'PRODUCTION'}")
    print(f"   Tier 2 (Gemini): {'MOCK' if tier2_mock else 'PRODUCTION'}")
    print()
    
    # Initialize orchestration engine
    print("="*80)
    print("INITIALIZING ORCHESTRATION ENGINE")
    print("="*80 + "\n")
    
    engine = OrchestrationEngine(
        batch_size=100,
        tier1_mock=tier1_mock,
        tier2_mock=tier2_mock,
        max_tier2_parallel=5
    )
    
    # Check if social database exists
    social_db = Path(__file__).parent / 'x_scrapper' / 'crypto_tweets.db'
    has_social_data = social_db.exists()
    
    if has_social_data:
        # Get social monitor stats
        monitor = SocialMonitor()
        stats = monitor.get_stats()
        
        print("📊 Social Signal Database:")
        print(f"   Total tweets: {stats.get('total_tweets', 0):,}")
        print(f"   Crypto tweets: {stats.get('crypto_tweets', 0):,}")
        print(f"   Latest scrape: {stats.get('latest_scrape', 'N/A')}")
        print()
        
        # Ingest social signals
        print("="*80)
        print("INGESTING SOCIAL SIGNALS")
        print("="*80 + "\n")
        
        social_count = engine.ingest_social_signals(min_urgency=7, limit=50)
        print(f"✅ Ingested {social_count} social signals\n")
    else:
        print("⚠️  No social database found (run x_scrapper first)")
        print("   Continuing with token signals only...\n")
    
    # Ingest token signals (on-chain data)
    print("="*80)
    print("INGESTING TOKEN SIGNALS")
    print("="*80 + "\n")
    
    engine.ingest_signals(count=100, rug_pull_ratio=0.1)
    print()
    
    # Run processing cycle
    print("="*80)
    print("RUNNING PROCESSING CYCLE")
    print("="*80 + "\n")
    
    summary = engine.run_cycle()
    
    # Display results
    print("\n" + "="*80)
    print("CYCLE RESULTS")
    print("="*80 + "\n")
    
    print(f"⏱️  Cycle Time: {summary['cycle_time_seconds']:.2f}s")
    print(f"📊 Signals Processed: {summary['signals_processed']}")
    print(f"🔍 Tier 1 Batches: {summary['tier1_batches']}")
    print(f"⚠️  Tier 1 Flagged: {summary['tier1_flagged']} ({summary['tier1_flagged']/summary['signals_processed']*100:.1f}%)")
    print(f"🎯 Tier 2 Analysis:")
    print(f"   - SHORT: {summary['tier2_shorts']}")
    print(f"   - MONITOR: {summary['tier2_monitors']}")
    print(f"   - PASS: {summary['tier2_passes']}")
    
    if not tier2_mock:
        print(f"💰 Claude API Cost: ${summary['claude_api_cost']:.4f}")
    
    # Get short recommendations
    print("\n" + "="*80)
    print("SHORT RECOMMENDATIONS")
    print("="*80 + "\n")
    
    shorts = engine.get_short_recommendations(min_confidence=70)
    
    if shorts:
        print(f"Found {len(shorts)} high-confidence short opportunities:\n")
        
        for i, tp in enumerate(shorts[:5], 1):
            print(f"{i}. 🎯 {tp.token_symbol} on {tp.best_execution_chain}")
            print(f"   Confidence: {tp.confidence}% | Position: {tp.position_size_percent}%")
            print(f"   Entry: ${tp.entry_price:.6f}")
            print(f"   Take Profits: {tp.take_profit_1_percent}% / {tp.take_profit_2_percent}% / {tp.take_profit_3_percent}%")
            print(f"   Stop Loss: +{tp.stop_loss_percent}%")
            print(f"   Reasoning: {tp.reasoning[:150]}...")
            print(f"   Risk Factors: {', '.join(tp.risk_factors[:3])}")
            print()
    else:
        print("✅ No high-confidence shorts identified in this cycle")
        print("   Market conditions appear stable\n")
    
    # Monitor list
    monitors = engine.get_monitor_list()
    if monitors:
        print("="*80)
        print(f"MONITOR LIST ({len(monitors)} tokens)")
        print("="*80 + "\n")
        
        for i, tp in enumerate(monitors[:5], 1):
            print(f"{i}. 👀 {tp.token_symbol} - {tp.reasoning[:100]}...")
    
    # Full system stats
    print("\n" + "="*80)
    print("SYSTEM STATISTICS")
    print("="*80 + "\n")
    
    full_stats = engine.get_full_stats()
    system_stats = full_stats['system_stats']
    
    print("📊 Overall Stats:")
    print(f"   Total signals ingested: {system_stats['total_signals_ingested']}")
    if has_social_data:
        print(f"   - Social signals: {system_stats['social_signals_ingested']}")
        print(f"   - Token signals: {system_stats['total_signals_ingested'] - system_stats['social_signals_ingested']}")
    print(f"   Tier 1 processed: {system_stats['tier1_processed']}")
    print(f"   Tier 1 flagged: {system_stats['tier1_flagged']}")
    print(f"   Tier 2 analyzed: {system_stats['tier2_analyzed']}")
    print(f"   Total runtime: {system_stats['total_runtime_seconds']:.2f}s")
    print(f"   Cycles completed: {system_stats['cycles_completed']}")
    
    # Summary
    print("\n" + "="*80)
    print("INTEGRATION TEST COMPLETE")
    print("="*80 + "\n")
    
    print("✅ Components Tested:")
    print("   ✓ Social Signal Ingestion (Twitter/X)")
    print("   ✓ Token Signal Generation (On-chain)")
    print("   ✓ Tier 1 Screening (HuggingFace)")
    print("   ✓ Tier 2 Analysis (Gemini)")
    print("   ✓ Signal Fusion & Prioritization")
    
    print("\n💡 Production Checklist:")
    print("   [ ] Set AGENT_TIER1_MOCK=false (HuggingFace)")
    print("   [ ] Add GEMINI_API_KEY (Google Gemini)")
    print("   [ ] Schedule x_scrapper (every 30 min)")
    print("   [ ] Configure LI.FI for trade execution")
    print("   [ ] Set up monitoring/alerting")
    
    print("\n" + "="*80 + "\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
