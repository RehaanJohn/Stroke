#!/usr/bin/env python3
"""
Focused Claude Production Verification
Verifies actual Tier 2 analysis using real Claude Sonnet 3.5 Sonnet
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Add agent to path
sys.path.insert(0, str(Path(__file__).parent / 'agent'))

from agent.claude_analyzer import ClaudeAnalyzer
from agent.local_llm_screener import FlaggedToken, TokenSignal

def test_real_claude_call():
    print("\n" + "#"*80)
    print("CLAUDE PRODUCTION VERIFICATION")
    print("#"*80)
    
    # Initialize analyzer in production mode
    analyzer = ClaudeAnalyzer(mock_mode=False)
    
    # Create a realistic flagged signal (simulated Tier 1 output)
    signal = TokenSignal(
        token_symbol="PEPE2.0",
        token_address="0x123...456",
        chain="ethereum",
        category="memecoin",
        market_cap_usd=2500000.0,
        tvl_usd=150000.0,
        tvl_change_24h=-45.5,
        liquidity_change_24h=-60.0,
        holder_concentration_top10=85.0,
        insider_sells_24h=12,
        insider_sell_volume_usd=750000.0,
        twitter_engagement_change_48h=-75.0,
        twitter_mentions_24h=150,
        twitter_sentiment_score=-0.65,
        influencer_silence_hours=48,
        github_commits_7d=0,
        github_commit_change=-100.0,
        dev_departures_30d=2,
        recent_vote_type="treasury_raid",
        vote_passed=True,
        price_change_24h=-15.0,
        volume_24h_usd=250000.0,
        timestamp=datetime.utcnow().isoformat()
    )
    
    flagged = FlaggedToken(
        signal=signal,
        urgency_score=9,
        reasoning="Tier 1 Flagged: Severe liquidity removal (-60%) + Massive insider dumping ($750k) during a 'treasury raid' vote passage. GitHub activity has flatlined."
    )
    
    print(f"\n🚀 Sending {signal.token_symbol} to Claude for Deep Analysis...")
    try:
        start_time = datetime.now()
        plan = analyzer.analyze(flagged)
        end_time = datetime.now()
        
        duration = (end_time - start_time).total_seconds()
        
        print(f"\n✅ Claude Response Received in {duration:.2f}s!")
        print("-" * 40)
        print(f"Decision:    {plan.decision}")
        print(f"Confidence:  {plan.confidence}%")
        print(f"Position:    {plan.position_size_percent}%")
        print(f"Chain:       {plan.best_execution_chain}")
        print(f"Reasoning:   {plan.reasoning}")
        print(f"Risk Factors: {', '.join(plan.risk_factors)}")
        print("-" * 40)
        
        # Verify stats updated
        stats = analyzer.get_stats()
        print(f"API Cost Estimate: ${stats.get('total_api_cost_usd', 0.0):.6f}")
        
        if plan.decision != "PASS":
            return True
        else:
            print("❌ Claude returned PASS (Unexpected for this data)")
            return False
            
    except Exception as e:
        print(f"❌ Error during Claude analysis: {e}")
        return False

if __name__ == "__main__":
    success = test_real_claude_call()
    if success:
        print("\n🏆 CLAUDE PRODUCTION TEST PASSED!")
        sys.exit(0)
    else:
        print("\n💀 CLAUDE PRODUCTION TEST FAILED!")
        sys.exit(1)
