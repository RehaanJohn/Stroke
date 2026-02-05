#!/usr/bin/env python3
"""
Create sample crypto_tweets.db for testing without running Selenium scraper
"""

import sqlite3
from datetime import datetime, timedelta
import random

# Sample tweets from different accounts
SAMPLE_TWEETS = [
    {
        'username': 'elonmusk',
        'text': 'Bitcoin regulation announcement expected next week. Major implications for crypto markets.',
        'likes': '45000',
        'retweets': '12000',
        'replies': '3400',
        'is_crypto': True
    },
    {
        'username': 'VitalikButerin',
        'text': 'Ethereum layer 2 scaling solutions seeing massive adoption. Transaction costs down 95%.',
        'likes': '28000',
        'retweets': '8500',
        'replies': '2100',
        'is_crypto': True
    },
    {
        'username': 'saylor',
        'text': 'MicroStrategy continues accumulating Bitcoin. We see this as a long-term treasury reserve asset.',
        'likes': '15000',
        'retweets': '5200',
        'replies': '1800',
        'is_crypto': True
    },
    {
        'username': 'SECgov',
        'text': 'The SEC is reviewing applications for spot crypto ETFs. Decision timeline updated.',
        'likes': '18000',
        'retweets': '9500',
        'replies': '4200',
        'is_crypto': True
    },
    {
        'username': 'GaryGensler',
        'text': 'Crypto regulation framework must protect investors while fostering innovation.',
        'likes': '12000',
        'retweets': '6800',
        'replies': '5600',
        'is_crypto': True
    },
    {
        'username': 'cz_binance',
        'text': 'Binance expanding institutional services. New custody solutions launching Q1.',
        'likes': '22000',
        'retweets': '7400',
        'replies': '1900',
        'is_crypto': True
    },
    {
        'username': 'brian_armstrong',
        'text': 'Coinbase earnings tomorrow. Expecting strong Q4 results driven by trading volume.',
        'likes': '14500',
        'retweets': '4200',
        'replies': '1100',
        'is_crypto': True
    },
    {
        'username': 'whale_alert',
        'text': '🚨 100,000,000 USDT (100,000,000 USD) transferred from Binance to unknown wallet',
        'likes': '8900',
        'retweets': '3200',
        'replies': '890',
        'is_crypto': True
    },
    {
        'username': 'lookonchain',
        'text': 'A whale just deposited 50,000 ETH ($125M) to Coinbase. Possible sell signal?',
        'likes': '11000',
        'retweets': '4500',
        'replies': '1200',
        'is_crypto': True
    },
    {
        'username': 'Reuters',
        'text': 'BREAKING: Fed signals potential pause in rate hikes. Impact on risk assets including crypto.',
        'likes': '32000',
        'retweets': '15000',
        'replies': '4500',
        'is_crypto': True
    },
    {
        'username': 'business',
        'text': 'BlackRock Bitcoin ETF sees $2.1B in inflows this week. Institutional demand surging.',
        'likes': '19000',
        'retweets': '8200',
        'replies': '2100',
        'is_crypto': True
    },
    {
        'username': 'CoinDesk',
        'text': 'Solana network congestion eases after latest upgrade. Transaction success rate back to 95%.',
        'likes': '6700',
        'retweets': '2100',
        'replies': '580',
        'is_crypto': True
    },
    {
        'username': 'balajis',
        'text': 'On-chain metrics showing accumulation pattern. Smart money positioning for macro uncertainty.',
        'likes': '9800',
        'retweets': '3400',
        'replies': '920',
        'is_crypto': True
    },
    {
        'username': 'RaoulGMI',
        'text': 'Crypto correlation to equities breaking down. Flight to quality narrative shifting.',
        'likes': '7200',
        'retweets': '2800',
        'replies': '650',
        'is_crypto': True
    },
    {
        'username': 'APompliano',
        'text': 'Bitcoin price action consolidating. Expecting major move in next 2-3 weeks.',
        'likes': '13000',
        'retweets': '4600',
        'replies': '1400',
        'is_crypto': True
    },
    {
        'username': 'glassnode',
        'text': 'Bitcoin long-term holder supply at all-time high. 70% of supply unmoved for 6+ months.',
        'likes': '8500',
        'retweets': '3100',
        'replies': '720',
        'is_crypto': True
    },
    {
        'username': 'TheBlock__',
        'text': 'DeFi TVL surpasses $150B. Aave, Uniswap leading with institutional interest growing.',
        'likes': '5900',
        'retweets': '2200',
        'replies': '490',
        'is_crypto': True
    },
    {
        'username': 'cryptoquant_com',
        'text': 'Exchange reserves declining sharply. 120K BTC withdrawn in past 7 days.',
        'likes': '10200',
        'retweets': '3800',
        'replies': '890',
        'is_crypto': True
    },
    {
        'username': 'ZelenskyyUa',
        'text': 'Ukraine continues accepting crypto donations for humanitarian aid. Transparency through blockchain.',
        'likes': '45000',
        'retweets': '12000',
        'replies': '5600',
        'is_crypto': True
    },
    {
        'username': 'federalreserve',
        'text': 'FOMC minutes released. Discussion of digital dollar CBDC pilot program.',
        'likes': '25000',
        'retweets': '11000',
        'replies': '6700',
        'is_crypto': True
    }
]

def create_sample_database():
    """Create sample database with realistic tweets"""
    
    print("\n" + "="*60)
    print("CREATING SAMPLE crypto_tweets.db")
    print("="*60 + "\n")
    
    # Create database
    conn = sqlite3.connect('x_scrapper/crypto_tweets.db')
    cursor = conn.cursor()
    
    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tweets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            text TEXT,
            time TEXT,
            likes TEXT,
            retweets TEXT,
            replies TEXT,
            is_crypto BOOLEAN,
            scraped_at TEXT
        )
    ''')
    
    # Insert sample tweets with timestamps
    base_time = datetime.now()
    
    for i, tweet in enumerate(SAMPLE_TWEETS):
        # Stagger timestamps over last 2 hours
        tweet_time = (base_time - timedelta(minutes=random.randint(0, 120))).isoformat()
        time_str = tweet_time.split('T')[1][:8]  # HH:MM:SS format
        
        cursor.execute('''
            INSERT INTO tweets (username, text, time, likes, retweets, replies, is_crypto, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            tweet['username'],
            tweet['text'],
            time_str,
            tweet['likes'],
            tweet['retweets'],
            tweet['replies'],
            tweet['is_crypto'],
            tweet_time
        ))
    
    conn.commit()
    
    # Get stats
    cursor.execute("SELECT COUNT(*) FROM tweets")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM tweets WHERE is_crypto = 1")
    crypto = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"✅ Created database: x_scrapper/crypto_tweets.db")
    print(f"   Total tweets: {total}")
    print(f"   Crypto tweets: {crypto}")
    print(f"   Unique accounts: {len(set(t['username'] for t in SAMPLE_TWEETS))}")
    print()
    
    return True

if __name__ == "__main__":
    try:
        create_sample_database()
        print("="*60)
        print("✅ READY TO TEST INTEGRATION")
        print("="*60)
        print("\nNext steps:")
        print("  python test_scraper_agent_integration.py")
        print("  python test_full_orchestration.py")
        print()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
