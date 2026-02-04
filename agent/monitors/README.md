# NEXUS Agent Monitors

TypeScript monitoring modules for detecting short signals from multiple data sources.

## Overview

The monitor system is built on a modular architecture where each monitor extends `BaseMonitor` and returns an array of standardized `Signal` objects. Monitors run independently and can be aggregated by the orchestration engine.

## Architecture

```
monitors/
├── types.ts              # Signal types and interfaces
├── OnChainMonitor.ts     # Base class + on-chain monitoring
├── TradFiMonitor.ts      # Traditional finance signals
├── example.ts            # Usage examples
├── index.ts              # Module exports
└── README.md             # This file
```

## Monitors

### TradFiMonitor

Monitors traditional finance signals that correlate to crypto assets.

**Data Sources:**

- Yahoo Finance (earnings data)
- SEC EDGAR (Form 4 insider trading filings)

**Signals Generated:**

- `EARNINGS_MISS` - EPS miss > 10%
- `REVENUE_MISS` - Revenue miss > 5%
- `INSIDER_SELLING_SEC` - CEO/CFO sells > $5M or multiple insiders within 7 days

**Stock → Crypto Mappings:**

- `NVDA` → RENDER, FET, TAO, OCEAN (AI tokens)
- `COIN` → BTC, ETH (Coinbase correlation)
- `MSTR` → BTC (MicroStrategy Bitcoin treasury)
- `TSLA` → DOGE (Elon Musk correlation)
- `META` → MASK (Metaverse correlation)

**Features:**

- ✅ Caching (1 hour default) to avoid rate limits
- ✅ Proper User-Agent for SEC requests
- ✅ Graceful error handling
- ✅ Correlation strength weighting
- ✅ Pattern detection (coordinated selling)

### OnChainMonitor (Base)

Base class for all monitors. Provides:

- Caching infrastructure
- Configuration management
- Standard `scan()` interface

**Planned Features:**

- Insider wallet tracking
- Liquidity pool monitoring
- TVL change detection
- Holder concentration analysis

## Usage

### Basic Usage

```typescript
import { TradFiMonitor } from "./monitors";

const monitor = new TradFiMonitor({
  enabled: true,
  scanIntervalMs: 60000, // 1 minute
  cacheTimeMs: 3600000, // 1 hour cache
});

const signals = await monitor.scan();

signals.forEach((signal) => {
  console.log(
    `${signal.type}: ${signal.metadata.cryptoSymbol} (${signal.score}/100)`,
  );
});
```

### Integration with Agent System

```typescript
import { TradFiMonitor, SignalType } from "./monitors";

async function runMonitoring() {
  const monitor = new TradFiMonitor({
    enabled: true,
    scanIntervalMs: 60000,
    cacheTimeMs: 3600000,
  });

  while (true) {
    const signals = await monitor.scan();

    // Filter high-confidence signals
    const shortSignals = signals.filter((s) => s.score >= 70);

    // Send to orchestration engine
    for (const signal of shortSignals) {
      await sendToOrchestrator(signal);
    }

    await sleep(monitor.config.scanIntervalMs);
  }
}
```

### Custom Ticker Mappings

```typescript
monitor.addTickerMapping({
  ticker: "AAPL",
  cryptoTokens: [
    {
      symbol: "SOME-TOKEN",
      chain: "ethereum",
      address: "0x...",
      correlationStrength: 75,
    },
  ],
});
```

## Signal Structure

```typescript
interface Signal {
  type: SignalType; // Enum of signal types
  token: string; // Token address
  chain?: string; // Blockchain (ethereum, arbitrum, etc.)
  score: number; // 0-100 confidence score
  metadata: Record<string, any>; // Signal-specific data
  timestamp: number; // Unix timestamp
  source: string; // Monitor name
}
```

## Signal Types

```typescript
enum SignalType {
  // TradFi
  EARNINGS_MISS = "EARNINGS_MISS",
  REVENUE_MISS = "REVENUE_MISS",
  INSIDER_SELLING_SEC = "INSIDER_SELLING_SEC",

  // On-chain (planned)
  INSIDER_WALLET_DUMP = "INSIDER_WALLET_DUMP",
  LIQUIDITY_REMOVAL = "LIQUIDITY_REMOVAL",
  TVL_DECLINE = "TVL_DECLINE",

  // Social (planned)
  TWITTER_ENGAGEMENT_DROP = "TWITTER_ENGAGEMENT_DROP",
  INFLUENCER_SILENCE = "INFLUENCER_SILENCE",

  // ... and more
}
```

## Configuration

```typescript
interface MonitorConfig {
  enabled: boolean; // Enable/disable monitor
  scanIntervalMs: number; // How often to scan
  cacheTimeMs?: number; // Cache duration (default: 1 hour)
}
```

## Caching Strategy

All monitors use intelligent caching:

- **Default TTL:** 1 hour
- **Purpose:** Avoid API rate limits
- **Key Format:** `{dataType}_{identifier}` (e.g., `earnings_NVDA`)
- **Cache Miss:** Fetches fresh data and updates cache
- **Cache Hit:** Returns cached data if within TTL

## Error Handling

Monitors follow graceful degradation:

```typescript
try {
  const signals = await monitor.scan();
} catch (error) {
  // Logged but doesn't throw - continues to next scan
  console.error("[Monitor] Error:", error);
  return []; // Empty signals array
}
```

## API Requirements

### Yahoo Finance

- No authentication required (uses public API)
- Rate limit: ~2000 requests/hour
- User-Agent: Standard browser UA

### SEC EDGAR

- **Required:** Valid User-Agent with contact info
- Format: `"AppName contact@email.com"`
- Rate limit: 10 requests/second
- All requests must be throttled

## Dependencies

```json
{
  "axios": "^1.7.9"
}
```

Install with:

```bash
npm install axios
```

## Development

### Running Example

```bash
# Compile TypeScript
npx tsc agent/monitors/example.ts --outDir dist

# Run example
node dist/agent/monitors/example.js
```

### Testing

```typescript
import { TradFiMonitor } from "./monitors";

const monitor = new TradFiMonitor({
  enabled: true,
  scanIntervalMs: 5000, // 5 seconds for testing
  cacheTimeMs: 60000, // 1 minute cache
});

// Single scan
const signals = await monitor.scan();
console.log(signals);

// Check tracked tickers
console.log(monitor.getTrackedTickers());

// Get mapping for specific ticker
console.log(monitor.getCryptoTokensForTicker("NVDA"));
```

## Integration with Python Agent

Signals can be forwarded to the Python orchestration engine:

```typescript
const signals = await tradFiMonitor.scan();

for (const signal of signals) {
  await axios.post("http://localhost:8000/api/signals", {
    token_symbol: signal.metadata.cryptoSymbol,
    token_address: signal.token,
    chain: signal.chain,
    signal_type: signal.type,
    signal_score: signal.score,
    metadata: signal.metadata,
    timestamp: new Date(signal.timestamp).toISOString(),
  });
}
```

## Future Enhancements

- [ ] Additional ticker mappings (GOOGL, MSFT, etc.)
- [ ] Real-time earnings alerts via webhooks
- [ ] Form 4 XML parsing (currently simplified)
- [ ] Integration with paid financial APIs (Bloomberg, FactSet)
- [ ] Twitter sentiment correlation
- [ ] Macroeconomic indicator tracking (Fed, CPI, NFP)
- [ ] Options flow correlation (unusual options activity)

## License

Part of NEXUS Agent - ETHGlobal HackMoney 2025
