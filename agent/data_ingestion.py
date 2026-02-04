"""
Data Ingestion Module
Generates mock crypto token signals for Tier 1 screening
"""

import random
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any
from dataclasses import dataclass, asdict
import json


@dataclass
class TokenSignal:
    """Represents a complete signal bundle for a crypto token"""
    token_symbol: str
    token_address: str
    chain: str
    timestamp: str
    
    # On-chain signals
    tvl_change_24h: float  # Percentage change
    tvl_usd: float
    liquidity_change_24h: float
    holder_concentration_top10: float  # Percentage held by top 10
    insider_sells_24h: int
    insider_sell_volume_usd: float
    
    # Social signals
    twitter_engagement_change_48h: float  # Percentage change
    twitter_mentions_24h: int
    twitter_sentiment_score: float  # -1 to 1
    influencer_silence_hours: float  # Hours since last mention
    
    # Protocol signals
    github_commits_7d: int
    github_commit_change: float  # Percentage vs previous week
    dev_departures_30d: int
    
    # Governance signals
    recent_vote_type: str  # "inflation", "fee_increase", "treasury_raid", "neutral"
    vote_passed: bool
    
    # Price action
    price_change_24h: float
    volume_24h_usd: float
    
    # Metadata
    market_cap_usd: float
    category: str  # "memecoin", "defi", "lsd", "gaming", "infra"


