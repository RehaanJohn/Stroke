"""
NEXUS Strategy Loop - Monitor → Decide → Act
=============================================

This is the main execution loop that ties together:
1. Signal monitoring (on-chain + social)
2. AI analysis (Llama 3.2 + Gemini)
3. LI.FI cross-chain bridging
4. GMX perpetual shorts execution

The loop runs continuously, scanning for rug pull signals and executing
autonomous shorts when confidence thresholds are met.
"""

import asyncio
import sys
import os
from pathlib import Path
from typing import List, Dict
from datetime import datetime

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from orchestration import OrchestrationEngine
from contract_executor import ContractExecutor, TradePlan

# Token addresses on Arbitrum
TOKEN_ADDRESSES = {
    'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548',
}

class NEXUSStrategyLoop:
    """
    Main autonomous trading loop
    """
    
    def __init__(self):
        print("🚀 Initializing NEXUS Strategy Loop...")
        
        # Initialize components
        self.orchestration = OrchestrationEngine()
        self.executor = ContractExecutor()
        
        # Track active positions
        self.active_positions: Dict[int, Dict] = {}
        
        # Configuration
        self.min_confidence = int(os.getenv('MIN_CONFIDENCE', '70'))
        self.max_positions = int(os.getenv('MAX_POSITIONS', '5'))
        self.cycle_interval = int(os.getenv('CYCLE_INTERVAL_SECONDS', '300'))  # 5 minutes
        
        print(f"✅ Strategy loop initialized")
        print(f"   Min confidence: {self.min_confidence}%")
        print(f"   Max positions: {self.max_positions}")
        print(f"   Cycle interval: {self.cycle_interval}s")
    
    async def run(self):
        """
        Main strategy loop: monitor → decide → act
        """
        print("\n" + "="*60)
        print("🔄 NEXUS STRATEGY LOOP STARTED")
        print("="*60 + "\n")
        
        cycle_count = 0
        
        while True:
            cycle_count += 1
            cycle_start = datetime.now()
            
            print(f"\n{'='*60}")
            print(f"📊 CYCLE #{cycle_count} - {cycle_start.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"{'='*60}\n")
            
            try:
                # PHASE 1: MONITOR - Ingest signals
                await self._monitor_signals()
                
                # PHASE 2: DECIDE - Run AI analysis
                trade_opportunities = await self._analyze_opportunities()
                
                # PHASE 3: ACT - Execute trades
                if trade_opportunities:
                    await self._execute_trades(trade_opportunities)
                else:
                    print("   No high-confidence opportunities found")
                
                # PHASE 4: MANAGE - Monitor active positions
                await self._manage_positions()
                
                # PHASE 5: REPORT - Display status
                self._report_status()
                
            except Exception as e:
                print(f"❌ Error in cycle {cycle_count}: {e}")
                import traceback
                traceback.print_exc()
            
            # Wait before next cycle
            cycle_duration = (datetime.now() - cycle_start).total_seconds()
            wait_time = max(0, self.cycle_interval - cycle_duration)
            
            print(f"\n⏸️  Waiting {wait_time:.0f}s until next cycle...")
            await asyncio.sleep(wait_time)
    
    async def _monitor_signals(self):
        """
        PHASE 1: Monitor on-chain and social signals
        """
        print("📡 PHASE 1: MONITORING SIGNALS")
        print("-" * 60)
        
        try:
            # Ingest on-chain signals (screener)
            print("   🔍 Scanning on-chain data...")
            on_chain_signals = self.orchestration.ingest_signals(count=500)
            print(f"   ✅ Found {len(on_chain_signals)} tokens with on-chain signals")
            
            # Ingest social signals (Twitter, GitHub, etc.)
            print("   🐦 Scanning social signals...")
            social_signals = self.orchestration.ingest_social_signals(min_urgency=7)
            print(f"   ✅ Found {len(social_signals)} tokens with social signals")
            
        except Exception as e:
            print(f"   ⚠️  Signal monitoring failed: {e}")
    
    async def _analyze_opportunities(self) -> List[TradePlan]:
        """
        PHASE 2: Run AI analysis (Llama 3.2 + Gemini)
        """
        print("\n🤖 PHASE 2: AI ANALYSIS")
        print("-" * 60)
        
        try:
            # Run orchestration cycle
            print("   🧠 Running Tier 1 + Tier 2 analysis...")
            results = self.orchestration.run_cycle()
            
            # Extract SHORT recommendations
            shorts = results.get('shorts', [])
            print(f"   ✅ AI recommends {len(shorts)} SHORT positions")
            
            # Filter by confidence threshold
            high_confidence = [s for s in shorts if s.get('confidence', 0) >= self.min_confidence]
            print(f"   ✅ {len(high_confidence)} meet confidence threshold ({self.min_confidence}%)")
            
            # Convert to TradePlan objects
            trade_plans = []
            
            for short in high_confidence:
                symbol = short.get('token', 'UNKNOWN')
                
                # Map symbol to address (default to WETH if unknown)
                token_address = TOKEN_ADDRESSES.get(symbol, TOKEN_ADDRESSES['WETH'])
                
                trade_plan = TradePlan(
                    token_address=token_address,
                    token_symbol=symbol,
                    source_chain="arbitrum",  # Direct execution
                    collateral_usdc=5_000_000,  # $5,000 USDC (6 decimals)
                    entry_price=int(short.get('entry_price', 2000) * 10**30),  # 30 decimals
                    confidence=short.get('confidence', 0),
                    leverage=2,  # 2x leverage
                    signals=short.get('signals', [])
                )
                
                trade_plans.append(trade_plan)
                
                print(f"\n   📊 Trade Plan: {symbol}")
                print(f"      Confidence: {trade_plan.confidence}%")
                print(f"      Entry: ${trade_plan.entry_price / 1e30:.2f}")
                print(f"      Collateral: ${trade_plan.collateral_usdc / 1e6:.2f}")
                print(f"      Signals: {', '.join(trade_plan.signals)}")
            
            return trade_plans
            
        except Exception as e:
            print(f"   ❌ Analysis failed: {e}")
            return []
    
    async def _execute_trades(self, trade_plans: List[TradePlan]):
        """
        PHASE 3: Execute trades via LI.FI + GMX
        """
        print("\n⚡ PHASE 3: EXECUTING TRADES")
        print("-" * 60)
        
        # Check position limit
        current_positions = len(self.active_positions)
        slots_available = self.max_positions - current_positions
        
        if slots_available <= 0:
            print(f"   ⚠️  Max positions reached ({self.max_positions})")
            return
        
        print(f"   📊 Position slots: {current_positions}/{self.max_positions}")
        
        # Execute top N trades (up to available slots)
        for i, trade_plan in enumerate(trade_plans[:slots_available]):
            try:
                print(f"\n   ⚡ Executing trade {i+1}/{min(len(trade_plans), slots_available)}")
                
                # Execute via contract
                tx_hash = self.executor.execute_short(trade_plan)
                
                # Track position
                position_id = i + 1  # Simplified (parse from contract events in production)
                self.active_positions[position_id] = {
                    'trade_plan': trade_plan,
                    'tx_hash': tx_hash,
                    'timestamp': datetime.now(),
                    'status': 'OPEN'
                }
                
                print(f"   ✅ Position #{position_id} opened")
                print(f"      TX: https://arbiscan.io/tx/{tx_hash}")
                
            except Exception as e:
                print(f"   ❌ Trade execution failed: {e}")
    
    async def _manage_positions(self):
        """
        PHASE 4: Manage active positions (monitor P&L, close if needed)
        """
        print("\n💼 PHASE 4: MANAGING POSITIONS")
        print("-" * 60)
        
        if not self.active_positions:
            print("   No active positions")
            return
        
        try:
            # Get current positions from contract
            contract_positions = self.executor.get_open_positions()
            
            print(f"   📊 Active positions: {len(contract_positions)}")
            
            for pos in contract_positions:
                position_id = pos['id']
                
                # Check if we should close (simplified logic)
                # In production: check take-profit, stop-loss, time-based exit
                age_hours = (datetime.now() - self.active_positions.get(position_id, {}).get('timestamp', datetime.now())).total_seconds() / 3600
                
                print(f"\n   Position #{position_id}")
                print(f"      Token: {pos['token']}")
                print(f"      Entry: ${pos['entry_price']:.2f}")
                print(f"      Collateral: ${pos['collateral']:.2f}")
                print(f"      Age: {age_hours:.1f}h")
                
                # Example: Close after 24 hours
                if age_hours > 24:
                    print(f"      ⚠️  Position aged out, closing...")
                    # self.executor.close_position(position_id, min_exit_price=...)
                
        except Exception as e:
            print(f"   ⚠️  Position management failed: {e}")
    
    def _report_status(self):
        """
        PHASE 5: Report overall system status
        """
        print("\n📈 SYSTEM STATUS")
        print("-" * 60)
        
        try:
            # Get vault balance
            vault_balance = self.executor.get_vault_balance()
            print(f"   Vault Balance: ${vault_balance:,.2f} USDC")
            
            # Position count
            print(f"   Active Positions: {len(self.active_positions)}")
            
            # Health check
            print(f"   Status: 🟢 HEALTHY")
            
        except Exception as e:
            print(f"   ⚠️  Status check failed: {e}")

def main():
    """
    Entry point for NEXUS strategy loop
    """
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Check required env vars
    required_vars = ['AGENT_PRIVATE_KEY', 'NEXUS_VAULT_ADDRESS', 'ARBITRUM_RPC']
    missing = [var for var in required_vars if not os.getenv(var)]
    
    if missing:
        print(f"❌ Missing required environment variables: {', '.join(missing)}")
        print("\n📝 Create a .env file with:")
        print("   AGENT_PRIVATE_KEY=0x...")
        print("   NEXUS_VAULT_ADDRESS=0x...")
        print("   ARBITRUM_RPC=https://arb1.arbitrum.io/rpc")
        return
    
    # Create and run loop
    loop = NEXUSStrategyLoop()
    
    try:
        asyncio.run(loop.run())
    except KeyboardInterrupt:
        print("\n\n🛑 Strategy loop stopped by user")
    except Exception as e:
        print(f"\n\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
