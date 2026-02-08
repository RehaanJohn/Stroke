"""
Live Data Integration - Connect Real APIs to NEXUS
===================================================

Fetches live data from:
1. Twitter/X database (local SQLite)
2. Yahoo Finance API (real-time prices)
3. SEC EDGAR API (real filings)

And feeds it into the Tier 1 + Tier 2 AI system
"""

import asyncio
import aiohttp
import sqlite3
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class LiveMarketSignal:
    """Live market signal from aggregated sources"""
    token_symbol: str
    source: str  # 'twitter', 'yahoo', 'sec'
    sentiment: str  # 'bullish', 'bearish', 'neutral'
    confidence: int  # 0-100
    data: Dict[str, Any]
    timestamp: str


class LiveDataIngestion:
    """Fetch real market data from live APIs"""
    
    def __init__(self):
        self.db_path = Path("x_scrapper/crypto_tweets.db")
        self.yahoo_tickers = ['BTC-USD', 'ETH-USD', 'SOL-USD']
        self.sec_companies = ['TSLA', 'NVDA', 'META']
        
    async def fetch_twitter_signals(self) -> List[LiveMarketSignal]:
        """Fetch real tweets from local database"""
        signals = []
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get recent tweets mentioning crypto
            cursor.execute("""
                SELECT username, text, time, likes, retweets, replies
                FROM tweets
                ORDER BY id DESC
                LIMIT 20
            """)
            
            tweets = cursor.fetchall()
            conn.close()
            
            for tweet in tweets:
                username, text, time_str, likes, retweets, replies = tweet
                
                # Simple sentiment analysis based on keywords
                text_lower = text.lower()
                sentiment = 'neutral'
                confidence = 50
                
                # Bearish indicators
                if any(word in text_lower for word in ['dump', 'crash', 'sell', 'rug', 'scam', 'exit']):
                    sentiment = 'bearish'
                    confidence = 70
                
                # Bullish indicators
                elif any(word in text_lower for word in ['moon', 'pump', 'buy', 'bullish', 'hodl']):
                    sentiment = 'bullish'
                    confidence = 65
                
                signals.append(LiveMarketSignal(
                    token_symbol="CRYPTO",
                    source="twitter",
                    sentiment=sentiment,
                    confidence=confidence,
                    data={
                        'username': username,
                        'text': text,
                        'engagement': likes + retweets + replies
                    },
                    timestamp=datetime.now().isoformat()
                ))
                
            print(f"✅ Fetched {len(signals)} Twitter signals from database")
            return signals
            
        except Exception as e:
            print(f"❌ Twitter fetch error: {e}")
            return []
    
    async def fetch_yahoo_signals(self) -> List[LiveMarketSignal]:
        """Fetch real-time prices from Yahoo Finance"""
        signals = []
        
        try:
            async with aiohttp.ClientSession() as session:
                for ticker in self.yahoo_tickers:
                    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}'
                    params = {'interval': '1d', 'range': '1d'}
                    headers = {'User-Agent': 'Mozilla/5.0'}
                    
                    async with session.get(url, params=params, headers=headers) as response:
                        if response.status == 200:
                            data = await response.json()
                            result = data['chart']['result'][0]
                            meta = result['meta']
                            
                            current_price = meta.get('regularMarketPrice', 0)
                            previous_close = meta.get('chartPreviousClose', 0)
                            change_pct = ((current_price - previous_close) / previous_close * 100) if previous_close else 0
                            
                            sentiment = 'bearish' if change_pct < -2 else 'bullish' if change_pct > 2 else 'neutral'
                            confidence = min(abs(int(change_pct * 10)), 90)
                            
                            signals.append(LiveMarketSignal(
                                token_symbol=ticker,
                                source="yahoo",
                                sentiment=sentiment,
                                confidence=confidence,
                                data={
                                    'price': current_price,
                                    'change_pct': change_pct,
                                    'volume': meta.get('regularMarketVolume', 0)
                                },
                                timestamp=datetime.now().isoformat()
                            ))
                    
                    await asyncio.sleep(0.2)  # Rate limiting
                    
            print(f"✅ Fetched {len(signals)} Yahoo Finance signals")
            return signals
            
        except Exception as e:
            print(f"❌ Yahoo fetch error: {e}")
            return []
    
    async def fetch_sec_signals(self) -> List[LiveMarketSignal]:
        """Fetch real SEC filings"""
        signals = []
        
        try:
            headers = {
                'User-Agent': 'NEXUS Trading Agent contact@nexus.io',
                'Accept': 'application/json'
            }
            
            async with aiohttp.ClientSession() as session:
                # Get company tickers
                async with session.get('https://www.sec.gov/files/company_tickers.json', 
                                     headers=headers) as response:
                    if response.status == 200:
                        tickers_data = await response.json()
                        
                        for company_ticker in self.sec_companies:
                            # Find CIK
                            cik = None
                            for company in tickers_data.values():
                                if company.get('ticker') == company_ticker:
                                    cik = str(company['cik_str']).zfill(10)
                                    break
                            
                            if cik:
                                # Get filings
                                url = f"https://data.sec.gov/submissions/CIK{cik}.json"
                                async with session.get(url, headers=headers) as filing_response:
                                    if filing_response.status == 200:
                                        filing_data = await filing_response.json()
                                        filings = filing_data.get('filings', {}).get('recent', {})
                                        
                                        # Check for insider trading (Form 4)
                                        if filings.get('form'):
                                            for i, form_type in enumerate(filings['form'][:5]):
                                                if form_type in ['4', '8-K']:
                                                    sentiment = 'bearish'
                                                    confidence = 75 if form_type == '4' else 60
                                                    
                                                    signals.append(LiveMarketSignal(
                                                        token_symbol=company_ticker,
                                                        source="sec",
                                                        sentiment=sentiment,
                                                        confidence=confidence,
                                                        data={
                                                            'filing_type': form_type,
                                                            'filing_date': filings['filingDate'][i]
                                                        },
                                                        timestamp=datetime.now().isoformat()
                                                    ))
                                
                                await asyncio.sleep(0.2)  # SEC rate limit
                    
            print(f"✅ Fetched {len(signals)} SEC signals")
            return signals
            
        except Exception as e:
            print(f"❌ SEC fetch error: {e}")
            return []
    
    async def fetch_all_signals(self) -> List[LiveMarketSignal]:
        """Fetch from all sources in parallel"""
        print("\n🔍 Fetching live market data from all sources...")
        print("="*60)
        
        results = await asyncio.gather(
            self.fetch_twitter_signals(),
            self.fetch_yahoo_signals(),
            self.fetch_sec_signals(),
            return_exceptions=True
        )
        
        all_signals = []
        for result in results:
            if isinstance(result, list):
                all_signals.extend(result)
        
        print(f"\n📊 Total signals collected: {len(all_signals)}")
        print("="*60)
        
        return all_signals


async def test_live_data():
    """Test live data fetching"""
    ingestion = LiveDataIngestion()
    signals = await ingestion.fetch_all_signals()
    
    print("\n📋 Sample Signals:")
    for i, signal in enumerate(signals[:5], 1):
        print(f"\n{i}. {signal.source.upper()} - {signal.token_symbol}")
        print(f"   Sentiment: {signal.sentiment} (Confidence: {signal.confidence}%)")
        print(f"   Data: {signal.data}")


if __name__ == "__main__":
    asyncio.run(test_live_data())
