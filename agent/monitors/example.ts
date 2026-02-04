/**
 * Example Usage of TradFi Monitor
 * 
 * This demonstrates how to integrate the TradFi monitor with your agent system
 */

import { TradFiMonitor } from './TradFiMonitor';
import { SignalType } from './types';

async function main() {
  // Initialize the monitor
  const tradFiMonitor = new TradFiMonitor({
    enabled: true,
    scanIntervalMs: 60000, // Scan every minute
    cacheTimeMs: 3600000,  // Cache for 1 hour
  });

  console.log('🎯 NEXUS TradFi Monitor Starting...');
  console.log('📊 Tracking tickers:', tradFiMonitor.getTrackedTickers().join(', '));
  console.log('');

  // Run continuous monitoring loop
  while (true) {
    console.log(`[${new Date().toISOString()}] Scanning TradFi signals...`);
    
    try {
      const signals = await tradFiMonitor.scan();

      if (signals.length === 0) {
        console.log('✓ No signals detected');
      } else {
        console.log(`🚨 Detected ${signals.length} signals:`);
        
        for (const signal of signals) {
          console.log('');
          console.log(`  Type: ${signal.type}`);
          console.log(`  Token: ${signal.metadata.cryptoSymbol}`);
          console.log(`  Chain: ${signal.chain}`);
          console.log(`  Score: ${signal.score}/100`);
          console.log(`  Source Ticker: ${signal.metadata.ticker}`);
          
          if (signal.type === SignalType.EARNINGS_MISS) {
            console.log(`  EPS Miss: ${signal.metadata.epsMissPercent}%`);
            console.log(`  Actual: ${signal.metadata.epsActual} vs Estimate: ${signal.metadata.epsEstimate}`);
          } else if (signal.type === SignalType.REVENUE_MISS) {
            console.log(`  Revenue Miss: ${signal.metadata.revenueMissPercent}%`);
            console.log(`  Actual: ${signal.metadata.revenueActual} vs Estimate: ${signal.metadata.revenueEstimate}`);
          } else if (signal.type === SignalType.INSIDER_SELLING_SEC) {
            if (signal.metadata.largeInsiderSells) {
              console.log(`  Large Insider Sells: ${signal.metadata.largeInsiderSells.length}`);
              signal.metadata.largeInsiderSells.forEach((sell: any) => {
                console.log(`    - ${sell.title}: $${(sell.totalValue / 1000000).toFixed(2)}M`);
              });
            }
            if (signal.metadata.coordinatedSelling) {
              console.log(`  Coordinated Selling: ${signal.metadata.sellersCount} insiders`);
            }
          }
          
          console.log(`  Correlation Strength: ${signal.metadata.correlationStrength}%`);
        }

        // Filter high-confidence signals (score >= 70)
        const highConfidenceSignals = signals.filter(s => s.score >= 70);
        
        if (highConfidenceSignals.length > 0) {
          console.log('');
          console.log('⚡ HIGH CONFIDENCE SIGNALS (≥70):');
          highConfidenceSignals.forEach(s => {
            console.log(`  → SHORT ${s.metadata.cryptoSymbol} (${s.score}/100) - ${s.type}`);
          });
        }
      }

    } catch (error) {
      console.error('Error during scan:', error);
    }

    console.log('');
    console.log('---');
    console.log('');

    // Wait before next scan
    await new Promise(resolve => setTimeout(resolve, tradFiMonitor['config'].scanIntervalMs));
  }
}

// Integration example with existing agent system
export async function integrateWithAgent() {
  const tradFiMonitor = new TradFiMonitor({
    enabled: true,
    scanIntervalMs: 60000,
    cacheTimeMs: 3600000,
  });

  // Example: Add custom ticker mapping
  tradFiMonitor.addTickerMapping({
    ticker: 'AAPL',
    cryptoTokens: [
      {
        symbol: 'AAPL-TOKEN',
        chain: 'ethereum',
        address: '0x...',
        correlationStrength: 50,
      }
    ]
  });

  // Scan for signals
  const signals = await tradFiMonitor.scan();

  // Feed signals to your orchestration engine
  // Example integration with existing Python agent
  for (const signal of signals) {
    // Convert TypeScript signal to format expected by Python agent
    const pythonSignal = {
      token_symbol: signal.metadata.cryptoSymbol,
      token_address: signal.token,
      chain: signal.chain,
      signal_type: signal.type,
      signal_score: signal.score,
      metadata: signal.metadata,
      timestamp: new Date(signal.timestamp).toISOString(),
    };

    // Send to Python orchestration engine via API
    // await axios.post('http://localhost:8000/api/signals', pythonSignal);
    
    console.log('Signal forwarded to agent:', pythonSignal);
  }

  return signals;
}

// Run if executed directly
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  main().catch(console.error);
}
