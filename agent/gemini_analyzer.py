"""
Gemini Analyzer (Tier 2)
Deep analysis using Google Gemini with intelligent rate limiting and batch splitting
"""

import logging
import json
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, asdict
import os
import math

from google import genai
from google.genai import types

from .local_llm_screener import FlaggedToken

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TradePlan:
    """Structured trade recommendation from Gemini"""
    token_symbol: str
    token_address: str
    chain: str
    
    decision: str  # "SHORT", "MONITOR", "PASS"
    confidence: int  # 0-100
    
    position_size_percent: float  # % of portfolio
    position_size_usd: float    # Absolute size in USD
    leverage: int               # Position leverage
    entry_price: float
    
    take_profit_1: float
    take_profit_1_percent: float
    take_profit_2: float
    take_profit_2_percent: float
    take_profit_3: float
    take_profit_3_percent: float
    
    stop_loss: float
    stop_loss_percent: float
    
    best_execution_chain: str  # For LI.FI routing
    estimated_gas_usd: float
    
    reasoning: str  # Human-readable explanation
    risk_factors: List[str]
    
    analyzed_at: str
    urgency_score: int  # From Tier 1


class GeminiAnalyzer:
    """
    Tier 2: Deep analysis using Gemini with intelligent rate limiting
    Features:
    - Automatic batch splitting to avoid rate limits
    - Exponential backoff retry logic
    - Fallback to different Gemini models
    - Smart rate limiting
    """
    
    # Configuration constants
    MAX_TOKENS_PER_BATCH = 30000  # Conservative estimate for free tier
    MAX_BATCH_SIZE = 20  # Max tokens per API call
    RETRY_DELAYS = [3, 6, 12]  # Exponential backoff delays (seconds)
    
    # Models in order of preference (will fallback if quota exceeded)
    MODELS = [
        "gemini-2.0-flash",       # Latest Gemini 2.0 Flash
        "gemini-1.5-flash",       # Stable Gemini 1.5 Flash
        "gemini-1.5-flash-8b",    # Ultra-fast 8B model
        "gemini-1.5-pro",         # Gemini 1.5 Pro fallback
    ]
    
    # Gemini batch analysis prompt
    BATCH_ANALYSIS_PROMPT = """You are an expert crypto trading analyst specializing in short-selling opportunities. 

I will provide you with {num_tokens} flagged tokens that have been pre-screened. Analyze ALL of them in a SINGLE response and provide trade recommendations for each.

FLAGGED TOKENS DATA:
{tokens_data}

ANALYSIS REQUIREMENTS FOR EACH TOKEN:
1. Evaluate if this is a HIGH-CONFIDENCE short opportunity (≥70% confidence)
2. Consider cross-chain liquidity for optimal execution
3. Provide risk-adjusted position sizing
4. Set realistic take-profit levels based on historical crash patterns
5. Define protective stop-loss

OUTPUT FORMAT (JSON ARRAY - ONE OBJECT PER TOKEN):
[
  {{
    "token_symbol": "TOKEN1",
    "token_address": "0x...",
    "chain": "ethereum",
    "decision": "SHORT" | "MONITOR" | "PASS",
    "confidence": 0-100,
    "position_size_percent": 0-20,
    "take_profit_levels": [
      {{"level": 1, "price_target": -20.0, "close_percent": 30}},
      {{"level": 2, "price_target": -50.0, "close_percent": 40}},
      {{"level": 3, "price_target": -75.0, "close_percent": 30}}
    ],
    "stop_loss_percent": 12.0,
    "leverage": 2-10,
    "best_execution_chain": "ethereum" | "arbitrum" | "base" | "optimism",
    "reasoning": "2-3 sentence explanation focusing on strongest signals",
    "risk_factors": ["list", "of", "3-5", "key", "risks"]
  }},
  ... (repeat for all tokens)
]

DECISION CRITERIA:
- SHORT: Confidence ≥ 70%, multiple red flags, clear catalyst
- MONITOR: Confidence 50-69%, some concerns, needs more data
- PASS: Confidence < 50%, insufficient evidence

CRITICAL CONSIDERATIONS:
- Insider dumps + liquidity removal = STRONG SHORT
- Twitter silence + dev exits = STRONG SHORT
- Governance risks alone = MONITOR unless severe
- Position sizing: Higher confidence = larger position (max 20%)
- Chain selection: Deepest liquidity = best execution

Analyze all tokens and return a JSON array with complete analysis for each token:"""

    def __init__(self, api_key: Optional[str] = None, mock_mode: bool = True):
        """
        Initialize Gemini Analyzer with intelligent rate limiting
        
        Args:
            api_key: Google API key (or set GEMINI_API_KEY env var)
            mock_mode: If True, use rule-based analysis instead of API calls
        """
        self.mock_mode = mock_mode
        self.client = None
        self.current_model_index = 0  # Track which model we're using
        self.last_request_time = 0
        self.min_request_interval = 1.0  # Minimum seconds between requests
        
        self.stats = {
            "total_analyzed": 0,
            "total_shorts": 0,
            "total_monitors": 0,
            "total_passes": 0,
            "total_api_cost_usd": 0.0,
            "avg_processing_time_ms": 0,
            "api_errors": 0,
            "batch_requests": 0,
            "rate_limit_hits": 0,
            "model_fallbacks": 0,
            "batches_split": 0
        }
        
        if not mock_mode:
            self._init_gemini_client(api_key)
        else:
            logger.info("Running in MOCK MODE - using rule-based analyzer")
    
    def _init_gemini_client(self, api_key: Optional[str] = None):
        """Initialize Gemini API client (production only)"""
        api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key required. Set GEMINI_API_KEY env var.")
        
        os.environ["GOOGLE_API_KEY"] = api_key
        self.client = genai.Client(api_key=api_key)
        logger.info(f"✅ Gemini API client initialized (model: {self.MODELS[0]})")
    
    def _rate_limit(self):
        """Enforce minimum time between API requests"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_interval:
            sleep_time = self.min_request_interval - elapsed
            time.sleep(sleep_time)
        self.last_request_time = time.time()
    
    def _get_current_model(self) -> str:
        """Get the current model to use"""
        return self.MODELS[min(self.current_model_index, len(self.MODELS) - 1)]
    
    def _fallback_to_next_model(self):
        """Switch to the next model in the fallback chain"""
        if self.current_model_index < len(self.MODELS) - 1:
            self.current_model_index += 1
            self.stats["model_fallbacks"] += 1
            new_model = self._get_current_model()
            logger.warning(f"⚠️  Falling back to model: {new_model}")
            return True
        return False
    
    def _estimate_token_count(self, text: str) -> int:
        """Rough estimate of token count"""
        return len(text) // 4  # Rough approximation
    
    def _should_split_batch(self, flagged_tokens: List[FlaggedToken]) -> bool:
        """Determine if batch should be split based on size"""
        if len(flagged_tokens) <= self.MAX_BATCH_SIZE:
            return False
        
        # Estimate token count for the batch
        tokens_data = self._format_tokens_batch(flagged_tokens[:5])  # Sample
        avg_tokens_per_item = self._estimate_token_count(tokens_data) / 5
        total_estimated = avg_tokens_per_item * len(flagged_tokens)
        
        return total_estimated > self.MAX_TOKENS_PER_BATCH
    
    def _format_tokens_batch(self, flagged_tokens: List[FlaggedToken]) -> str:
        """Format multiple flagged tokens for batch analysis"""
        tokens_text = []
        
        for idx, flagged in enumerate(flagged_tokens, 1):
            signal = flagged.signal
            token_text = f"""
