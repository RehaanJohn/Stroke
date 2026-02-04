"""
Claude Analyzer (Tier 2)
Deep analysis using Claude Sonnet 4 for high-confidence trade recommendations
"""

import logging
import json
import time
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, asdict
import os

# Note: For production, uncomment
# from anthropic import Anthropic, APIError, RateLimitError

from .local_llm_screener import FlaggedToken

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class TradePlan:
    """Structured trade recommendation from Claude"""
    token_symbol: str
    token_address: str
    chain: str
    
    decision: str  # "SHORT", "MONITOR", "PASS"
    confidence: int  # 0-100
    
    position_size_percent: float  # % of portfolio
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


class ClaudeAnalyzer:
    """
    Tier 2: Deep analysis using Claude Sonnet 4
    Processes only flagged tokens (5-15/minute)
    """
    
    # Claude prompt for structured analysis
    ANALYSIS_PROMPT = """You are an expert crypto trading analyst specializing in short-selling opportunities. Analyze this flagged token and provide a detailed trade recommendation.

TOKEN DATA:
{token_data}

TIER 1 SCREENING RESULT:
- Urgency Score: {urgency}/10
- Initial Reasoning: {tier1_reasoning}

ANALYSIS REQUIREMENTS:
1. Evaluate if this is a HIGH-CONFIDENCE short opportunity (≥70% confidence)
2. Consider cross-chain liquidity for optimal execution
3. Provide risk-adjusted position sizing
4. Set realistic take-profit levels based on historical crash patterns
5. Define protective stop-loss

OUTPUT FORMAT (JSON only):
{{
  "decision": "SHORT" | "MONITOR" | "PASS",
  "confidence": 0-100,
  "position_size_percent": 0-20,
  "take_profit_levels": [
    {{"level": 1, "price_target": -20.0, "close_percent": 30}},
    {{"level": 2, "price_target": -50.0, "close_percent": 40}},
    {{"level": 3, "price_target": -75.0, "close_percent": 30}}
  ],
  "stop_loss_percent": 12.0,
  "best_execution_chain": "ethereum" | "arbitrum" | "base" | "optimism",
  "reasoning": "2-3 sentence explanation focusing on strongest signals",
  "risk_factors": ["list", "of", "3-5", "key", "risks"]
}}

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

Analyze now:"""

    def __init__(self, api_key: Optional[str] = None, mock_mode: bool = True):
        """
        Initialize Claude Analyzer
        
        Args:
            api_key: Anthropic API key (or set ANTHROPIC_API_KEY env var)
            mock_mode: If True, use rule-based analysis instead of API calls
        """
        self.mock_mode = mock_mode
        self.client = None
        
        self.stats = {
            "total_analyzed": 0,
            "total_shorts": 0,
            "total_monitors": 0,
            "total_passes": 0,
            "total_api_cost_usd": 0.0,
            "avg_processing_time_ms": 0,
            "api_errors": 0
        }
        
        if not mock_mode:
            self._init_claude_client(api_key)
        else:
            logger.info("Running in MOCK MODE - using rule-based analyzer")
    
    def _init_claude_client(self, api_key: Optional[str] = None):
        """Initialize Claude API client (production only)"""
        # Uncomment for production:
        """
        from anthropic import Anthropic
        
        api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("Anthropic API key required. Set ANTHROPIC_API_KEY env var.")
        
        self.client = Anthropic(api_key=api_key)
        logger.info("Claude Sonnet 4 API client initialized")
        """
        pass
    
    def _format_token_data(self, flagged: FlaggedToken) -> str:
        """Format flagged token data for Claude"""
        signal = flagged.signal
        
        return f"""
Token: {signal.token_symbol}
Address: {signal.token_address}
Chain: {signal.chain}
Category: {signal.category}
Market Cap: ${signal.market_cap_usd:,.0f}

ON-CHAIN SIGNALS (24h):
- TVL: ${signal.tvl_usd:,.0f} ({signal.tvl_change_24h:+.1f}%)
- Liquidity Change: {signal.liquidity_change_24h:+.1f}%
- Top 10 Holder Concentration: {signal.holder_concentration_top10:.1f}%
- Insider Sells: {signal.insider_sells_24h} transactions, ${signal.insider_sell_volume_usd:,.0f}

SOCIAL SIGNALS:
- Twitter Engagement Change (48h): {signal.twitter_engagement_change_48h:+.1f}%
- Twitter Mentions (24h): {signal.twitter_mentions_24h}
- Sentiment Score: {signal.twitter_sentiment_score:.2f} (-1 to +1)
- Influencer Silence: {signal.influencer_silence_hours:.0f} hours

PROTOCOL HEALTH:
- GitHub Commits (7d): {signal.github_commits_7d}
- Commit Change: {signal.github_commit_change:+.1f}%
- Developer Departures (30d): {signal.dev_departures_30d}

GOVERNANCE:
- Recent Vote: {signal.recent_vote_type}
- Vote Passed: {signal.vote_passed}

PRICE ACTION:
- 24h Price Change: {signal.price_change_24h:+.1f}%
- 24h Volume: ${signal.volume_24h_usd:,.0f}

Timestamp: {signal.timestamp}
"""
    
    def _mock_analyze(self, flagged: FlaggedToken) -> TradePlan:
        """
        Rule-based deep analysis for testing (mock Claude)
        """
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
            position_size = 20.0
        elif confidence >= 80:
            position_size = 15.0
        elif confidence >= 70:
            position_size = 10.0
        else:
            position_size = 0.0
        
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
            "ethereum": signal.tvl_usd * 0.5,  # Assume 50% on ETH
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
        
        return TradePlan(
            token_symbol=signal.token_symbol,
            token_address=signal.token_address,
            chain=signal.chain,
            decision=decision,
            confidence=min(confidence, 100),
            position_size_percent=position_size,
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
    
    def _claude_analyze(self, flagged: FlaggedToken) -> TradePlan:
        """
        Use actual Claude Sonnet 4 for deep analysis (production)
        """
        # Uncomment for production:
        """
        from anthropic import APIError, RateLimitError
        
        token_data = self._format_token_data(flagged)
        prompt = self.ANALYSIS_PROMPT.format(
            token_data=token_data,
            urgency=flagged.urgency_score,
            tier1_reasoning=flagged.reasoning
        )
        
        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1500,
                temperature=0.3,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Parse JSON response
            content = response.content[0].text
            
            # Extract JSON (Claude sometimes adds markdown)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            
            analysis = json.loads(content)
            
            # Calculate API cost (rough estimate)
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            cost = (input_tokens / 1_000_000 * 3.0) + (output_tokens / 1_000_000 * 15.0)
            self.stats["total_api_cost_usd"] += cost
            
            # Build TradePlan from Claude response
            signal = flagged.signal
            current_price = 1.0  # Would come from price oracle
            
            return TradePlan(
                token_symbol=signal.token_symbol,
                token_address=signal.token_address,
                chain=signal.chain,
                decision=analysis["decision"],
                confidence=analysis["confidence"],
                position_size_percent=analysis["position_size_percent"],
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
            
        except RateLimitError as e:
            logger.error(f"Claude API rate limit: {e}")
            self.stats["api_errors"] += 1
            # Fallback to mock
            return self._mock_analyze(flagged)
        
        except APIError as e:
            logger.error(f"Claude API error: {e}")
            self.stats["api_errors"] += 1
            return self._mock_analyze(flagged)
        """
        
        # Fallback to mock for now
        return self._mock_analyze(flagged)
    
    def analyze(self, flagged: FlaggedToken) -> TradePlan:
        """
        Perform deep analysis on a flagged token
        
        Args:
            flagged: FlaggedToken from Tier 1 screening
        
        Returns:
            TradePlan with decision and trade parameters
        """
        start_time = time.time()
        
        logger.info(f"Analyzing {flagged.signal.token_symbol} (urgency: {flagged.urgency_score}/10)...")
        
        if self.mock_mode:
            trade_plan = self._mock_analyze(flagged)
        else:
            trade_plan = self._claude_analyze(flagged)
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        # Update stats
        self.stats["total_analyzed"] += 1
        if trade_plan.decision == "SHORT":
            self.stats["total_shorts"] += 1
        elif trade_plan.decision == "MONITOR":
            self.stats["total_monitors"] += 1
        else:
            self.stats["total_passes"] += 1
        
        # Update avg processing time
        self.stats["avg_processing_time_ms"] = (
            (self.stats["avg_processing_time_ms"] * (self.stats["total_analyzed"] - 1) + processing_time_ms)
            / self.stats["total_analyzed"]
        )
        
        # Log result
        if trade_plan.decision == "SHORT":
            logger.info(
                f"🎯 SHORT SIGNAL: {trade_plan.token_symbol} "
                f"(confidence: {trade_plan.confidence}%, size: {trade_plan.position_size_percent}%)"
            )
        elif trade_plan.decision == "MONITOR":
            logger.info(f"👀 MONITOR: {trade_plan.token_symbol} (confidence: {trade_plan.confidence}%)")
        else:
            logger.debug(f"⛔ PASS: {trade_plan.token_symbol}")
        
        return trade_plan
    
    def analyze_batch(self, flagged_tokens: List[FlaggedToken]) -> List[TradePlan]:
        """Analyze a batch of flagged tokens"""
        trade_plans = []
        
        for flagged in flagged_tokens:
            trade_plan = self.analyze(flagged)
            trade_plans.append(trade_plan)
        
        return trade_plans
    
    def get_stats(self) -> Dict[str, Any]:
        """Get analysis statistics"""
        return {
            **self.stats,
            "short_rate": self.stats["total_shorts"] / max(self.stats["total_analyzed"], 1),
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
    
    # Analyze flagged tokens with Claude
    analyzer = ClaudeAnalyzer(mock_mode=True)
    trade_plans = analyzer.analyze_batch(flagged)
    
    print("\n" + "="*80)
    print(f"TIER 2 RESULTS: {len(trade_plans)} tokens analyzed")
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
