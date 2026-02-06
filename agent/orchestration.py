"""
Orchestration Engine
Coordinates Tier 1 → Tier 2 flow with batching, caching, and error handling
"""

import logging
import time
import asyncio
from typing import List, Dict, Any
from datetime import datetime
from collections import deque

from .data_ingestion import DataIngestion, TokenSignal
from .local_llm_screener import LocalLLMScreener, FlaggedToken
from .gemini_analyzer import GeminiAnalyzer, TradePlan
from .social_monitor import SocialMonitor
from .blockchain_integration import BlockchainIntegration
from .signal_classifier import SignalClassifier, Strategy, Classification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OrchestrationEngine:
    """
    Main coordinator for two-tier screening system
    Manages data flow: Raw signals → Tier 1 → Tier 2 → Execution
    """
    
    def __init__(
        self,
        batch_size: int = 100,
        tier1_mock: bool = True,
        tier2_mock: bool = True,
        max_tier2_parallel: int = 5
    ):
        """
        Initialize orchestration engine
        
        Args:
            batch_size: Number of tokens to process per Tier 1 batch
            tier1_mock: Use mock classifier for Tier 1
            tier2_mock: Use mock analyzer for Tier 2
            max_tier2_parallel: Max parallel Claude API calls
        """
        self.batch_size = batch_size
        self.max_tier2_parallel = max_tier2_parallel
        
        # Initialize components
        self.data_ingestion = DataIngestion()
        self.tier1_screener = LocalLLMScreener(mock_mode=tier1_mock)
        self.tier2_analyzer = GeminiAnalyzer(mock_mode=tier2_mock)
        self.social_monitor = SocialMonitor()  # Twitter/X monitor
        self.signal_classifier = SignalClassifier()  # Strategy router
        
        # Initialize blockchain integration
        import os
        blockchain_enabled = os.getenv("BLOCKCHAIN_ENABLED", "false").lower() == "true"
        self.blockchain = BlockchainIntegration(
            blockchain_service_url=os.getenv("BLOCKCHAIN_SERVICE_URL", "http://localhost:8001"),
            min_confidence_for_publish=int(os.getenv("BLOCKCHAIN_MIN_CONFIDENCE_PUBLISH", "60")),
            min_confidence_for_short=int(os.getenv("BLOCKCHAIN_MIN_CONFIDENCE_SHORT", "75")),
            enabled=blockchain_enabled
        )
        logger.info(f"Blockchain integration: {'ENABLED' if blockchain_enabled else 'DISABLED'}")
        
        # Processing queues
        self.signal_queue = deque()  # Incoming raw signals
        self.flagged_queue = deque()  # Tier 1 flagged tokens
        self.trade_plans = []  # Tier 2 outputs
        
        # Aggregated stats
        self.stats = {
            "total_signals_ingested": 0,
            "social_signals_ingested": 0,  # New: Twitter signals
            "tier1_processed": 0,
            "tier1_flagged": 0,
            "tier2_analyzed": 0,
            "tier2_shorts": 0,
            "tier2_monitors": 0,
            "tier2_passes": 0,
            "total_runtime_seconds": 0,
            "cycles_completed": 0,
            "errors": []
        }
        
        self.is_running = False
    
    def ingest_signals(self, count: int = 100, rug_pull_ratio: float = 0.05):
        """
        Ingest new token signals
        
        Args:
            count: Number of signals to generate
            rug_pull_ratio: Percentage that should be rug pulls
        """
        logger.info(f"Ingesting {count} new signals...")
        
        signals = self.data_ingestion.generate_batch(
            size=count,
            rug_pull_ratio=rug_pull_ratio
        )
        
        self.signal_queue.extend(signals)
        self.stats["total_signals_ingested"] += len(signals)
        
        logger.info(f"Signal queue now has {len(self.signal_queue)} pending signals")
    
    def ingest_social_signals(self, min_urgency: int = 7, limit: int = 50):
        """
        Ingest Twitter/X social signals from x_scrapper database
        
        Args:
            min_urgency: Minimum urgency score (1-10)
            limit: Maximum number of signals to ingest
        """
        logger.info(f"Ingesting social signals (urgency >= {min_urgency})...")
        
        try:
            # Get top signals from social monitor
            social_signals = self.social_monitor.get_top_signals(
                limit=limit,
                min_urgency=min_urgency
            )
            
            # Convert to text format for Tier 1 processing
            signal_texts = [s['text'] for s in social_signals]
            
            # Add to processing queue
            # Note: These are text signals, not TokenSignal objects
            # They'll be processed directly by tier1_screener.screen_batch()
            for signal in social_signals:
                self.signal_queue.append({
                    'text': signal['text'],
                    'urgency': signal['urgency'],
                    'source': 'social',
                    'type': signal['type'],
                    'metadata': {
                        'username': signal['username'],
                        'engagement': signal['engagement'],
                        'tokens': signal['tokens'],
                        'timestamp': signal['timestamp']
                    }
                })
            
            self.stats["social_signals_ingested"] += len(social_signals)
            logger.info(f"Added {len(social_signals)} social signals to queue")
            
            return len(social_signals)
            
        except Exception as e:
            logger.error(f"Error ingesting social signals: {e}")
            self.stats["errors"].append({
                "time": datetime.utcnow().isoformat(),
                "component": "social_ingestion",
                "error": str(e)
            })
            return 0
    
    def process_tier1_batch(self) -> List[FlaggedToken]:
        """
        Process one batch through Tier 1 screening
        
        Returns:
            List of flagged tokens
        """
        if not self.signal_queue:
            return []
        
        # Get batch from queue
        batch = []
        for _ in range(min(self.batch_size, len(self.signal_queue))):
            batch.append(self.signal_queue.popleft())
        
        logger.info(f"Processing Tier 1 batch ({len(batch)} signals)...")
        
        try:
            flagged = self.tier1_screener.screen_batch(batch)
            
            self.flagged_queue.extend(flagged)
            self.stats["tier1_processed"] += len(batch)
            self.stats["tier1_flagged"] += len(flagged)
            
            logger.info(
                f"Tier 1 complete: {len(flagged)}/{len(batch)} flagged "
                f"({len(flagged)/len(batch)*100:.1f}% flag rate)"
            )
            
            return flagged
        
        except Exception as e:
            logger.error(f"Tier 1 error: {e}")
            self.stats["errors"].append({
                "stage": "tier1",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            return []
    
    def process_tier2_batch(self, flagged: List[FlaggedToken]) -> List[TradePlan]:
        """
        Process flagged tokens through Tier 2 analysis
        
        Args:
            flagged: List of tokens flagged by Tier 1
        
        Returns:
            List of trade plans
        """
        if not flagged:
            return []
        
        logger.info(f"Processing Tier 2 batch ({len(flagged)} tokens)...")
        
        try:
            trade_plans = self.tier2_analyzer.analyze_batch(flagged)
            
            # Update stats
            self.stats["tier2_analyzed"] += len(trade_plans)
            for tp in trade_plans:
                if tp.decision == "SHORT":
                    self.stats["tier2_shorts"] += 1
                elif tp.decision == "MONITOR":
                    self.stats["tier2_monitors"] += 1
                else:
                    self.stats["tier2_passes"] += 1
            
            # Store trade plans
            self.trade_plans.extend(trade_plans)
            
            # Execute trade plans with hybrid strategy routing
            self._execute_trade_plans(trade_plans)
            
            logger.info(
                f"Tier 2 complete: {self.stats['tier2_shorts']} shorts, "
                f"{self.stats['tier2_monitors']} monitors"
            )
            
            return trade_plans
        
        except Exception as e:
            logger.error(f"Tier 2 error: {e}")
            self.stats["errors"].append({
                "stage": "tier2",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            return []
    
    def _execute_trade_plans(self, trade_plans: List[TradePlan]):
        """
        Execute trade plans using hybrid strategy routing
        Routes to GMX shorts, correlated shorts, or dip buys
        """
        if not self.blockchain.enabled:
            logger.info("Blockchain integration disabled, skipping execution")
            return
        
        for plan in trade_plans:
            if plan.decision != "SHORT":
                continue
            
            try:
                # Classify signal to determine execution strategy
                from .signal_classifier import TradePlan as ClassifierTradePlan
                classifier_plan = ClassifierTradePlan(
                    token_symbol=plan.token_symbol,
                    token_address=plan.token_address or '',
                    chain=plan.chain or 'arbitrum',
                    confidence=plan.confidence,
                    position_size_usd=plan.position_size_usd or 10000,
                    leverage=plan.leverage or 2,
                    reasoning=plan.reasoning
                )
                
                classification = self.signal_classifier.classify(classifier_plan)
                
                # Route to appropriate execution method
                if classification.strategy == Strategy.GMX_SHORT:
                    self._execute_gmx_short(plan, classification)
                    
                elif classification.strategy == Strategy.CORRELATED_SHORT:
                    self._execute_correlated_short(plan, classification)
                    
                elif classification.strategy == Strategy.DIP_BUY:
                    self._execute_dip_buy(plan, classification)
                    
                else:
                    logger.info(f"Skipping {plan.token_symbol}: {classification.reason}")
                    
            except Exception as e:
                logger.error(f"Execution error for {plan.token_symbol}: {e}")
    
    def _execute_gmx_short(self, plan: TradePlan, classification: Classification):
        """Execute GMX perpetual short on blue-chip token"""
        
        logger.info(f"Executing GMX SHORT for {plan.token_symbol}")
        
        try:
            result = self.blockchain.execute_short(
                index_token=plan.token_symbol,
                collateral_usdc=int(plan.position_size_usd * 1_000_000),  # Convert to 6 decimals
                leverage=min(plan.leverage, 10),  # Cap at 10x leverage
                confidence=plan.confidence,
                source_chain='arbitrum'  # Already on Arbitrum for GMX
            )
            
            logger.info(f"✅ GMX SHORT opened: Position ID {result.get('positionId')}")
            
        except Exception as e:
            logger.error(f"GMX SHORT failed for {plan.token_symbol}: {e}")
    
    def _execute_correlated_short(self, plan: TradePlan, classification: Classification):
        """Short correlated blue-chip when memecoin about to rug"""
        
        correlated = classification.correlated_asset or 'WETH'
        logger.info(f"Executing CORRELATED SHORT: {plan.token_symbol} → shorting {correlated}")
        
        # Discount position size and confidence for correlation risk
        adjusted_size = plan.position_size_usd * 0.5  # 50% of original size
        adjusted_confidence = int(plan.confidence * 0.7)  # 70% of original confidence
        
        try:
            result = self.blockchain.execute_short(
                index_token=correlated,
                collateral_usdc=int(adjusted_size * 1_000_000),
                leverage=2,  # Conservative 2x leverage
                confidence=adjusted_confidence,
                source_chain='arbitrum'
            )
            
            logger.info(
                f"✅ CORRELATED SHORT opened: {correlated} for {plan.token_symbol} "
                f"(Position ID {result.get('positionId')})"
            )
            
        except Exception as e:
            logger.error(f"CORRELATED SHORT failed for {plan.token_symbol}: {e}")
    
    def _execute_dip_buy(self, plan: TradePlan, classification: Classification):
        """Buy memecoin dip after rug for dead cat bounce"""
        
        logger.info(f"Executing DIP BUY for {plan.token_symbol} (dropped {classification.price_drop_24h}%)")
        
        # Validate it's truly post-rug
        if classification.price_drop_24h and classification.price_drop_24h > -60:
            logger.warning(f"Not a rug yet ({classification.price_drop_24h}%), skipping dip buy")
            return
        
        # Small position size for high-risk dip buys (max 5% of vault)
        max_size_usdc = self.blockchain.get_vault_balance() * 0.05 if hasattr(self.blockchain, 'get_vault_balance') else 5000
        position_size = min(plan.position_size_usd, max_size_usdc)
        
        # Calculate targets
        current_price = classification.current_price or 0
        take_profit = current_price * 1.4  # +40% bounce target
        stop_loss = current_price * 0.85   # -15% stop loss
        
        try:
            result = self.blockchain.execute_dip_buy(
                token=plan.token_address or '',
                chain=plan.chain or 'base',
                amount_usdc=int(position_size * 1_000_000),
                take_profit_price=take_profit,
                stop_loss_price=stop_loss,
                confidence=plan.confidence
            )
            
            logger.info(
                f"✅ DIP BUY executed for {plan.token_symbol}: "
                f"Entry ${current_price:.8f}, Target ${take_profit:.8f} (+40%)"
            )
            
        except Exception as e:
            logger.error(f"DIP BUY failed for {plan.token_symbol}: {e}")
    
    def run_cycle(self, signals_per_cycle: int = 500) -> Dict[str, Any]:
        """
        Run one complete screening cycle
        
        Args:
            signals_per_cycle: Number of new signals to ingest
        
        Returns:
            Cycle statistics
        """
        cycle_start = time.time()
        
        logger.info("="*80)
        logger.info(f"STARTING CYCLE #{self.stats['cycles_completed'] + 1}")
        logger.info("="*80)
        
        # Step 1: Ingest new signals
        self.ingest_signals(count=signals_per_cycle)
        
        # Step 2: Process all pending signals through Tier 1
        tier1_batches = 0
        total_flagged = []
        
        while self.signal_queue:
            flagged = self.process_tier1_batch()
            total_flagged.extend(flagged)
            tier1_batches += 1
        
        # Step 3: Process all flagged tokens through Tier 2
        if total_flagged:
            trade_plans = self.process_tier2_batch(total_flagged)
        else:
            trade_plans = []
        
        # Calculate cycle stats
        cycle_time = time.time() - cycle_start
        self.stats["total_runtime_seconds"] += cycle_time
        self.stats["cycles_completed"] += 1
        
        # Get component stats
        tier1_stats = self.tier1_screener.get_stats()
        tier2_stats = self.tier2_analyzer.get_stats()
        
        cycle_summary = {
            "cycle_number": self.stats["cycles_completed"],
            "cycle_time_seconds": round(cycle_time, 2),
            "signals_processed": signals_per_cycle,
            "tier1_batches": tier1_batches,
            "tier1_flagged": len(total_flagged),
            "tier2_analyzed": len(total_flagged),
            "tier2_shorts": sum(1 for tp in trade_plans if tp.decision == "SHORT"),
            "tier2_monitors": sum(1 for tp in trade_plans if tp.decision == "MONITOR"),
            "tier2_passes": sum(1 for tp in trade_plans if tp.decision == "PASS"),
            "claude_api_cost": tier2_stats.get("total_api_cost_usd", 0.0),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info("="*80)
        logger.info("CYCLE COMPLETE:")
        logger.info(f"  Time: {cycle_time:.2f}s")
        logger.info(f"  Tier 1: {signals_per_cycle} processed → {len(total_flagged)} flagged")
        logger.info(f"  Tier 2: {cycle_summary['tier2_shorts']} shorts, {cycle_summary['tier2_monitors']} monitors")
        logger.info(f"  Cost: ${tier2_stats.get('total_api_cost_usd', 0.0):.4f}")
        logger.info("="*80)
        
        return cycle_summary
    
    def get_short_recommendations(self, min_confidence: int = 70) -> List[TradePlan]:
        """
        Get all SHORT recommendations above confidence threshold
        
        Args:
            min_confidence: Minimum confidence score (0-100)
        
        Returns:
            List of high-confidence trade plans
        """
        return [
            tp for tp in self.trade_plans
            if tp.decision == "SHORT" and tp.confidence >= min_confidence
        ]
    
    def get_monitor_list(self) -> List[TradePlan]:
        """Get all tokens on MONITOR list"""
        return [tp for tp in self.trade_plans if tp.decision == "MONITOR"]
    
    def get_full_stats(self) -> Dict[str, Any]:
        """Get complete system statistics"""
        tier1_stats = self.tier1_screener.get_stats()
        tier2_stats = self.tier2_analyzer.get_stats()
        
        return {
            "system_stats": self.stats,
            "tier1_stats": tier1_stats,
            "tier2_stats": tier2_stats,
            "current_queues": {
                "pending_signals": len(self.signal_queue),
                "pending_flagged": len(self.flagged_queue),
                "total_trade_plans": len(self.trade_plans)
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def clear_old_plans(self, max_age_hours: int = 24):
        """Clear trade plans older than max_age_hours"""
        # TODO: Implement based on analyzed_at timestamp
        pass


# Example usage
if __name__ == "__main__":
    # Initialize engine
    engine = OrchestrationEngine(
        batch_size=100,
        tier1_mock=True,
        tier2_mock=True
    )
    
    # Run a single cycle
    summary = engine.run_cycle(signals_per_cycle=500)
    
    # Get short recommendations
    shorts = engine.get_short_recommendations(min_confidence=75)
    
    print("\n" + "="*80)
    print(f"HIGH-CONFIDENCE SHORTS ({len(shorts)}):")
    print("="*80)
    
    for tp in shorts[:5]:  # Show top 5
        print(f"\n🎯 {tp.token_symbol} on {tp.best_execution_chain}")
        print(f"   Confidence: {tp.confidence}% | Position: {tp.position_size_percent}%")
        print(f"   Entry: ${tp.entry_price:.4f}")
        print(f"   TP1: {tp.take_profit_1_percent}% | TP2: {tp.take_profit_2_percent}% | TP3: {tp.take_profit_3_percent}%")
        print(f"   SL: +{tp.stop_loss_percent}%")
        print(f"   Reasoning: {tp.reasoning}")
        print(f"   Risks: {', '.join(tp.risk_factors[:3])}")
    
    # Show full stats
    print("\n" + "="*80)
    print("FULL SYSTEM STATS:")
    print("="*80)
    import json
    print(json.dumps(engine.get_full_stats(), indent=2))
