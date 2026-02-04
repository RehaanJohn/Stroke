#!/usr/bin/env python3
"""
API Endpoints Test Script
Tests Yahoo Finance, SEC EDGAR, and GitHub APIs
"""

import sys
import asyncio
import aiohttp
from datetime import datetime

print("="*80)
print("API ENDPOINTS TEST - Yahoo Finance, SEC EDGAR, GitHub")
print("="*80)
print()

async def test_yahoo_finance():
    """Test Yahoo Finance API for earnings data"""
    print("1. Testing Yahoo Finance API...")
    print("-"*80)
    
    ticker = "NVDA"
    
    # Try multiple endpoints
    endpoints = [
        {
            'name': 'Chart API (Price Data)',
            'url': f'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}',
            'params': {'interval': '1d', 'range': '5d'}
        },
        {
            'name': 'Quote API (Basic Info)',
            'url': f'https://query1.finance.yahoo.com/v7/finance/quote',
            'params': {'symbols': ticker}
        },
        {
            'name': 'Options API (Available)',
            'url': f'https://query1.finance.yahoo.com/v7/finance/options/{ticker}',
            'params': {}
        }
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    working_endpoint = None
    
    try:
        async with aiohttp.ClientSession() as session:
            for endpoint in endpoints:
                print(f"\n   Testing: {endpoint['name']}")
                try:
                    async with session.get(endpoint['url'], params=endpoint['params'], headers=headers, timeout=10) as response:
                        print(f"   URL: {response.url}")
                        print(f"   Status: {response.status}")
                        
                        if response.status == 200:
                            data = await response.json()
                            
                            # Chart API
                            if 'chart' in data and data['chart'].get('result'):
                                result = data['chart']['result'][0]
                                meta = result.get('meta', {})
                                print(f"   ✅ SUCCESS - Chart API working")
                                print(f"   Symbol: {meta.get('symbol', 'N/A')}")
                                print(f"   Current Price: ${meta.get('regularMarketPrice', 'N/A')}")
                                print(f"   Currency: {meta.get('currency', 'N/A')}")
                                working_endpoint = endpoint['name']
                                
                            # Quote API
                            elif 'quoteResponse' in data and data['quoteResponse'].get('result'):
                                result = data['quoteResponse']['result'][0]
                                print(f"   ✅ SUCCESS - Quote API working")
                                print(f"   Symbol: {result.get('symbol', 'N/A')}")
                                print(f"   Price: ${result.get('regularMarketPrice', 'N/A')}")
                                print(f"   Market Cap: ${result.get('marketCap', 0):,.0f}")
                                working_endpoint = endpoint['name']
                                
                            # Options API
                            elif 'optionChain' in data:
                                print(f"   ✅ SUCCESS - Options API working")
                                print(f"   Options data available")
                                working_endpoint = endpoint['name']
                            
                            if working_endpoint:
                                break
                        else:
                            text = await response.text()
                            print(f"   ❌ HTTP {response.status}: {text[:100]}")
                            
                except Exception as e:
                    print(f"   ❌ {type(e).__name__}: {e}")
                    continue
            
            if working_endpoint:
                print(f"\n   ✅ SUCCESS - Yahoo Finance accessible via {working_endpoint}")
                print(f"   Note: Earnings data requires paid API or web scraping")
                print(f"   Alternative: Use yfinance library or Alpha Vantage API")
                return True
            else:
                print(f"\n   ⚠️  All endpoints failed")
                print(f"   Yahoo Finance may require cookies/crumb authentication")
                print(f"   Recommendation: Use yfinance Python library instead")
                return False
                    
    except Exception as e:
        print(f"   ❌ FAILED - {type(e).__name__}: {e}")
        return False


async def test_sec_edgar():
    """Test SEC EDGAR API for company data"""
    print("\n2. Testing SEC EDGAR API...")
    print("-"*80)
    
    # First test: Get company tickers mapping
    print("   Test 2a: Company Tickers Endpoint")
    url = "https://www.sec.gov/files/company_tickers.json"
    headers = {
        'User-Agent': 'NEXUS Test Agent contact@nexus.io',
        'Accept': 'application/json'
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=15) as response:
                print(f"   URL: {url}")
                print(f"   Status: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    
                    # Find NVDA
                    nvda_data = None
                    for company in data.values():
                        if company.get('ticker') == 'NVDA':
                            nvda_data = company
                            break
                    
                    if nvda_data:
                        cik = str(nvda_data['cik_str'])
                        print(f"   ✅ SUCCESS - Found NVDA")
                        print(f"   Company: {nvda_data.get('title')}")
                        print(f"   CIK: {cik}")
                        
                        # Test 2b: Get company submissions
                        print("\n   Test 2b: Company Submissions Endpoint")
                        cik_padded = cik.zfill(10)
                        submissions_url = f"https://data.sec.gov/submissions/CIK{cik_padded}.json"
                        
                        async with session.get(submissions_url, headers=headers, timeout=15) as sub_response:
                            print(f"   URL: {submissions_url}")
                            print(f"   Status: {sub_response.status}")
                            
                            if sub_response.status == 200:
                                sub_data = await sub_response.json()
                                
                                if 'filings' in sub_data and 'recent' in sub_data['filings']:
                                    filings = sub_data['filings']['recent']
                                    
                                    # Count Form 4 filings (insider trading)
                                    form4_count = sum(1 for f in filings.get('form', []) if f == '4')
                                    
                                    print(f"   ✅ SUCCESS - Retrieved filing data")
                                    print(f"   Total Recent Filings: {len(filings.get('form', []))}")
                                    print(f"   Form 4 (Insider) Filings: {form4_count}")
                                    
                                    if filings.get('form'):
                                        latest_form = filings['form'][0]
                                        latest_date = filings['filingDate'][0]
                                        print(f"   Latest Filing: {latest_form} on {latest_date}")
                                    
                                    return True
                                else:
                                    print(f"   ⚠️  No filings data found")
                                    return False
                            else:
                                print(f"   ❌ FAILED - HTTP {sub_response.status}")
                                return False
                    else:
                        print(f"   ⚠️  NVDA not found in ticker list")
                        return False
                else:
                    print(f"   ❌ FAILED - HTTP {response.status}")
                    text = await response.text()
                    print(f"   Response: {text[:200]}")
                    return False
                    
    except asyncio.TimeoutError:
        print(f"   ❌ FAILED - Request timeout")
        return False
    except Exception as e:
        print(f"   ❌ FAILED - {type(e).__name__}: {e}")
        return False


async def test_github():
    """Test GitHub API for repository data"""
    print("\n3. Testing GitHub API...")
    print("-"*80)
    
    # Test with a popular crypto project
    owner = "ethereum"
    repo = "go-ethereum"
    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    
    headers = {
        'User-Agent': 'NEXUS-Agent',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    params = {
        'per_page': 10
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, params=params, timeout=10) as response:
                print(f"   URL: {response.url}")
                print(f"   Status: {response.status}")
                
                # Check rate limit headers
                rate_limit = response.headers.get('X-RateLimit-Limit', 'Unknown')
                rate_remaining = response.headers.get('X-RateLimit-Remaining', 'Unknown')
                
                print(f"   Rate Limit: {rate_remaining}/{rate_limit}")
                
                if response.status == 200:
                    data = await response.json()
                    
                    if isinstance(data, list) and len(data) > 0:
                        print(f"   ✅ SUCCESS - Retrieved {len(data)} commits")
                        
                        latest_commit = data[0]
                        commit_date = latest_commit['commit']['author']['date']
                        commit_msg = latest_commit['commit']['message'].split('\n')[0]
                        author = latest_commit['commit']['author']['name']
                        
                        print(f"   Repository: {owner}/{repo}")
                        print(f"   Latest Commit: {commit_date}")
                        print(f"   Author: {author}")
                        print(f"   Message: {commit_msg[:60]}...")
                        
                        return True
                    else:
                        print(f"   ⚠️  No commits data")
                        return False
                        
                elif response.status == 403:
                    print(f"   ⚠️  Rate limit exceeded - needs authentication for higher limits")
                    print(f"   Unauthenticated: 60 requests/hour")
                    print(f"   Authenticated: 5,000 requests/hour")
                    return False
                    
                else:
                    print(f"   ❌ FAILED - HTTP {response.status}")
                    text = await response.text()
                    print(f"   Response: {text[:200]}")
                    return False
                    
    except asyncio.TimeoutError:
        print(f"   ❌ FAILED - Request timeout")
        return False
    except Exception as e:
        print(f"   ❌ FAILED - {type(e).__name__}: {e}")
        return False


async def main():
    """Run all API tests"""
    
    results = {}
    
    # Run tests
    results['yahoo_finance'] = await test_yahoo_finance()
    results['sec_edgar'] = await test_sec_edgar()
    results['github'] = await test_github()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print()
    
    all_passed = True
    for api, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"  {api.replace('_', ' ').title():20} {status}")
        if not passed:
            all_passed = False
    
    print()
    print("="*80)
    
    if all_passed:
        print("✅ ALL APIS WORKING - TradFi Monitor Ready")
        print()
        print("Next Steps:")
        print("  1. The TradFi monitor can fetch real data")
        print("  2. Run: cd agent/monitors && npx tsc TradFiMonitor.ts")
        print("  3. Test with: node example.js")
    else:
        print("⚠️  SOME APIS FAILED")
        print()
        print("Notes:")
        print("  - Yahoo Finance might require different endpoints")
        print("  - SEC EDGAR requires proper User-Agent with contact")
        print("  - GitHub has rate limits (60/hour unauthenticated)")
        print()
        print("The TradFi monitor has fallback handling for failed requests")
    
    print("="*80)
    
    return all_passed


if __name__ == "__main__":
    try:
        result = asyncio.run(main())
        sys.exit(0 if result else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
