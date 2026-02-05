"""
Social Signal Monitor
Ingests Twitter/X data from x_scrapper and generates crypto trading signals
"""

import sqlite3
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from pathlib import Path
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SocialSignal:
    """Represents a social signal from Twitter/X"""
    
    def __init__(self, tweet_data: Dict[str, Any]):
        self.id = tweet_data['id']
        self.username = tweet_data['username']
        self.text = tweet_data['text']
        self.time = tweet_data['time']
        self.likes = self._parse_engagement(tweet_data['likes'])
        self.retweets = self._parse_engagement(tweet_data['retweets'])
        self.replies = self._parse_engagement(tweet_data['replies'])
        self.scraped_at = tweet_data['scraped_at']
        self.is_crypto = tweet_data['is_crypto']
        
        # Derived metrics
        self.total_engagement = self.likes + self.retweets + self.replies
        self.virality_score = self._calculate_virality()
        self.crypto_tokens = self._extract_crypto_tokens()
        self.sentiment_keywords = self._extract_sentiment_keywords()
        self.signal_type = self._determine_signal_type()
        self.urgency = self._calculate_urgency()
    
    def _parse_engagement(self, value: str) -> int:
        """Parse engagement metrics (handles K, M suffixes)"""
        if not value or value == "0":
            return 0
        
        value = value.strip().upper()
        
        # Handle K (thousands)
        if 'K' in value:
            return int(float(value.replace('K', '')) * 1000)
        
        # Handle M (millions)
        if 'M' in value:
            return int(float(value.replace('M', '')) * 1_000_000)
        
        # Plain number
        try:
            return int(value.replace(',', ''))
        except:
            return 0
    
    def _calculate_virality(self) -> float:
        """Calculate virality score (0-100)"""
        # Weight different engagement types
        score = (
            self.likes * 1.0 +
            self.retweets * 3.0 +  # Retweets are more valuable
            self.replies * 2.0
        )
        
        # Normalize to 0-100 scale (logarithmic)
        import math
        if score > 0:
            return min(100, math.log10(score + 1) * 20)
        return 0
    
    def _extract_crypto_tokens(self) -> List[str]:
        """Extract cryptocurrency token symbols from text"""
        text_upper = self.text.upper()
        
        # Common crypto tokens
        major_tokens = [
            'BTC', 'BITCOIN', 'ETH', 'ETHEREUM', 'SOL', 'SOLANA',
            'BNB', 'BINANCE', 'XRP', 'RIPPLE', 'ADA', 'CARDANO',
            'DOGE', 'DOGECOIN', 'MATIC', 'POLYGON', 'DOT', 'POLKADOT',
            'AVAX', 'AVALANCHE', 'LINK', 'CHAINLINK', 'UNI', 'UNISWAP',
            'ATOM', 'COSMOS', 'LTC', 'LITECOIN', 'NEAR', 'FTM', 'FANTOM',
            'ALGO', 'ALGORAND', 'VET', 'VECHAIN', 'ICP', 'FIL', 'FILECOIN',
            'AAVE', 'MKR', 'MAKER', 'CRV', 'CURVE', 'COMP', 'COMPOUND',
            'SUSHI', 'SUSHISWAP', 'CAKE', 'PANCAKE', 'GMX', 'RNDR', 'RENDER',
            'FET', 'FETCH', 'TAO', 'BITTENSOR', 'OCEAN', 'INJ', 'INJECTIVE',
            'SEI', 'SUI', 'APT', 'APTOS', 'ARB', 'ARBITRUM', 'OP', 'OPTIMISM',
            'MASK', 'PEPE', 'SHIB', 'SHIBA', 'FLOKI', 'BONK'
        ]
        
        found = []
        for token in major_tokens:
            if token in text_upper or f'${token}' in text_upper or f'#{token}' in text_upper:
                # Normalize to standard symbol
                if token in ['BITCOIN']: token = 'BTC'
                elif token in ['ETHEREUM']: token = 'ETH'
                elif token in ['SOLANA']: token = 'SOL'
                elif token in ['BINANCE']: token = 'BNB'
                elif token in ['RIPPLE']: token = 'XRP'
                elif token in ['CARDANO']: token = 'ADA'
                elif token in ['DOGECOIN']: token = 'DOGE'
                elif token in ['POLYGON']: token = 'MATIC'
                elif token in ['POLKADOT']: token = 'DOT'
                elif token in ['AVALANCHE']: token = 'AVAX'
                elif token in ['CHAINLINK']: token = 'LINK'
                elif token in ['UNISWAP']: token = 'UNI'
                elif token in ['COSMOS']: token = 'ATOM'
                elif token in ['LITECOIN']: token = 'LTC'
                elif token in ['FANTOM']: token = 'FTM'
                elif token in ['ALGORAND']: token = 'ALGO'
                elif token in ['VECHAIN']: token = 'VET'
                elif token in ['FILECOIN']: token = 'FIL'
                elif token in ['MAKER']: token = 'MKR'
                elif token in ['CURVE']: token = 'CRV'
                elif token in ['COMPOUND']: token = 'COMP'
                elif token in ['SUSHISWAP']: token = 'SUSHI'
                elif token in ['PANCAKE']: token = 'CAKE'
                elif token in ['RENDER']: token = 'RNDR'
                elif token in ['FETCH']: token = 'FET'
                elif token in ['BITTENSOR']: token = 'TAO'
                elif token in ['INJECTIVE']: token = 'INJ'
                elif token in ['APTOS']: token = 'APT'
                elif token in ['ARBITRUM']: token = 'ARB'
                elif token in ['OPTIMISM']: token = 'OP'
                elif token in ['SHIBA']: token = 'SHIB'
                
                if token not in found:
                    found.append(token)
        
        return found
    
    def _extract_sentiment_keywords(self) -> Dict[str, List[str]]:
        """Extract bullish/bearish sentiment keywords"""
        text_lower = self.text.lower()
        
        bullish = ['pump', 'moon', 'bullish', 'buy', 'rally', 'breakout', 'surge', 
                   'all-time high', 'ath', 'institutional', 'adoption', 'mainstream',
                   'partnership', 'integration', 'launch', 'upgrade']
        
        bearish = ['dump', 'crash', 'bearish', 'sell', 'collapse', 'plunge', 'ban',
                   'regulation', 'lawsuit', 'investigation', 'hack', 'exploit', 'rug',
                   'scam', 'ponzi', 'fraud', 'insolvency', 'liquidation', 'delisting']
        
        found_bullish = [k for k in bullish if k in text_lower]
        found_bearish = [k for k in bearish if k in text_lower]
        
        return {
            'bullish': found_bullish,
            'bearish': found_bearish
        }
    
    def _determine_signal_type(self) -> str:
        """Determine the type of signal"""
        text_lower = self.text.lower()
        
        # Regulatory signals
        if any(k in text_lower for k in ['sec', 'regulation', 'ban', 'lawsuit', 'investigation']):
            return 'REGULATORY_RISK'
        
        # Institutional signals
        if any(k in text_lower for k in ['blackrock', 'fidelity', 'institutional', 'etf']):
            return 'INSTITUTIONAL_MOVE'
        
        # Technical/price action
        if any(k in text_lower for k in ['breakout', 'support', 'resistance', 'chart', 'technical']):
            return 'TECHNICAL_SIGNAL'
        
        # Macro/political
        if any(k in text_lower for k in ['fed', 'interest rate', 'inflation', 'recession', 'war']):
            return 'MACRO_EVENT'
        
        # Sentiment/narrative
        if self.sentiment_keywords['bullish'] or self.sentiment_keywords['bearish']:
            return 'SENTIMENT_SHIFT'
        
        return 'GENERAL_DISCUSSION'
    
    def _calculate_urgency(self) -> int:
        """Calculate signal urgency (1-10)"""
        urgency = 5  # Base urgency
        
        # High engagement = more urgent
        if self.total_engagement > 100000:
            urgency += 3
        elif self.total_engagement > 50000:
            urgency += 2
        elif self.total_engagement > 10000:
            urgency += 1
        
        # Tier-0 accounts = more urgent
        tier0_accounts = ['elonmusk', 'vitalikbuterin', 'saylor', 'cz_binance', 
                         'secgov', 'garygensler', 'potus', 'federalreserve']
        if self.username.lower() in tier0_accounts:
            urgency += 2
        
        # Negative sentiment = more urgent (short opportunities)
        if len(self.sentiment_keywords['bearish']) > len(self.sentiment_keywords['bullish']):
            urgency += 1
        
        # Regulatory/risk signals = urgent
        if self.signal_type in ['REGULATORY_RISK', 'MACRO_EVENT']:
            urgency += 2
        
        return min(10, urgency)
    
    def to_agent_signal(self) -> str:
        """Convert to text signal for agent processing"""
        # Format: [@username] [SIGNAL_TYPE] Tweet text [Engagement: X] [Tokens: Y, Z]
        tokens_str = ', '.join(self.crypto_tokens) if self.crypto_tokens else 'N/A'
        
        signal = (
            f"[@{self.username}] [{self.signal_type}] "
            f"{self.text[:200]}... "
            f"[Engagement: ❤️{self.likes:,} 🔄{self.retweets:,}] "
            f"[Tokens: {tokens_str}] "
            f"[Virality: {self.virality_score:.0f}/100]"
        )
        
        return signal


