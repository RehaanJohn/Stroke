#!/usr/bin/env python3
"""
Tier 1 Test Script
Tests the Local LLM Screener with HuggingFace integration
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check if HuggingFace token is set
hf_token = os.getenv('HUGGING_FACE_TOKEN', '').strip()
if not hf_token or hf_token == 'your_hugging_face_token_here':
    print("❌ ERROR: HUGGING_FACE_TOKEN not set in .env file")
    print("Please add your token to .env file:")
    print("HUGGING_FACE_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxx")
    sys.exit(1)

print("="*80)
print("TIER 1 SCREENER TEST - LOCAL LLM")
print("="*80)
print()

# Import after env check
from agent.data_ingestion import DataIngestion
from agent.local_llm_screener import LocalLLMScreener

# Test configurations
MOCK_MODE = os.getenv('AGENT_TIER1_MOCK', 'true').lower() == 'true'

print(f"Configuration:")
print(f"  HuggingFace Token: {hf_token[:10]}...{hf_token[-5:]}")
print(f"  Mock Mode: {MOCK_MODE}")
print()

if not MOCK_MODE:
    print("⚠️  WARNING: Production mode will download Llama 3.2 3B (~6GB)")
    print("⚠️  This requires transformers and torch packages")
    print("⚠️  Press Ctrl+C to cancel or wait 5 seconds to continue...")
    import time
    try:
        time.sleep(5)
    except KeyboardInterrupt:
        print("\nCancelled by user")
        sys.exit(0)
    print()

# Initialize components
print("1. Initializing Data Ingestion...")
data_ingestion = DataIngestion()
print("   ✓ Data ingestion ready")

print("\n2. Initializing Tier 1 Screener...")
try:
    screener = LocalLLMScreener(mock_mode=MOCK_MODE)
    print(f"   ✓ Screener initialized (Mock: {MOCK_MODE})")
except Exception as e:
    print(f"   ❌ Error initializing screener: {e}")
    sys.exit(1)

# Generate test signals
print("\n3. Generating test signals...")
test_batch_size = 50
signals = data_ingestion.generate_batch(
    size=test_batch_size,
    rug_pull_ratio=0.10  # 10% rug pulls for testing
)
print(f"   ✓ Generated {len(signals)} signals ({int(test_batch_size * 0.1)} rug pulls)")

# Process through Tier 1
print("\n4. Processing through Tier 1 screener...")
print("-"*80)

import time
start_time = time.time()

try:
    flagged_tokens = screener.screen_batch(signals)
    
    processing_time = time.time() - start_time
    
    print(f"\n✓ Processing complete in {processing_time:.2f}s")
    if processing_time > 0:
        print(f"  Throughput: {len(signals)/processing_time:.1f} tokens/second")
    else:
        print(f"  Throughput: Instant (< 0.01s)")
    
except Exception as e:
    print(f"\n❌ Error during screening: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Display results
print("\n" + "="*80)
print("TIER 1 RESULTS")
print("="*80)
print()

print(f"Total Processed: {len(signals)}")
print(f"Total Flagged:   {len(flagged_tokens)} ({len(flagged_tokens)/len(signals)*100:.1f}%)")
print(f"Total Passed:    {len(signals) - len(flagged_tokens)}")

if flagged_tokens:
    print("\n" + "-"*80)
    print("TOP FLAGGED TOKENS (Urgency 7+):")
    print("-"*80)
    
    high_urgency = [t for t in flagged_tokens if t.urgency_score >= 7]
    high_urgency.sort(key=lambda x: x.urgency_score, reverse=True)
    
    for i, token in enumerate(high_urgency[:10], 1):
        print(f"\n{i}. {token.signal.token_symbol} on {token.signal.chain}")
        print(f"   Urgency: {token.urgency_score}/10")
        print(f"   Category: {token.signal.category}")
        print(f"   TVL Change: {token.signal.tvl_change_24h:.1f}%")
        print(f"   Liquidity Change: {token.signal.liquidity_change_24h:.1f}%")
        print(f"   Twitter Engagement: {token.signal.twitter_engagement_change_48h:.1f}%")
        print(f"   Insider Sells: {token.signal.insider_sells_24h} (${token.signal.insider_sell_volume_usd:,.0f})")
        print(f"   Reasoning: {token.reasoning[:80]}...")

# Display screener stats
print("\n" + "="*80)
print("TIER 1 STATISTICS")
print("="*80)
print()

stats = screener.get_stats()
print(f"Total Processed: {stats['total_processed']}")
print(f"Total Flagged:   {stats['total_flagged']} ({stats['total_flagged']/max(stats['total_processed'],1)*100:.1f}%)")
print(f"Total Passed:    {stats['total_passed']}")
print(f"Avg Time/Batch:  {stats['avg_processing_time_ms']:.1f}ms")
print(f"Batch Count:     {stats['batch_count']}")

# Mode-specific info
if MOCK_MODE:
    print("\n⚠️  MOCK MODE ACTIVE")
    print("   Using rule-based classifier (no actual LLM inference)")
    print("   To test with real Llama 3.2 3B model:")
    print("   1. Set AGENT_TIER1_MOCK=false in .env")
    print("   2. Uncomment torch/transformers in requirements.txt")
    print("   3. Run: pip install torch transformers accelerate")
    print("   4. Re-run this test")
else:
    print("\n✓ PRODUCTION MODE")
    print("   Using real Llama 3.2 3B Instruct model")
    if 'model' in dir(screener) and screener.model:
        print(f"   Device: {screener.device}")
        print(f"   Model: {type(screener.model).__name__}")

print("\n" + "="*80)
print("✓ TIER 1 TEST COMPLETE")
print("="*80)

# Summary
if len(flagged_tokens) > 0:
    print(f"\n✅ Tier 1 is working! Flagged {len(flagged_tokens)} suspicious tokens")
    print(f"   Ready to feed into Tier 2 (Claude) for deep analysis")
else:
    print(f"\n⚠️  No tokens flagged in this batch (might be normal if no rug pulls)")
    print(f"   Try increasing rug_pull_ratio in the test")
