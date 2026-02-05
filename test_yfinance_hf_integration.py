"""
Full Integration Test: yfinance + HuggingFace Model
Shows live earnings data from Yahoo Finance and HuggingFace model analysis
"""
import yfinance as yf
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Check if we're using mock or production
USE_MOCK = os.getenv('AGENT_TIER1_MOCK', 'true').lower() == 'true'

def init_llm():
    """Initialize the LLM model if not in mock mode"""
    if USE_MOCK:
        return None
    
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        import torch
        import torch_directml
        
        model_name = "meta-llama/Llama-3.2-3B"
        hf_token = os.getenv('HUGGING_FACE_TOKEN')
        
        # Use DirectML GPU device
        dml = torch_directml.device()
        print(f"🎮 GPU Device: {dml}")
        
        print(f"🤖 Loading {model_name}...")
        
        # Load tokenizer and set pad token
        tokenizer = AutoTokenizer.from_pretrained(model_name, token=hf_token)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
            tokenizer.pad_token_id = tokenizer.eos_token_id
        
        # Load model on GPU
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            token=hf_token,
            torch_dtype=torch.float16,
            low_cpu_mem_usage=True
        )
        model = model.to(dml)
        print("✅ Model loaded on GPU successfully\n")
        
        return {'model': model, 'tokenizer': tokenizer, 'device': dml}
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        print("Falling back to mock mode...")
        return None

def analyze_signal_with_llm(llm_components, signal_text, signal_num, total_signals):
    """Analyze a signal using the LLM"""
    if USE_MOCK or not llm_components:
        # Mock response
        import random
        is_urgent = random.random() > 0.7
        return {
            'is_urgent': is_urgent,
            'urgency': random.randint(3, 10) if is_urgent else random.randint(1, 5),
            'reasoning': f"[MOCK] {'High priority signal requiring analysis' if is_urgent else 'Normal market condition'}"
        }
    
    import torch
    
    model = llm_components['model']
    tokenizer = llm_components['tokenizer']
    device = llm_components['device']
    
    print(f"   Analyzing signal {signal_num}/{total_signals}...", end='\r')
    
    prompt = f"""Analyze this crypto trading signal. Is it URGENT (needs immediate action) or NORMAL?

Signal: {signal_text}

Answer with: URGENT or NORMAL, then urgency score 1-10, then brief reason.
Response:"""
    
    inputs = tokenizer(prompt, return_tensors="pt", padding=True, truncation=True, max_length=512)
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    # Generate with optimized settings
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=50,  # Reduced for faster inference
            temperature=0.7,
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id,
            eos_token_id=tokenizer.eos_token_id
        )
    
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response_text = response.split('Response:')[-1].strip()
    
    # Parse response
    is_urgent = 'URGENT' in response_text.upper()
    try:
        import re
        numbers = re.findall(r'\b([1-9]|10)\b', response_text)
        urgency = int(numbers[0]) if numbers else (7 if is_urgent else 3)
    except:
        urgency = 7 if is_urgent else 3
    
    return {
        'is_urgent': is_urgent,
        'urgency': urgency,
        'reasoning': response_text[:200]
    }

def fetch_earnings_with_yfinance(ticker: str):
    """Fetch earnings data using yfinance library"""
    print(f"\n{'='*80}")
    print(f"FETCHING LIVE EARNINGS DATA FOR {ticker}")
    print(f"{'='*80}\n")
    
    try:
        stock = yf.Ticker(ticker)
        
        # Get current price
        info = stock.info
        current_price = info.get('currentPrice') or info.get('regularMarketPrice', 'N/A')
        print(f"📊 Current Price: ${current_price}")
        
        # Get earnings data
        earnings = stock.earnings
        if earnings is not None and not earnings.empty:
            print(f"\n📈 Historical Earnings:")
            print(earnings.tail())
        
        # Get quarterly earnings
        quarterly_earnings = stock.quarterly_earnings
        if quarterly_earnings is not None and not quarterly_earnings.empty:
            print(f"\n📊 Quarterly Earnings:")
            print(quarterly_earnings.head())
            
            # Analyze latest quarter
            latest = quarterly_earnings.iloc[0]
            print(f"\n🎯 Latest Quarter Analysis:")
            print(f"   Revenue: {latest.get('Revenue', 'N/A')}")
            print(f"   Earnings: {latest.get('Earnings', 'N/A')}")
        
        # Get calendar earnings (upcoming/recent)
        calendar = stock.calendar
        if calendar is not None:
            print(f"\n📅 Earnings Calendar:")
            print(calendar)
        
        # Get financial data
        financials = stock.financials
        if financials is not None and not financials.empty:
            print(f"\n💰 Recent Financials:")
            print(financials.head())
        
        # Get analyst recommendations
        recommendations = stock.recommendations
        if recommendations is not None and not recommendations.empty:
            print(f"\n🔍 Recent Analyst Recommendations:")
            print(recommendations.tail())
        
        # Get key stats
        print(f"\n📋 Key Statistics:")
        print(f"   Market Cap: ${info.get('marketCap', 'N/A'):,}" if isinstance(info.get('marketCap'), (int, float)) else f"   Market Cap: {info.get('marketCap', 'N/A')}")
        print(f"   P/E Ratio: {info.get('trailingPE', 'N/A')}")
        print(f"   Forward P/E: {info.get('forwardPE', 'N/A')}")
        print(f"   EPS: {info.get('trailingEps', 'N/A')}")
        print(f"   52 Week High: ${info.get('fiftyTwoWeekHigh', 'N/A')}")
        print(f"   52 Week Low: ${info.get('fiftyTwoWeekLow', 'N/A')}")
        
        return {
            'ticker': ticker,
            'current_price': current_price,
            'earnings': earnings,
            'quarterly_earnings': quarterly_earnings,
            'info': info
        }
        
    except Exception as e:
        print(f"❌ Error fetching data for {ticker}: {e}")
        return None

