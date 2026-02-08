"""
FastAPI Server for NEXUS Agent
Provides REST API endpoints for frontend integration
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import asyncio
from datetime import datetime

from agent.orchestration import OrchestrationEngine
from agent.gemini_analyzer import TradePlan
from agent.log_manager import get_log_manager

# Initialize FastAPI app
app = FastAPI(
    title="NEXUS Agent API",
    description="Two-tier crypto shorting signal screener",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global engine instance
engine = None
is_running = False


# Response models
class StatusResponse(BaseModel):
    status: str
    is_running: bool
    cycles_completed: int
    timestamp: str


class CycleSummary(BaseModel):
    cycle_number: int
    cycle_time_seconds: float
    signals_processed: int
    tier1_flagged: int
    tier2_shorts: int
    tier2_monitors: int
    gemini_api_cost: float


class TradePlanResponse(BaseModel):
    token_symbol: str
    token_address: str
    chain: str
    decision: str
    confidence: int
    position_size_percent: float
    take_profit_1_percent: float
    take_profit_2_percent: float
    take_profit_3_percent: float
    stop_loss_percent: float
    best_execution_chain: str
    reasoning: str
    risk_factors: List[str]


# Startup/shutdown events
@app.on_event("startup")
async def startup():
    """Initialize orchestration engine on startup"""
    global engine
    engine = OrchestrationEngine(
        batch_size=100,
        tier1_mock=True,  # Use mock mode for demo
        tier2_mock=True
    )
    print("NEXUS Agent API started successfully")


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    global is_running
    is_running = False
    print("NEXUS Agent API shutting down")


# Endpoints
@app.get("/", response_model=StatusResponse)
async def root():
    """Health check and status"""
    return StatusResponse(
        status="online",
        is_running=is_running,
        cycles_completed=engine.stats["cycles_completed"] if engine else 0,
        timestamp=datetime.utcnow().isoformat()
    )


@app.post("/agent/start")
async def start_agent(background_tasks: BackgroundTasks):
    """Start the agent screening cycles"""
    global is_running
    
    if is_running:
        raise HTTPException(status_code=400, detail="Agent is already running")
    
    is_running = True
    
    # Run cycle in background
    background_tasks.add_task(run_screening_cycle)
    
    return {"message": "Agent started", "status": "running"}


@app.post("/agent/stop")
async def stop_agent():
    """Stop the agent"""
    global is_running
    
    if not is_running:
        raise HTTPException(status_code=400, detail="Agent is not running")
    
    is_running = False
    
    return {"message": "Agent stopped", "status": "stopped"}


@app.post("/agent/cycle", response_model=CycleSummary)
async def run_single_cycle(signals: int = 500):
    """Run a single screening cycle manually"""
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    
    summary = engine.run_cycle(signals_per_cycle=signals)
    
    return CycleSummary(**summary)


@app.get("/positions/shorts", response_model=List[TradePlanResponse])
async def get_short_positions(min_confidence: int = 70):
    """Get all SHORT recommendations"""
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    
    shorts = engine.get_short_recommendations(min_confidence=min_confidence)
    
    return [
        TradePlanResponse(
            token_symbol=tp.token_symbol,
            token_address=tp.token_address,
            chain=tp.chain,
            decision=tp.decision,
            confidence=tp.confidence,
            position_size_percent=tp.position_size_percent,
            take_profit_1_percent=tp.take_profit_1_percent,
            take_profit_2_percent=tp.take_profit_2_percent,
            take_profit_3_percent=tp.take_profit_3_percent,
            stop_loss_percent=tp.stop_loss_percent,
            best_execution_chain=tp.best_execution_chain,
            reasoning=tp.reasoning,
            risk_factors=tp.risk_factors
        )
        for tp in shorts
    ]


@app.get("/positions/monitors", response_model=List[TradePlanResponse])
async def get_monitor_list():
    """Get all tokens on MONITOR list"""
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    
    monitors = engine.get_monitor_list()
    
    return [
        TradePlanResponse(
            token_symbol=tp.token_symbol,
            token_address=tp.token_address,
            chain=tp.chain,
            decision=tp.decision,
            confidence=tp.confidence,
            position_size_percent=tp.position_size_percent,
            take_profit_1_percent=tp.take_profit_1_percent,
            take_profit_2_percent=tp.take_profit_2_percent,
            take_profit_3_percent=tp.take_profit_3_percent,
            stop_loss_percent=tp.stop_loss_percent,
            best_execution_chain=tp.best_execution_chain,
            reasoning=tp.reasoning,
            risk_factors=tp.risk_factors
        )
        for tp in monitors
    ]


@app.get("/stats")
async def get_stats():
    """Get complete system statistics"""
    if not engine:
        raise HTTPException(status_code=500, detail="Engine not initialized")
    
    return engine.get_full_stats()


@app.get("/logs")
async def get_recent_logs(
    limit: int = 100,
    log_type: Optional[str] = None,
    severity: Optional[str] = None
):
    """Get recent agent logs with optional filtering"""
    log_manager = get_log_manager()
    
    logs = log_manager.get_logs(
        limit=limit,
        log_type=log_type,
        severity=severity
    )
    
    return {"logs": logs}


@app.get("/logs/stats")
async def get_log_stats():
    """Get log statistics"""
    log_manager = get_log_manager()
    return log_manager.get_stats()


@app.delete("/logs")
async def clear_logs():
    """Clear all logs"""
    log_manager = get_log_manager()
    log_manager.clear_logs()
    return {"message": "Logs cleared successfully"}


# Background task
async def run_screening_cycle():
    """Background task that runs continuous screening cycles"""
    global is_running, engine
    
    while is_running:
        try:
            # Run one cycle
            engine.run_cycle(signals_per_cycle=500)
            
            # Wait before next cycle (10 seconds for demo)
            await asyncio.sleep(10)
        
        except Exception as e:
            print(f"Error in screening cycle: {e}")
            is_running = False


if __name__ == "__main__":
    uvicorn.run(
        "api_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