class SocialMonitor:
    """Monitor Twitter/X social signals from x_scrapper database"""
    
    def __init__(self, db_path: str = None):
        """
        Initialize social monitor
        
        Args:
            db_path: Path to crypto_tweets.db (defaults to x_scrapper/crypto_tweets.db)
        """
        if db_path is None:
            # Default to x_scrapper directory
            project_root = Path(__file__).parent.parent
            db_path = project_root / 'x_scrapper' / 'crypto_tweets.db'
        
        self.db_path = str(db_path)
        logger.info(f"Social monitor initialized with database: {self.db_path}")
    
    def get_recent_tweets(
        self, 
        hours: int = 1, 
        min_engagement: int = 1000,
        crypto_only: bool = True
    ) -> List[SocialSignal]:
        """
        Get recent high-engagement tweets
        
        Args:
            hours: Look back this many hours
            min_engagement: Minimum total engagement (likes + retweets + replies)
            crypto_only: Only return crypto-related tweets
        
        Returns:
            List of SocialSignal objects
        """
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable column access by name
            cursor = conn.cursor()
            
            # Calculate cutoff time
            cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
            
            # Build query
            query = """
                SELECT * FROM tweets
                WHERE scraped_at >= ?
            """
            params = [cutoff]
            
            if crypto_only:
                query += " AND is_crypto = 1"
            
            query += " ORDER BY scraped_at DESC"
            
            cursor.execute(query, params)
            rows = cursor.fetchall()
            
            # Convert to SocialSignal objects
            signals = []
            for row in rows:
                tweet_data = dict(row)
                signal = SocialSignal(tweet_data)
                
                # Filter by engagement
                if signal.total_engagement >= min_engagement:
                    signals.append(signal)
            
            conn.close()
            
            logger.info(f"Retrieved {len(signals)} social signals from last {hours}h")
            return signals
            
        except sqlite3.Error as e:
            logger.error(f"Database error: {e}")
            return []
        except Exception as e:
            logger.error(f"Error retrieving tweets: {e}")
            return []
    
    def get_top_signals(
        self,
        limit: int = 50,
        min_urgency: int = 7
    ) -> List[Dict[str, Any]]:
        """
        Get top signals formatted for agent processing
        
        Args:
            limit: Maximum number of signals
            min_urgency: Minimum urgency score (1-10)
        
        Returns:
            List of signal dictionaries for agent
        """
        tweets = self.get_recent_tweets(hours=2, min_engagement=5000)
        
        # Filter by urgency
        urgent_tweets = [t for t in tweets if t.urgency >= min_urgency]
        
        # Sort by urgency * virality
        urgent_tweets.sort(key=lambda t: t.urgency * t.virality_score, reverse=True)
        
        # Convert to agent format
        signals = []
        for tweet in urgent_tweets[:limit]:
            signals.append({
                'text': tweet.to_agent_signal(),
                'urgency': tweet.urgency,
                'type': tweet.signal_type,
                'source': 'twitter',
                'username': tweet.username,
                'engagement': tweet.total_engagement,
                'tokens': tweet.crypto_tokens,
                'timestamp': tweet.scraped_at
            })
        
        logger.info(f"Generated {len(signals)} urgent signals for agent processing")
        return signals
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Total tweets
            cursor.execute("SELECT COUNT(*) FROM tweets")
            total = cursor.fetchone()[0]
            
            # Crypto tweets
            cursor.execute("SELECT COUNT(*) FROM tweets WHERE is_crypto = 1")
            crypto = cursor.fetchone()[0]
            
            # Recent tweets (last hour)
            cutoff = (datetime.now() - timedelta(hours=1)).isoformat()
            cursor.execute("SELECT COUNT(*) FROM tweets WHERE scraped_at >= ?", [cutoff])
            recent = cursor.fetchone()[0]
            
            # Unique accounts
            cursor.execute("SELECT COUNT(DISTINCT username) FROM tweets")
            accounts = cursor.fetchone()[0]
            
            # Latest scrape time
            cursor.execute("SELECT MAX(scraped_at) FROM tweets")
            latest = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                'total_tweets': total,
                'crypto_tweets': crypto,
                'tweets_last_hour': recent,
                'unique_accounts': accounts,
                'latest_scrape': latest,
                'database_path': self.db_path
            }
            
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {}


if __name__ == "__main__":
    # Test the social monitor
    monitor = SocialMonitor()
    
    print("\n" + "="*80)
    print("SOCIAL MONITOR TEST")
    print("="*80 + "\n")
    
    # Get stats
    stats = monitor.get_stats()
    print("📊 Database Stats:")
    for key, value in stats.items():
        print(f"   {key}: {value}")
    
    # Get top signals
    print("\n" + "="*80)
    print("TOP URGENT SIGNALS")
    print("="*80 + "\n")
    
    signals = monitor.get_top_signals(limit=10, min_urgency=7)
    
    for i, signal in enumerate(signals, 1):
        print(f"{i}. [{signal['type']}] Urgency: {signal['urgency']}/10")
        print(f"   {signal['text'][:150]}...")
        print(f"   Tokens: {', '.join(signal['tokens']) if signal['tokens'] else 'N/A'}")
        print(f"   Engagement: {signal['engagement']:,}")
        print()
