#!/usr/bin/env python3
"""
Quick test script for NEXUS Agent
Runs a complete screening cycle and displays results
"""

import sys
import json
from agent.orchestration import OrchestrationEngine


def main():
    print("="*80)
    print("NEXUS AGENT - TWO-TIER SCREENING TEST")
    print("="*80)
    print()
    
    # Initialize engine
    print("Initializing orchestration engine...")
    engine = OrchestrationEngine(
        batch_size=100,
        tier1_mock=True,  # Use mock for testing
        tier2_mock=True
    )
    print("✓ Engine initialized\n")
    
    # Run a cycle
    print("Running screening cycle (500 signals)...")
    print("-"*80)
    summary = engine.run_cycle(signals_per_cycle=500)
    print()
    
    # Get results
    shorts = engine.get_short_recommendations(min_confidence=70)
    monitors = engine.get_monitor_list()
    
    print("="*80)
    print(f"RESULTS: {len(shorts)} HIGH-CONFIDENCE SHORTS")
    print("="*80)
    print()
    
    if shorts:
        print("Top 5 Short Recommendations:")
        print("-"*80)
        
        for i, tp in enumerate(shorts[:5], 1):
            print(f"\n{i}. {tp.token_symbol} on {tp.best_execution_chain}")
            print(f"   Confidence: {tp.confidence}% | Position: {tp.position_size_percent}% of portfolio")
            print(f"   Entry: ${tp.entry_price:.4f}")
            print(f"   Take-Profits: TP1={tp.take_profit_1_percent}%, TP2={tp.take_profit_2_percent}%, TP3={tp.take_profit_3_percent}%")
            print(f"   Stop-Loss: +{tp.stop_loss_percent}%")
            print(f"   Reasoning: {tp.reasoning}")
            print(f"   Risk Factors: {', '.join(tp.risk_factors[:3])}")
    else:
        print("No high-confidence shorts found in this cycle.")
    
    print("\n" + "="*80)
    print(f"MONITOR LIST: {len(monitors)} tokens")
    print("="*80)
    
    if monitors:
        for tp in monitors[:3]:
            print(f"  - {tp.token_symbol} ({tp.confidence}% confidence)")
    
    # Show stats
    print("\n" + "="*80)
    print("SYSTEM STATISTICS")
    print("="*80)
    
    stats = engine.get_full_stats()
    print(f"\nTier 1 Performance:")
    print(f"  Processed: {stats['tier1_stats']['total_processed']} tokens")
    print(f"  Flagged: {stats['tier1_stats']['total_flagged']} ({stats['tier1_stats']['flag_rate']*100:.1f}%)")
    print(f"  Avg Time: {stats['tier1_stats']['avg_processing_time_ms']:.1f}ms per batch")
    
    print(f"\nTier 2 Performance:")
    print(f"  Analyzed: {stats['tier2_stats']['total_analyzed']} tokens")
    print(f"  Shorts: {stats['tier2_stats']['total_shorts']}")
    print(f"  Monitors: {stats['tier2_stats']['total_monitors']}")
    print(f"  Passes: {stats['tier2_stats']['total_passes']}")
    print(f"  Short Rate: {stats['tier2_stats']['short_rate']*100:.1f}%")
    print(f"  API Cost: ${stats['tier2_stats']['total_api_cost_usd']:.4f}")
    
    print(f"\nCycle Summary:")
    print(f"  Total Runtime: {stats['system_stats']['total_runtime_seconds']:.2f}s")
    print(f"  Cycles Completed: {stats['system_stats']['cycles_completed']}")
    
    print("\n" + "="*80)
    print("✓ Test complete!")
    print("="*80)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