class DataIngestion:
    """Generates realistic mock token signals for testing"""
    
    CHAINS = ["ethereum", "arbitrum", "base", "optimism"]
    CATEGORIES = ["memecoin", "defi", "lsd", "gaming", "infra"]
    
    # Realistic token name prefixes for each category
    MEMECOIN_PREFIXES = ["PEPE", "DOGE", "SHIB", "FLOKI", "WOJAK", "BONK", "MEME", "MOON", "SAFE", "ELON"]
    DEFI_PREFIXES = ["PROTOCOL", "SWAP", "VAULT", "LEND", "YIELD", "FARM", "STAKE", "LIQUID", "SYNTH", "CURVE"]
    LSD_PREFIXES = ["stETH", "rETH", "cbETH", "frxETH", "sfrxETH", "wstETH", "ankrETH", "stMATIC"]
    
    def __init__(self, seed: int = 42):
        """Initialize with optional random seed for reproducibility"""
        random.seed(seed)
        self.generated_count = 0
    
    def generate_token_address(self) -> str:
        """Generate realistic Ethereum-style address"""
        return "0x" + "".join(random.choices("0123456789abcdef", k=40))
    
    def generate_token_symbol(self, category: str) -> str:
        """Generate realistic token symbol based on category"""
        if category == "memecoin":
            prefix = random.choice(self.MEMECOIN_PREFIXES)
            suffix = random.choice(["", "INU", "COIN", "TOKEN", "2.0", "AI"])
            return f"${prefix}{suffix}"
        elif category == "defi":
            prefix = random.choice(self.DEFI_PREFIXES)
            return f"${prefix}"
        elif category == "lsd":
            return random.choice(self.LSD_PREFIXES)
        else:
            return f"${random.choice(['GAME', 'PLAY', 'META', 'BUILD'])}{random.randint(1, 999)}"
    
    def generate_rug_pull_signal(self) -> TokenSignal:
        """Generate high-confidence rug pull signal (for testing)"""
        category = "memecoin"
        return TokenSignal(
            token_symbol=self.generate_token_symbol(category),
            token_address=self.generate_token_address(),
            chain=random.choice(self.CHAINS),
            timestamp=datetime.utcnow().isoformat(),
            
            # Strong negative on-chain signals
            tvl_change_24h=random.uniform(-60, -30),  # Major TVL drop
            tvl_usd=random.uniform(500_000, 5_000_000),
            liquidity_change_24h=random.uniform(-70, -40),  # LP removal
            holder_concentration_top10=random.uniform(70, 95),  # Concentrated holdings
            insider_sells_24h=random.randint(5, 15),
            insider_sell_volume_usd=random.uniform(200_000, 1_000_000),
            
            # Social signals showing abandonment
            twitter_engagement_change_48h=random.uniform(-80, -50),  # Engagement crash
            twitter_mentions_24h=random.randint(100, 500),
            twitter_sentiment_score=random.uniform(-0.8, -0.4),  # Very negative
            influencer_silence_hours=random.uniform(48, 120),  # Days of silence
            
            # Protocol signals
            github_commits_7d=random.randint(0, 2),  # Abandoned
            github_commit_change=random.uniform(-90, -60),
            dev_departures_30d=random.randint(2, 5),
            
            # Governance
            recent_vote_type=random.choice(["inflation", "treasury_raid"]),
            vote_passed=True,
            
            # Price action
            price_change_24h=random.uniform(-70, -40),  # Crashing
            volume_24h_usd=random.uniform(1_000_000, 10_000_000),
            
            # Metadata
            market_cap_usd=random.uniform(5_000_000, 50_000_000),
            category=category
        )
    
    def generate_healthy_signal(self) -> TokenSignal:
        """Generate signal for healthy project (should PASS screening)"""
        category = random.choice(["defi", "infra", "gaming"])
        return TokenSignal(
            token_symbol=self.generate_token_symbol(category),
            token_address=self.generate_token_address(),
            chain=random.choice(self.CHAINS),
            timestamp=datetime.utcnow().isoformat(),
            
            # Positive on-chain signals
            tvl_change_24h=random.uniform(-5, 15),  # Stable or growing
            tvl_usd=random.uniform(10_000_000, 500_000_000),
            liquidity_change_24h=random.uniform(-3, 10),
            holder_concentration_top10=random.uniform(15, 35),  # Distributed
            insider_sells_24h=random.randint(0, 2),
            insider_sell_volume_usd=random.uniform(0, 50_000),
            
            # Healthy social signals
            twitter_engagement_change_48h=random.uniform(-10, 20),
            twitter_mentions_24h=random.randint(500, 5000),
            twitter_sentiment_score=random.uniform(0.2, 0.7),  # Positive
            influencer_silence_hours=random.uniform(0, 24),
            
            # Active development
            github_commits_7d=random.randint(10, 50),
            github_commit_change=random.uniform(-10, 30),
            dev_departures_30d=0,
            
            # Governance
            recent_vote_type="neutral",
            vote_passed=random.choice([True, False]),
            
            # Price action
            price_change_24h=random.uniform(-10, 15),
            volume_24h_usd=random.uniform(5_000_000, 100_000_000),
            
            # Metadata
            market_cap_usd=random.uniform(50_000_000, 1_000_000_000),
            category=category
        )
    
    def generate_moderate_risk_signal(self) -> TokenSignal:
        """Generate signal with mixed indicators (edge case for testing)"""
        category = random.choice(self.CATEGORIES)
        return TokenSignal(
            token_symbol=self.generate_token_symbol(category),
            token_address=self.generate_token_address(),
            chain=random.choice(self.CHAINS),
            timestamp=datetime.utcnow().isoformat(),
            
            # Mixed on-chain signals
            tvl_change_24h=random.uniform(-25, -10),  # Moderate decline
            tvl_usd=random.uniform(2_000_000, 20_000_000),
            liquidity_change_24h=random.uniform(-20, 5),
            holder_concentration_top10=random.uniform(40, 60),
            insider_sells_24h=random.randint(2, 5),
            insider_sell_volume_usd=random.uniform(50_000, 200_000),
            
            # Mixed social signals
            twitter_engagement_change_48h=random.uniform(-40, -10),
            twitter_mentions_24h=random.randint(200, 1000),
            twitter_sentiment_score=random.uniform(-0.3, 0.1),
            influencer_silence_hours=random.uniform(12, 48),
            
            # Protocol signals
            github_commits_7d=random.randint(3, 10),
            github_commit_change=random.uniform(-30, 10),
            dev_departures_30d=random.randint(0, 1),
            
            # Governance
            recent_vote_type=random.choice(["fee_increase", "neutral"]),
            vote_passed=random.choice([True, False]),
            
            # Price action
            price_change_24h=random.uniform(-30, -5),
            volume_24h_usd=random.uniform(500_000, 5_000_000),
            
            # Metadata
            market_cap_usd=random.uniform(10_000_000, 100_000_000),
            category=category
        )
    
    def generate_batch(self, size: int = 100, rug_pull_ratio: float = 0.05) -> List[TokenSignal]:
        """
        Generate batch of mixed signals
        
        Args:
            size: Number of signals to generate
            rug_pull_ratio: Percentage of signals that should be rug pulls (0-1)
        
        Returns:
            List of TokenSignal objects
        """
        signals = []
        
        num_rug_pulls = int(size * rug_pull_ratio)
        num_moderate = int(size * 0.15)  # 15% moderate risk
        num_healthy = size - num_rug_pulls - num_moderate
        
        # Generate signals
        for _ in range(num_rug_pulls):
            signals.append(self.generate_rug_pull_signal())
        
        for _ in range(num_moderate):
            signals.append(self.generate_moderate_risk_signal())
        
        for _ in range(num_healthy):
            signals.append(self.generate_healthy_signal())
        
        # Shuffle to mix them up
        random.shuffle(signals)
        
        self.generated_count += len(signals)
        return signals
    
    def signal_to_dict(self, signal: TokenSignal) -> Dict[str, Any]:
        """Convert TokenSignal to dictionary"""
        return asdict(signal)
    
    def batch_to_json(self, signals: List[TokenSignal]) -> str:
        """Convert batch of signals to JSON string"""
        return json.dumps([self.signal_to_dict(s) for s in signals], indent=2)
    
    def get_stats(self) -> Dict[str, int]:
        """Get generation statistics"""
        return {
            "total_generated": self.generated_count,
            "timestamp": datetime.utcnow().isoformat()
        }


# Example usage
if __name__ == "__main__":
    ingestion = DataIngestion()
    
    # Generate a batch of 10 signals for testing
    signals = ingestion.generate_batch(size=10, rug_pull_ratio=0.2)
    
    print(f"Generated {len(signals)} signals")
    print("\nFirst signal:")
    print(json.dumps(ingestion.signal_to_dict(signals[0]), indent=2))
    
    # Show which ones are likely rug pulls
    print("\n" + "="*80)
    print("LIKELY RUG PULLS (for validation):")
    for signal in signals:
        if (signal.tvl_change_24h < -30 and 
            signal.twitter_engagement_change_48h < -50 and
            signal.insider_sells_24h > 3):
            print(f"  🚩 {signal.token_symbol} on {signal.chain} - TVL: {signal.tvl_change_24h:.1f}%, "
                  f"Engagement: {signal.twitter_engagement_change_48h:.1f}%")