def generate_signals_from_earnings(data):
    """Generate crypto signals based on earnings data"""
    if not data:
        return []
    
    ticker = data['ticker']
    info = data['info']
    
    # Stock to crypto mappings (from TradFiMonitor.ts)
    mappings = {
        'NVDA': ['RENDER', 'FET', 'TAO', 'OCEAN'],
        'COIN': ['BTC', 'ETH'],
        'MSTR': ['BTC'],
        'TSLA': ['DOGE'],
        'META': ['MASK']
    }
    
    signals = []
    crypto_symbols = mappings.get(ticker, [])
    
    current_price = data['current_price']
    fifty_two_high = info.get('fiftyTwoWeekHigh')
    fifty_two_low = info.get('fiftyTwoWeekLow')
    
    # Generate signals based on price action
    if isinstance(current_price, (int, float)) and isinstance(fifty_two_high, (int, float)):
        price_from_high = ((fifty_two_high - current_price) / fifty_two_high) * 100
        
        if price_from_high > 20:  # More than 20% below 52-week high
            for crypto in crypto_symbols:
                signals.append({
                    'text': f"{ticker} trading {price_from_high:.1f}% below 52-week high (${current_price} vs ${fifty_two_high}). Correlated {crypto} may face pressure.",
                    'urgency': 7,
                    'type': 'PRICE_DROP',
                    'crypto': crypto,
                    'stock': ticker
                })
    
    # Check quarterly earnings if available
    if 'quarterly_earnings' in data and data['quarterly_earnings'] is not None:
        qe = data['quarterly_earnings']
        if not qe.empty:
            latest = qe.iloc[0]
            revenue = latest.get('Revenue')
            earnings = latest.get('Earnings')
            
            if revenue is not None and earnings is not None:
                for crypto in crypto_symbols:
                    signals.append({
                        'text': f"{ticker} latest quarterly results: Revenue ${revenue/1e9:.2f}B, Earnings ${earnings/1e9:.2f}B. Impact on {crypto} correlation.",
                        'urgency': 6,
                        'type': 'EARNINGS_DATA',
                        'crypto': crypto,
                        'stock': ticker
                    })
    
    return signals

def main():
    print(f"\n{'#'*80}")
    print("YFINANCE + HUGGINGFACE INTEGRATION TEST")
    print(f"Testing live Yahoo Finance data with Tier 1 LLM screening")
    print(f"Mode: {'MOCK' if USE_MOCK else 'PRODUCTION'}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'#'*80}\n")
    
    # Initialize LLM
    llm_components = init_llm()
    
    # Test stocks
    stocks = ['NVDA', 'COIN', 'MSTR']
    
    all_signals = []
    
    # Fetch earnings data for each stock
    for ticker in stocks:
        data = fetch_earnings_with_yfinance(ticker)
        if data:
            signals = generate_signals_from_earnings(data)
            all_signals.extend(signals)
    
    # Now analyze with HuggingFace model
    if all_signals:
        print(f"\n{'='*80}")
        print(f"ANALYZING WITH HUGGINGFACE TIER 1 MODEL")
        print(f"{'='*80}\n")
        
        print(f"📊 Generated {len(all_signals)} signals from earnings data\n")
        
        print(f"🤖 Screening signals with {'MOCK' if USE_MOCK else 'Llama 3.2 3B on GPU'}...\n")
        
        # Screen each signal
        results = []
        for i, signal in enumerate(all_signals):
            result = analyze_signal_with_llm(llm_components, signal['text'], i+1, len(all_signals))
            result['index'] = i
            result['signal_text'] = signal['text']
            results.append(result)
        
        print(f"   ✅ Completed {len(all_signals)} signal analyses" + " "*20)
        
        print(f"\n{'='*80}")
        print(f"TIER 1 SCREENING RESULTS")
        print(f"{'='*80}\n")
        
        flagged = [r for r in results if r['is_urgent']]
        
        print(f"🎯 Flagged Signals: {len(flagged)}/{len(results)}")
        print(f"📊 Flag Rate: {len(flagged)/len(results)*100:.1f}%\n")
        
        if flagged:
            print("⚠️  FLAGGED SIGNALS FOR TIER 2 ANALYSIS:\n")
            for i, result in enumerate(flagged, 1):
                signal = all_signals[result['index']]
                print(f"{i}. [{signal['stock']} → {signal['crypto']}] Urgency: {result['urgency']}/10")
                print(f"   Signal: {result['signal_text'][:100]}...")
                print(f"   Reasoning: {result['reasoning']}\n")
        else:
            print("✅ No urgent signals detected - market conditions appear stable\n")
        
        print(f"\n{'='*80}")
        print("INTEGRATION TEST COMPLETE")
        print(f"{'='*80}\n")
        
        print("📋 Summary:")
        print(f"   - Stocks analyzed: {len(stocks)}")
        print(f"   - Live data fetched: ✅")
        print(f"   - Signals generated: {len(all_signals)}")
        print(f"   - HuggingFace model: {'❌ MOCK' if USE_MOCK else '✅ PRODUCTION'}")
        print(f"   - Flagged for analysis: {len(flagged)}")
        
    else:
        print("❌ No signals generated from earnings data")

if __name__ == "__main__":
    main()
