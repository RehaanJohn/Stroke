# Live Agent Logs System

## Overview

The NEXUS trading agent now has real-time logging that streams directly to the frontend UI. All AI analysis, signal detections, and trade executions are logged and displayed live.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   LIVE TRADING SCRIPT                       │
│              (run_live_trading.py)                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Log Manager (Singleton)                           │   │
│  │  - Stores logs in memory (max 1000)                │   │
│  │  - Thread-safe deque                               │   │
│  │  - Auto-timestamps                                 │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Logs to console & memory         │
│                          ▼                                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              FASTAPI SERVER (Port 8000)                     │
│                                                             │
│  GET /logs              - Fetch logs (filterable)          │
│  GET /logs/stats        - Get log statistics               │
│  DELETE /logs           - Clear all logs                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              NEXT.JS FRONTEND (Port 3000)                   │
│                                                             │
│  /api/logs              - Next.js API route (proxy)        │
│  /logs                  - Full logs page                   │
│  /portfolio             - Dashboard (live logs sidebar)    │
│                                                             │
│  Auto-refresh: Every 2 seconds                             │
└─────────────────────────────────────────────────────────────┘
```

## Usage Instructions

### Step 1: Start the API Server

**Terminal 1** - Start the FastAPI backend server:

```bash
python start_api_server.py
```

This will start on `http://localhost:8000` and serve log endpoints.

### Step 2: Start Next.js Frontend

**Terminal 2** - Start the Next.js dev server:

```bash
npm run dev
```

This will start on `http://localhost:3000`.

### Step 3: Run the Live Trading Script

**Terminal 3** - Execute the trading system:

```bash
python run_live_trading.py
```

Now watch the magic happen! ✨

## What Gets Logged

### Log Types

- **📊 signal** - Market signal detections (Twitter, Yahoo, SEC)
- **⚡ execution** - Trade executions, position opens/closes
- **🤖 analysis** - AI analysis results (Tier 1 & Tier 2)
- **🌉 routing** - Cross-chain routing via LI.FI
- **👁️ monitor** - System monitoring events

### Severity Levels

- **critical** 🔴 - Critical failures, major issues
- **high** 🟠 - Important events, high confidence signals
- **warning** 🟡 - Warnings, low confidence
- **success** 🟢 - Successful operations
- **info** ⚪ - General information

## Example Logs

When you run `run_live_trading.py`, you'll see logs like:

```
📊 [SIGNAL] Received 29 live signals from market
🤖 [ANALYSIS] Tier 1 screening 29 signals with HuggingFace LLM
📊 [SIGNAL] $SCAM: 85% confidence (3 bearish signals)
🤖 [ANALYSIS] Tier 1 flagged 7 tokens as high-risk
🤖 [ANALYSIS] Tier 2 deep analysis on 7 tokens
🤖 [ANALYSIS] Best SHORT: $SCAM (80% confidence)
⚡ [EXECUTION] Initiating SHORT position on $SCAM
⚡ [EXECUTION] SHORT executed: $SCAM | TX: 0x4e828d7...eb0f3
```

These logs appear:

1. **Instantly in Terminal** - Console output
2. **In Memory** - Stored in LogManager
3. **Via API** - Available at `GET /logs`
4. **On Frontend** - Auto-updates every 2 seconds

## Frontend Pages

### /portfolio

- **Dashboard view** with live logs sidebar
- Shows last 10 logs
- Auto-refreshes every 2 seconds
- Click arrow icon → go to full logs page

### /logs

- **Full logs page** with filtering
- Filter tabs: All, Signals, Execution, Analysis
- Statistics cards: Total logs, Critical events, Signals, Executions
- Shows up to 100 logs
- Auto-refreshes every 2 seconds

## API Endpoints

### GET /logs

Fetch logs with optional filtering:

```bash
# Get all logs
curl http://localhost:8000/logs

# Get only signal logs
curl http://localhost:8000/logs?log_type=signal

# Get critical logs
curl http://localhost:8000/logs?severity=critical

# Limit to 50 logs
curl http://localhost:8000/logs?limit=50
```

### GET /logs/stats

Get statistics:

```bash
curl http://localhost:8000/logs/stats
```

Response:

```json
{
  "total_logs": 42,
  "by_type": {
    "signal": 15,
    "execution": 8,
    "analysis": 12,
    "routing": 3,
    "monitor": 4
  },
  "by_severity": {
    "critical": 2,
    "high": 10,
    "warning": 8,
    "success": 15,
    "info": 7
  }
}
```

### DELETE /logs

Clear all logs:

```bash
curl -X DELETE http://localhost:8000/logs
```

## Code Integration

### Adding Logs in Python

```python
from agent.log_manager import log_signal, log_execution, log_analysis

# Log a signal detection
log_signal(
    "Twitter engagement dropped 72% for @CryptoKing",
    severity="high"
)

# Log a trade execution
log_execution(
    "SHORT position opened: $SCAM on Base",
    severity="success"
)

# Log AI analysis
log_analysis(
    "Tier 2 confidence: 95/100 - EXECUTE SHORT",
    severity="high"
)
```

### Log Manager API

```python
from agent.log_manager import get_log_manager

log_manager = get_log_manager()

# Add custom log
log_manager.add_log(
    log_type="custom",
    message="Custom event occurred",
    severity="info",
    metadata={"key": "value"}
)

# Get logs
logs = log_manager.get_logs(limit=50, log_type="signal")

# Get stats
stats = log_manager.get_stats()

# Clear logs
log_manager.clear_logs()
```

## Benefits

✅ **Real-time Visibility** - See exactly what the agent is doing live
✅ **Debugging** - Instantly spot issues without digging through terminal output
✅ **Production Ready** - Thread-safe, bounded memory (max 1000 logs)
✅ **Filterable** - Find specific events quickly
✅ **Professional UI** - Beautiful, color-coded interface
✅ **Zero Config** - Works automatically when you run the trading script

## Performance

- **Memory**: Max 1000 logs in memory (~500KB)
- **Thread Safety**: Uses threading.Lock for concurrent access
- **Auto-Refresh**: Frontend polls every 2 seconds
- **No Database**: All in-memory for speed
- **Log Rotation**: Oldest logs auto-removed when limit reached

## Troubleshooting

### No logs appearing?

1. Make sure API server is running (`python start_api_server.py`)
2. Check console for errors
3. Verify `http://localhost:8000/logs` returns data
4. Check browser console for fetch errors

### Logs not updating?

- Frontend auto-refreshes every 2 seconds
- Run `python run_live_trading.py` to generate logs
- Check that CORS is enabled in api_server.py

### Old logs showing?

- Logs persist in memory until server restart
- Clear logs: `curl -X DELETE http://localhost:8000/logs`
- Or restart API server

## Files Modified

### New Files

- `agent/log_manager.py` - Core logging system
- `app/api/logs/route.ts` - Next.js API endpoint
- `app/api/logs/stats/route.ts` - Stats endpoint
- `app/logs/page.tsx` - Full logs UI page
- `start_api_server.py` - API server launcher

### Modified Files

- `run_live_trading.py` - Added logging throughout
- `agent/api_server.py` - Added /logs endpoints
- `app/portfolio/page.tsx` - Live logs sidebar

## Next Steps

🚀 The system is fully operational! Just run:

1. `python start_api_server.py` (Terminal 1)
2. `npm run dev` (Terminal 2)
3. `python run_live_trading.py` (Terminal 3)

Then watch your logs appear live at `http://localhost:3000/logs`! 🎉
