#!/usr/bin/env python3
"""
Start the NEXUS Agent API Server
This server provides REST endpoints for the Next.js frontend
Run this BEFORE running the live trading script
"""

import sys
from pathlib import Path

# Add agent directory to path
sys.path.append(str(Path(__file__).parent / 'agent'))

# Import and run
from agent.api_server import app
import uvicorn

if __name__ == "__main__":
    print("""
╔═══════════════════════════════════════════════════════════════╗
║                  NEXUS AGENT API SERVER                       ║
║                                                               ║
║  Starting FastAPI server on http://localhost:8000            ║
║  Endpoints:                                                   ║
║    GET  /          - Health check                            ║
║    GET  /logs      - Get agent logs (real-time)              ║
║    GET  /logs/stats - Get log statistics                     ║
║    POST /agent/start - Start agent                           ║
║                                                               ║
║  Next.js frontend will fetch logs from this server           ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "agent.api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
