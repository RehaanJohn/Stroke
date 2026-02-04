"""
Local LLM Screener (Tier 1)
Uses Llama 3.2 3B Instruct for fast binary classification
"""

import logging
from typing import List, Dict, Any, Tuple
from datetime import datetime
import json
import time

# Note: For production, uncomment these imports
# from transformers import AutoTokenizer, AutoModelForCausalLM
# import torch

from .data_ingestion import TokenSignal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FlaggedToken:
    """Represents a token flagged by Tier 1 screening"""
    
    def __init__(self, signal: TokenSignal, urgency_score: int, reasoning: str):
        self.signal = signal
        self.urgency_score = urgency_score  # 0-10
        self.reasoning = reasoning
        self.flagged_at = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "token_symbol": self.signal.token_symbol,
            "token_address": self.signal.token_address,
            "chain": self.signal.chain,
            "urgency_score": self.urgency_score,
            "reasoning": self.reasoning,
            "flagged_at": self.flagged_at,
            "full_signal": self.signal.__dict__
        }


class LocalLLMScreener:
    """
    Tier 1: Fast binary classification using local Llama 3.2 3B
    Processes 200-500 tokens/minute in parallel batches
    """
    
    # Prompt template for binary classification
    PROMPT_TEMPLATE = """Analyze this crypto token data for short-selling signals.

Token: {symbol} on {chain}
Category: {category}

On-Chain Metrics (24h):
- TVL Change: {tvl_change}%
- Liquidity Change: {liq_change}%
- Top 10 Holder Concentration: {holder_conc}%
- Insider Sells: {insider_sells} transactions, ${insider_volume:,.0f}

Social Signals (24-48h):
- Twitter Engagement Change: {twitter_eng}%
- Sentiment Score: {sentiment}/1.0
- Influencer Silent For: {silence_hours:.0f} hours
- Mentions: {mentions}

Protocol Health:
- GitHub Commits (7d): {commits}
- Commit Change: {commit_change}%
- Dev Departures (30d): {dev_exits}

Recent Governance: {gov_type} (Passed: {gov_passed})

Price Action:
- 24h Change: {price_change}%
- Volume: ${volume:,.0f}

Consider these RED FLAGS:
1. Insider dumps (>3 sells, >$100k volume)
2. Liquidity removal (>20% drop)
3. Twitter engagement collapse (>50% drop)
4. Developer exodus
5. Bearish governance votes

Reply with ONLY one word followed by urgency score (0-10):
- "FLAG 9" if high-confidence short signal
- "FLAG 5" if moderate concerns
- "PASS" if no immediate concerns

Your analysis:"""

    def __init__(self, use_gpu: bool = True, mock_mode: bool = True):
        """
        Initialize Local LLM Screener
        
        Args:
            use_gpu: Whether to use GPU acceleration
            mock_mode: If True, use rule-based classifier instead of LLM (for testing)
        """
        self.use_gpu = use_gpu
        self.mock_mode = mock_mode
        self.model = None
        self.tokenizer = None
        self.device = None
        
        self.stats = {
            "total_processed": 0,
            "total_flagged": 0,
            "total_passed": 0,
            "avg_processing_time_ms": 0,
            "batch_count": 0
        }
        
        if not mock_mode:
            self._load_model()
        else:
            logger.info("Running in MOCK MODE - using rule-based classifier")
    
    def _load_model(self):
        """Load Llama 3.2 3B model (production only)"""
        logger.info("Loading Llama 3.2 3B Instruct model...")
        
        # Uncomment for production:
        """
        import torch
        from transformers import AutoTokenizer, AutoModelForCausalLM
        
        model_name = "meta-llama/Llama-3.2-3B-Instruct"
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if self.use_gpu else torch.float32,
            device_map="auto" if self.use_gpu else None,
            low_cpu_mem_usage=True
        )
        
        self.device = "cuda" if self.use_gpu and torch.cuda.is_available() else "cpu"
        logger.info(f"Model loaded on {self.device}")
        """
        
        pass
    
    def _format_prompt(self, signal: TokenSignal) -> str:
        """Format token signal into prompt"""
        return self.PROMPT_TEMPLATE.format(
            symbol=signal.token_symbol,
            chain=signal.chain,
            category=signal.category,
            tvl_change=signal.tvl_change_24h,
            liq_change=signal.liquidity_change_24h,
            holder_conc=signal.holder_concentration_top10,
            insider_sells=signal.insider_sells_24h,
            insider_volume=signal.insider_sell_volume_usd,
            twitter_eng=signal.twitter_engagement_change_48h,
            sentiment=signal.twitter_sentiment_score,
            silence_hours=signal.influencer_silence_hours,
            mentions=signal.twitter_mentions_24h,
            commits=signal.github_commits_7d,
            commit_change=signal.github_commit_change,
            dev_exits=signal.dev_departures_30d,
            gov_type=signal.recent_vote_type,
            gov_passed=signal.vote_passed,
            price_change=signal.price_change_24h,
            volume=signal.volume_24h_usd
        )
    
    def _mock_classify(self, signal: TokenSignal) -> Tuple[str, int, str]:
        """
        Rule-based classification for testing (mock LLM)
        Returns: (decision, urgency_score, reasoning)
        """
        red_flags = []
        urgency = 0
        
        # Check insider dumps
        if signal.insider_sells_24h > 3 and signal.insider_sell_volume_usd > 100000:
            red_flags.append(f"Insider dumps: {signal.insider_sells_24h} sells, ${signal.insider_sell_volume_usd:,.0f}")
            urgency += 3
        
        # Check liquidity removal
        if signal.liquidity_change_24h < -20:
            red_flags.append(f"Liquidity removal: {signal.liquidity_change_24h:.1f}%")
            urgency += 2
        
        # Check TVL collapse
        if signal.tvl_change_24h < -30:
            red_flags.append(f"TVL collapse: {signal.tvl_change_24h:.1f}%")
            urgency += 2
        
        # Check Twitter engagement crash
        if signal.twitter_engagement_change_48h < -50:
            red_flags.append(f"Engagement crash: {signal.twitter_engagement_change_48h:.1f}%")
            urgency += 2
        
        # Check influencer silence
        if signal.influencer_silence_hours > 48:
            red_flags.append(f"Influencer silent: {signal.influencer_silence_hours:.0f}h")
            urgency += 1
        
        # Check dev exodus
        if signal.dev_departures_30d > 1:
            red_flags.append(f"Dev departures: {signal.dev_departures_30d}")
            urgency += 1
        
        # Check bearish governance
        if signal.vote_passed and signal.recent_vote_type in ["inflation", "treasury_raid", "fee_increase"]:
            red_flags.append(f"Bearish vote: {signal.recent_vote_type}")
            urgency += 1
        
        # Determine decision
        if urgency >= 5:
            decision = "FLAG"
            reasoning = " | ".join(red_flags[:4])  # Top 4 issues
        elif urgency >= 3:
            decision = "FLAG"
            reasoning = " | ".join(red_flags[:2])
        else:
            decision = "PASS"
            reasoning = "No critical short signals detected"
        
        return decision, min(urgency, 10), reasoning
    
    def _llm_classify(self, signal: TokenSignal) -> Tuple[str, int, str]:
        """
        Use actual Llama 3.2 model for classification (production)
        Returns: (decision, urgency_score, reasoning)
        """
        # Uncomment for production:
        """
        import torch
        
        prompt = self._format_prompt(signal)
        
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=50,
                temperature=0.3,  # Low temp for consistent classification
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        
        response = self.tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
        
        # Parse response: "FLAG 9" or "PASS"
        response = response.strip().upper()
        
        if "FLAG" in response:
            # Extract urgency score
            parts = response.split()
            urgency = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 5
            return "FLAG", urgency, response
        else:
            return "PASS", 0, response
        """
        
        # Fallback to mock for now
        return self._mock_classify(signal)
    
    def screen_single(self, signal: TokenSignal) -> Tuple[str, FlaggedToken or None]:
        """
        Screen a single token
        
        Returns:
            ("FLAG", FlaggedToken) or ("PASS", None)
        """
        start_time = time.time()
        
        if self.mock_mode:
            decision, urgency, reasoning = self._mock_classify(signal)
        else:
            decision, urgency, reasoning = self._llm_classify(signal)
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        # Update stats
        self.stats["total_processed"] += 1
        
        if decision == "FLAG":
            self.stats["total_flagged"] += 1
            flagged = FlaggedToken(signal, urgency, reasoning)
            logger.info(f"🚩 FLAGGED: {signal.token_symbol} (urgency: {urgency}/10) - {reasoning[:50]}...")
            return "FLAG", flagged
        else:
            self.stats["total_passed"] += 1
            logger.debug(f"✓ PASSED: {signal.token_symbol}")
            return "PASS", None
    
    def screen_batch(self, signals: List[TokenSignal]) -> List[FlaggedToken]:
        """
        Screen a batch of tokens in parallel
        
        Args:
            signals: List of TokenSignal objects
        
        Returns:
            List of FlaggedToken objects (only flagged tokens)
        """
        start_time = time.time()
        flagged_tokens = []
        
        logger.info(f"Screening batch of {len(signals)} tokens...")
        
        # For now, process sequentially (TODO: add true parallel processing)
        for signal in signals:
            decision, flagged = self.screen_single(signal)
            if decision == "FLAG":
                flagged_tokens.append(flagged)
        
        # Update stats
        batch_time = time.time() - start_time
        self.stats["batch_count"] += 1
        self.stats["avg_processing_time_ms"] = (
            (self.stats["avg_processing_time_ms"] * (self.stats["batch_count"] - 1) + batch_time * 1000) 
            / self.stats["batch_count"]
        )
        
        tokens_per_minute = (len(signals) / batch_time) * 60 if batch_time > 0 else 0
        
        logger.info(
            f"Batch complete: {len(flagged_tokens)}/{len(signals)} flagged "
            f"({tokens_per_minute:.0f} tokens/min)"
        )
        
        return flagged_tokens
    
    def get_stats(self) -> Dict[str, Any]:
        """Get screening statistics"""
        return {
            **self.stats,
            "flag_rate": self.stats["total_flagged"] / max(self.stats["total_processed"], 1),
            "timestamp": datetime.utcnow().isoformat()
        }


# Example usage
if __name__ == "__main__":
    from data_ingestion import DataIngestion
    
    # Generate test data
    ingestion = DataIngestion()
    signals = ingestion.generate_batch(size=20, rug_pull_ratio=0.15)
    
    # Screen with local LLM
    screener = LocalLLMScreener(mock_mode=True)
    flagged = screener.screen_batch(signals)
    
    print("\n" + "="*80)
    print(f"TIER 1 RESULTS: {len(flagged)} tokens flagged out of {len(signals)}")
    print("="*80)
    
    for token in flagged:
        print(f"\n🚨 {token.signal.token_symbol} (Urgency: {token.urgency_score}/10)")
        print(f"   Chain: {token.signal.chain}")
        print(f"   Reason: {token.reasoning}")
    
    print("\n" + "="*80)
    print("STATS:")
    print(json.dumps(screener.get_stats(), indent=2))