TOKEN {idx}:
Symbol: {signal.token_symbol}
Address: {signal.token_address}
Chain: {signal.chain}
Category: {signal.category}
Market Cap: ${signal.market_cap_usd:,.0f}
Urgency Score: {flagged.urgency_score}/10

ON-CHAIN SIGNALS (24h):
- TVL: ${signal.tvl_usd:,.0f} ({signal.tvl_change_24h:+.1f}%)
- Liquidity Change: {signal.liquidity_change_24h:+.1f}%
- Top 10 Holder Concentration: {signal.holder_concentration_top10:.1f}%
- Insider Sells: {signal.insider_sells_24h} transactions, ${signal.insider_sell_volume_usd:,.0f}

SOCIAL SIGNALS:
- Twitter Engagement Change (48h): {signal.twitter_engagement_change_48h:+.1f}%
- Twitter Mentions (24h): {signal.twitter_mentions_24h}
- Sentiment Score: {signal.twitter_sentiment_score:.2f}
- Influencer Silence: {signal.influencer_silence_hours:.0f} hours

PROTOCOL HEALTH:
- GitHub Commits (7d): {signal.github_commits_7d}
- Commit Change: {signal.github_commit_change:+.1f}%
- Developer Departures (30d): {signal.dev_departures_30d}

