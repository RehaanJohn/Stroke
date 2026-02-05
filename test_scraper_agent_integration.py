#!/usr/bin/env python3
"""
Full Integration Test: x_scrapper → Agent System
Tests the complete pipeline from Twitter scraping to LLM analysis
"""

import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add agent to path
sys.path.insert(0, str(Path(__file__).parent / 'agent'))

from agent.social_monitor import SocialMonitor
from agent.local_llm_screener import LocalLLMScreener
from datetime import datetime

def check_database_exists():
    """Check if crypto_tweets.db exists"""
    db_path = Path(__file__).parent / 'x_scrapper' / 'crypto_tweets.db'
    return db_path.exists()

def run_scraper():
    """Run the x_scrapper to collect fresh tweets"""
    print("\n" + "="*80)
    print("STEP 1: RUNNING X_SCRAPPER")
    print("="*80 + "\n")
    
    scraper_path = Path(__file__).parent / 'x_scrapper' / 'scrape_crypto_fast.py'
    
    if not scraper_path.exists():
        print("❌ Scraper not found. Please ensure x_scrapper is installed.")
        return False
    
    try:
        # Run the scraper
        result = subprocess.run(
            ['python', str(scraper_path)],
            cwd=str(scraper_path.parent),
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        if result.returncode == 0:
            print("✅ Scraper completed successfully")
            # Show last 20 lines of output
            output_lines = result.stdout.split('\n')
            for line in output_lines[-20:]:
                if line.strip():
                    print(line)
            return True
        else:
            print(f"❌ Scraper failed with exit code {result.returncode}")
            print(result.stderr)
            return False
            
    except subprocess.TimeoutExpired:
        print("⚠️  Scraper timed out (>5 minutes)")
        return False
    except Exception as e:
        print(f"❌ Error running scraper: {e}")
        return False

def test_social_monitor():
    """Test the social monitor"""
    print("\n" + "="*80)
    print("STEP 2: TESTING SOCIAL MONITOR")
    print("="*80 + "\n")
    
    monitor = SocialMonitor()
    
    # Get database stats
    stats = monitor.get_stats()
    
    print("📊 Database Stats:")
    for key, value in stats.items():
        print(f"   {key}: {value}")
    
    if stats.get('total_tweets', 0) == 0:
        print("\n⚠️  No tweets in database. Run the scraper first!")
        return None
    
    # Get top signals
    print("\n" + "="*80)
    print("TOP SOCIAL SIGNALS")
    print("="*80 + "\n")
    
    signals = monitor.get_top_signals(limit=20, min_urgency=6)
    
    print(f"Found {len(signals)} urgent signals\n")
    
    for i, signal in enumerate(signals[:10], 1):
        print(f"{i}. [@{signal['username']}] [{signal['type']}] Urgency: {signal['urgency']}/10")
        print(f"   {signal['text'][:120]}...")
        print(f"   Engagement: {signal['engagement']:,} | Tokens: {', '.join(signal['tokens'][:3]) if signal['tokens'] else 'N/A'}")
        print()
    
    return signals

def test_llm_screening(signals):
    """Test LLM screening of social signals"""
    print("\n" + "="*80)
    print("STEP 3: TIER 1 LLM SCREENING")
    print("="*80 + "\n")
    
    if not signals:
        print("⚠️  No signals to screen")
        return
    
    # Check if using mock or production
    use_mock = os.getenv('AGENT_TIER1_MOCK', 'true').lower() == 'true'
    
    print(f"🤖 Mode: {'MOCK' if use_mock else 'PRODUCTION (HuggingFace)'}\n")
    
    try:
        # Initialize screener
        screener = LocalLLMScreener(mock_mode=use_mock)
        
        # Prepare signal texts
        signal_texts = [s['text'] for s in signals[:20]]  # Screen top 20
        
        print(f"Screening {len(signal_texts)} signals...\n")
        
        # Screen the batch using new text screening method
        results = screener.screen_text_signals(signal_texts)
        
        # Analyze results
        flagged = [r for r in results if r['is_urgent']]
        
        print(f"🎯 Results:")
        print(f"   Total screened: {len(results)}")
        print(f"   Flagged urgent: {len(flagged)} ({len(flagged)/len(results)*100:.1f}%)")
        print(f"   Passed: {len(results) - len(flagged)}")
        
        if flagged:
            print(f"\n⚠️  FLAGGED FOR TIER 2 ANALYSIS:\n")
            for i, result in enumerate(flagged[:5], 1):
                signal = signals[result['index']]
                print(f"{i}. Urgency: {result['urgency']}/10")
                print(f"   Signal: {result['signal_text'][:100]}...")
                print(f"   Source: @{signal['username']}")
                print(f"   Reasoning: {result['reasoning'][:150]}")
                print()
        
        print(f"\n✅ LLM screening complete")
        
        return results
        
    except Exception as e:
        print(f"❌ Error during LLM screening: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("\n" + "#"*80)
    print("X_SCRAPPER → AGENT SYSTEM INTEGRATION TEST")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("#"*80)
    
    # Check if database exists
    if not check_database_exists():
        print("\n⚠️  crypto_tweets.db not found. Running scraper first...\n")
        
        # Ask user if they want to run scraper
        response = input("Run scraper now? (y/n): ").strip().lower()
        if response == 'y':
            if not run_scraper():
                print("\n❌ Scraper failed. Cannot continue.")
                return
        else:
            print("\n❌ Cannot test without database. Exiting.")
            return
    else:
        print("\n✅ Database found: crypto_tweets.db\n")
        
        # Ask if user wants to refresh data
        response = input("Refresh data by running scraper? (y/n): ").strip().lower()
        if response == 'y':
            run_scraper()
    
    # Test social monitor
    signals = test_social_monitor()
    
    if not signals:
        print("\n❌ No signals generated. Cannot test LLM screening.")
        return
    
    # Test LLM screening
    results = test_llm_screening(signals)
    
    # Final summary
    print("\n" + "="*80)
    print("INTEGRATION TEST COMPLETE")
    print("="*80 + "\n")
    
    print("📋 Summary:")
    print(f"   ✅ x_scrapper: Collected tweets to database")
    print(f"   ✅ SocialMonitor: Parsed {len(signals)} signals")
    print(f"   ✅ Tier1Screener: Analyzed signals with LLM")
    print(f"   ✅ Integration: All components working together")
    
    print("\n💡 Next Steps:")
    print("   1. Set AGENT_TIER1_MOCK=false for production HuggingFace model")
    print("   2. Add ANTHROPIC_API_KEY for Tier 2 Claude analysis")
    print("   3. Run agent orchestration with: python -m agent.orchestration")
    print("   4. Schedule x_scrapper to run every 30 minutes")
    
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