GOVERNANCE:
- Recent Vote: {signal.recent_vote_type}
- Vote Passed: {signal.vote_passed}

TIER 1 REASONING: {flagged.reasoning}
"""
            tokens_text.append(token_text)
        
        return "\n" + "="*80 + "\n".join(tokens_text)
    
    def _mock_analyze_batch(self, flagged_tokens: List[FlaggedToken]) -> List[TradePlan]:
        """
        Rule-based batch analysis for testing (mock Gemini)
        """
        trade_plans = []
        
        for flagged in flagged_tokens:
            signal = flagged.signal
            
            # Calculate confidence based on red flags
            confidence = 0
            risk_factors = []
            
            # High-impact signals
            if signal.insider_sells_24h > 5 and signal.insider_sell_volume_usd > 500000:
                confidence += 25
                risk_factors.append("Major insider dump detected")
            
            if signal.liquidity_change_24h < -40:
                confidence += 20
                risk_factors.append("Severe liquidity removal")
            
            if signal.tvl_change_24h < -40:
                confidence += 20
                risk_factors.append("TVL collapse")
            
            # Medium-impact signals
            if signal.twitter_engagement_change_48h < -60:
                confidence += 15
                risk_factors.append("Twitter engagement crash")
            
            if signal.dev_departures_30d > 2:
                confidence += 10
                risk_factors.append("Multiple developer exits")
            
            if signal.influencer_silence_hours > 72:
                confidence += 10
                risk_factors.append("Prolonged influencer silence")
            
            # Governance risks
            if signal.vote_passed and signal.recent_vote_type == "treasury_raid":
                confidence += 15
                risk_factors.append("Treasury raid vote passed")
            elif signal.vote_passed and signal.recent_vote_type == "inflation":
                confidence += 10
                risk_factors.append("Token inflation approved")
            
            # Determine decision
            if confidence >= 70:
                decision = "SHORT"
            elif confidence >= 50:
                decision = "MONITOR"
            else:
                decision = "PASS"
            
            # Position sizing based on confidence
            if confidence >= 90:
                position_size_pct = 20.0
            elif confidence >= 80:
                position_size_pct = 15.0
            elif confidence >= 70:
                position_size_pct = 10.0
            else:
                position_size_pct = 0.0
            
            # Position size in USD (max $10k per trade for testing)
            position_size_usd = position_size_pct * 500  # $10k if 20% 
            
            # leverage
            leverage = 2 if confidence < 85 else 5
            
            # Estimate current price (mock)
            current_price = 1.0 if signal.market_cap_usd > 10_000_000 else 0.50
            
            # Take-profit levels based on category
            if signal.category == "memecoin":
                tp1_pct, tp2_pct, tp3_pct = -33, -67, -85
            elif signal.category == "defi":
                tp1_pct, tp2_pct, tp3_pct = -25, -50, -70
            else:
                tp1_pct, tp2_pct, tp3_pct = -20, -40, -60
            
            # Best chain selection (prefer deepest liquidity)
            chain_liquidity = {
                "ethereum": signal.tvl_usd * 0.5,
                "arbitrum": signal.tvl_usd * 0.3,
                "base": signal.tvl_usd * 0.15,
                "optimism": signal.tvl_usd * 0.05
            }
            best_chain = max(chain_liquidity, key=chain_liquidity.get)
            
            # Estimate gas
            gas_costs = {
                "ethereum": 25.0,
                "arbitrum": 2.0,
                "base": 0.5,
                "optimism": 1.5
            }
            
            # Generate reasoning
            if decision == "SHORT":
                top_risks = risk_factors[:3]
                reasoning = f"High-confidence short opportunity. {' + '.join(top_risks)}. "
                reasoning += f"Execute on {best_chain} for optimal liquidity."
            elif decision == "MONITOR":
                reasoning = f"Moderate concerns detected: {', '.join(risk_factors[:2])}. "
                reasoning += "Requires additional confirmation before entering position."
            else:
                reasoning = "Insufficient evidence for short position. Signals below confidence threshold."
            
            trade_plan = TradePlan(
                token_symbol=signal.token_symbol,
                token_address=signal.token_address,
                chain=signal.chain,
                decision=decision,
                confidence=min(confidence, 100),
                position_size_percent=position_size_pct,
                position_size_usd=position_size_usd,
                leverage=leverage,
                entry_price=current_price,
                take_profit_1=current_price * (1 + tp1_pct/100),
                take_profit_1_percent=tp1_pct,
                take_profit_2=current_price * (1 + tp2_pct/100),
                take_profit_2_percent=tp2_pct,
                take_profit_3=current_price * (1 + tp3_pct/100),
                take_profit_3_percent=tp3_pct,
                stop_loss=current_price * 1.12,
                stop_loss_percent=12.0,
                best_execution_chain=best_chain,
                estimated_gas_usd=gas_costs.get(best_chain, 5.0),
                reasoning=reasoning,
                risk_factors=risk_factors,
                analyzed_at=datetime.utcnow().isoformat(),
                urgency_score=flagged.urgency_score
            )
            trade_plans.append(trade_plan)
        
        return trade_plans
    
    def _gemini_analyze_batch(self, flagged_tokens: List[FlaggedToken]) -> List[TradePlan]:
        """
        Use Gemini for batch analysis with intelligent retry and rate limiting
        """
        if not flagged_tokens:
            return []
        
        # Check if we should split the batch
        if self._should_split_batch(flagged_tokens):
            return self._analyze_with_splitting(flagged_tokens)
        
        # Single batch processing with retry logic
        tokens_data = self._format_tokens_batch(flagged_tokens)
        prompt = self.BATCH_ANALYSIS_PROMPT.format(
            num_tokens=len(flagged_tokens),
            tokens_data=tokens_data
        )
        
        # Try with retries and model fallbacks
        for retry_attempt in range(len(self.RETRY_DELAYS) + 1):
            try:
                # Rate limiting
                self._rate_limit()
                
                current_model = self._get_current_model()
                logger.info(f"📡 Sending BATCH request to Gemini ({current_model}) for {len(flagged_tokens)} tokens...")
                
                response = self.client.models.generate_content(
                    model=current_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=1.0,  # Keep default for Gemini 3
                        response_mime_type="application/json"
                    )
                )
                
                # Parse JSON response
                content = response.text
                
                # Extract JSON if wrapped in markdown
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                
                analyses = json.loads(content.strip())
                
                # Estimate API cost (Gemini Flash is free tier friendly)
                input_chars = len(prompt)
                output_chars = len(content)
                input_tokens = input_chars / 4
                output_tokens = output_chars / 4
                
                # Cost varies by model (Flash is essentially free)
                if "flash" in current_model.lower():
                    cost = 0.0  # Free tier
                else:
                    cost = (input_tokens / 1_000_000 * 1.25) + (output_tokens / 1_000_000 * 5.0)
                
                self.stats["total_api_cost_usd"] += cost
                self.stats["batch_requests"] += 1
                
                logger.info(f"✅ Received Gemini batch analysis for {len(analyses)} tokens (cost: ${cost:.4f})")
                
                # Build TradePlans from Gemini response
                return self._parse_gemini_response(analyses, flagged_tokens)
                
            except Exception as e:
                error_str = str(e)
                error_dict = {}
                
                # Try to parse error JSON
                try:
                    if hasattr(e, 'message'):
                        error_dict = json.loads(str(e.message)) if isinstance(e.message, str) else {}
                    elif 'error' in error_str:
                        # Extract JSON from error string
                        import re
                        json_match = re.search(r'\{.*\}', error_str, re.DOTALL)
                        if json_match:
                            error_dict = json.loads(json_match.group())
                except:
                    pass
                
                error_code = error_dict.get('error', {}).get('code', 0)
                error_status = error_dict.get('error', {}).get('status', '')
                
                # Handle 404 NOT_FOUND - model doesn't exist, fallback immediately
                if error_code == 404 or "404" in error_str or "NOT_FOUND" in error_str:
                    logger.error(f"Gemini API error: {error_code} {error_status}. {error_dict}")
                    
                    # Try next model in fallback chain
                    if self._fallback_to_next_model():
                        logger.warning(f"⚠️  Model not found, trying next model...")
                        continue
                    else:
                        logger.error("All models exhausted, using mock analysis")
                        return self._mock_analyze_batch(flagged_tokens)
                
                # Handle rate limit (429)
                elif error_code == 429 or "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                    self.stats["rate_limit_hits"] += 1
                    logger.error(f"Gemini API error: {error_code} {error_status}. {error_dict}")
                    
                    # Try to fallback to next model
                    if self._fallback_to_next_model():
                        logger.warning(f"⚠️  Rate limit hit, trying next model...")
                        continue
                    
                    # Or split batch if we have multiple tokens
                    if len(flagged_tokens) > 1:
                        logger.warning(f"⚠️  Rate limit hit, splitting batch...")
                        return self._analyze_with_splitting(flagged_tokens)
                    
                    # Or retry with delay for single token
                    if retry_attempt < len(self.RETRY_DELAYS):
                        delay = self.RETRY_DELAYS[retry_attempt]
                        logger.warning(f"Retrying in {delay}s...")
                        time.sleep(delay)
                        continue
                
                # Handle quota exhausted - split into smaller batches
                elif "quota" in error_str.lower() and len(flagged_tokens) > 1:
                    logger.warning(f"⚠️  Quota issue, splitting batch...")
                    return self._analyze_with_splitting(flagged_tokens)
                
                # Other errors
                else:
                    logger.error(f"Gemini API error: {error_str}")
                    self.stats["api_errors"] += 1
                    
                    if retry_attempt < len(self.RETRY_DELAYS):
                        delay = self.RETRY_DELAYS[retry_attempt]
                        logger.warning(f"Retrying in {delay}s...")
                        time.sleep(delay)
                    else:
                        # Final fallback to mock
                        logger.error("All retries exhausted, using mock analysis")
                        return self._mock_analyze_batch(flagged_tokens)
        
        # Should never reach here, but fallback to mock
        return self._mock_analyze_batch(flagged_tokens)
    
    def _analyze_with_splitting(self, flagged_tokens: List[FlaggedToken]) -> List[TradePlan]:
        """Split large batch into smaller chunks and process sequentially"""
        chunk_size = min(self.MAX_BATCH_SIZE, math.ceil(len(flagged_tokens) / 3))
        chunks = [flagged_tokens[i:i + chunk_size] for i in range(0, len(flagged_tokens), chunk_size)]
        
        self.stats["batches_split"] += 1
        logger.info(f"📦 Splitting {len(flagged_tokens)} tokens into {len(chunks)} batches of ~{chunk_size}")
        
        all_trade_plans = []
        for idx, chunk in enumerate(chunks, 1):
            logger.info(f"  Processing chunk {idx}/{len(chunks)} ({len(chunk)} tokens)...")
            trade_plans = self._gemini_analyze_batch(chunk)
            all_trade_plans.extend(trade_plans)
            
            # Add delay between chunks to avoid rate limits
            if idx < len(chunks):
                time.sleep(2)
        
        return all_trade_plans
    
    def _parse_gemini_response(self, analyses: List[Dict], flagged_tokens: List[FlaggedToken]) -> List[TradePlan]:
        """Parse Gemini JSON response into TradePlan objects"""
        trade_plans = []
        
        # Ensure we don't have length mismatch
        if len(analyses) != len(flagged_tokens):
            logger.warning(f"⚠️  Response mismatch: got {len(analyses)} analyses for {len(flagged_tokens)} tokens")
            # Fallback to mock if mismatch
            return self._mock_analyze_batch(flagged_tokens)
        
        for analysis, flagged in zip(analyses, flagged_tokens):
            try:
                signal = flagged.signal
                current_price = 1.0  # Would come from price oracle
                
                trade_plan = TradePlan(
                    token_symbol=analysis["token_symbol"],
                    token_address=analysis["token_address"],
                    chain=analysis["chain"],
                    decision=analysis["decision"],
                    confidence=analysis["confidence"],
                    position_size_percent=analysis["position_size_percent"],
                    position_size_usd=analysis.get("position_size_usd", analysis["position_size_percent"] * 500),
                    leverage=analysis.get("leverage", 2),
                    entry_price=current_price,
                    take_profit_1=current_price * (1 + analysis["take_profit_levels"][0]["price_target"]/100),
                    take_profit_1_percent=analysis["take_profit_levels"][0]["price_target"],
                    take_profit_2=current_price * (1 + analysis["take_profit_levels"][1]["price_target"]/100),
                    take_profit_2_percent=analysis["take_profit_levels"][1]["price_target"],
                    take_profit_3=current_price * (1 + analysis["take_profit_levels"][2]["price_target"]/100),
                    take_profit_3_percent=analysis["take_profit_levels"][2]["price_target"],
                    stop_loss=current_price * (1 + analysis["stop_loss_percent"]/100),
                    stop_loss_percent=analysis["stop_loss_percent"],
                    best_execution_chain=analysis["best_execution_chain"],
                    estimated_gas_usd=5.0,  # Would come from gas oracle
                    reasoning=analysis["reasoning"],
                    risk_factors=analysis["risk_factors"],
                    analyzed_at=datetime.utcnow().isoformat(),
                    urgency_score=flagged.urgency_score
                )
                
                trade_plans.append(trade_plan)
                
                logger.info(
                    f"  └─ {trade_plan.token_symbol}: {trade_plan.decision} "
                    f"(conf: {trade_plan.confidence}%)"
                )
            except (KeyError, IndexError) as e:
                logger.error(f"Failed to parse analysis for {flagged.signal.token_symbol}: {e}")
                continue
        
        return trade_plans
    
    def analyze(self, flagged: FlaggedToken) -> TradePlan:
        """
        Analyze a single token (redirects to batch analysis for consistency)
        
        Args:
            flagged: FlaggedToken from Tier 1 screening
        
        Returns:
            TradePlan with decision and trade parameters
        """
        # For single token, use batch with size 1
        trade_plans = self.analyze_batch([flagged])
        return trade_plans[0] if trade_plans else None
    
    def analyze_batch(self, flagged_tokens: List[FlaggedToken]) -> List[TradePlan]:
        """
        Analyze a batch of flagged tokens with SINGLE API REQUEST
        
        Args:
            flagged_tokens: List of FlaggedToken from Tier 1 screening
        
        Returns:
            List of TradePlan with decisions and trade parameters
        """
        if not flagged_tokens:
            return []
        
        start_time = time.time()
        
        logger.info(f"🔍 Analyzing {len(flagged_tokens)} tokens in SINGLE BATCH request...")
        
        if self.mock_mode:
            trade_plans = self._mock_analyze_batch(flagged_tokens)
        else:
            trade_plans = self._gemini_analyze_batch(flagged_tokens)
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        # Update stats
        for trade_plan in trade_plans:
            self.stats["total_analyzed"] += 1
            if trade_plan.decision == "SHORT":
                self.stats["total_shorts"] += 1
            elif trade_plan.decision == "MONITOR":
                self.stats["total_monitors"] += 1
            else:
                self.stats["total_passes"] += 1
        
        # Update avg processing time
        if self.stats["total_analyzed"] > 0:
            self.stats["avg_processing_time_ms"] = (
                (self.stats["avg_processing_time_ms"] * (self.stats["total_analyzed"] - len(trade_plans)) 
                 + processing_time_ms)
                / self.stats["total_analyzed"]
            )
        
        # Log batch results
        shorts = sum(1 for tp in trade_plans if tp.decision == "SHORT")
        monitors = sum(1 for tp in trade_plans if tp.decision == "MONITOR")
        passes = sum(1 for tp in trade_plans if tp.decision == "PASS")
        
        logger.info(
            f"✅ Batch analysis complete: {shorts} SHORT, {monitors} MONITOR, "
            f"{passes} PASS (processed in {processing_time_ms:.0f}ms)"
        )
        
        return trade_plans
    
    def get_stats(self) -> Dict[str, Any]:
        """Get analysis statistics including rate limiting info"""
        return {
            **self.stats,
            "short_rate": self.stats["total_shorts"] / max(self.stats["total_analyzed"], 1),
            "current_model": self._get_current_model() if not self.mock_mode else "mock",
            "timestamp": datetime.utcnow().isoformat()
        }


# Example usage
if __name__ == "__main__":
    from data_ingestion import DataIngestion
    from local_llm_screener import LocalLLMScreener
    
    # Generate and screen test data
    ingestion = DataIngestion()
    signals = ingestion.generate_batch(size=50, rug_pull_ratio=0.10)
    
    screener = LocalLLMScreener(mock_mode=True)
    flagged = screener.screen_batch(signals)
    
    # Analyze flagged tokens with Gemini (SINGLE BATCH REQUEST)
    analyzer = GeminiAnalyzer(mock_mode=True)
    trade_plans = analyzer.analyze_batch(flagged)
    
    print("\n" + "="*80)
    print(f"TIER 2 RESULTS: {len(trade_plans)} tokens analyzed in SINGLE batch")
    print("="*80)
    
    # Show SHORT recommendations
    shorts = [tp for tp in trade_plans if tp.decision == "SHORT"]
    print(f"\n🎯 {len(shorts)} SHORT RECOMMENDATIONS:")
    for tp in shorts:
        print(f"\n{tp.token_symbol} on {tp.best_execution_chain}")
        print(f"  Confidence: {tp.confidence}% | Position: {tp.position_size_percent}%")
        print(f"  TPs: {tp.take_profit_1_percent}%, {tp.take_profit_2_percent}%, {tp.take_profit_3_percent}%")
        print(f"  SL: +{tp.stop_loss_percent}%")
        print(f"  Reasoning: {tp.reasoning}")
    
    print("\n" + "="*80)
    print("STATS:")
    print(json.dumps(analyzer.get_stats(), indent=2))
