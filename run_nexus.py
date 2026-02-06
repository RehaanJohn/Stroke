#!/usr/bin/env python3
"""
NEXUS Main Application Runner
==============================

This script orchestrates the entire NEXUS system:
1. Validates configuration
2. Checks contract deployment
3. Starts the AI strategy loop
4. Monitors system health

Usage:
    python3 run_nexus.py              # Run with default settings
    python3 run_nexus.py --dry-run    # Simulation mode (no real trades)
    python3 run_nexus.py --test       # Run tests first
"""

import asyncio
import sys
import os
import argparse
from pathlib import Path
from dotenv import load_dotenv
import logging
from datetime import datetime

# Add agent directory to path
sys.path.append(str(Path(__file__).parent / 'agent'))

# Create logs directory if it doesn't exist
Path('logs').mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/nexus.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('NEXUS')

def print_banner():
    """Print NEXUS startup banner"""
    banner = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗             ║
║     ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝             ║
║     ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗             ║
║     ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║             ║
║     ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║             ║
║     ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝             ║
║                                                              ║
║            Autonomous AI Trading Agent v1.0                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)

def validate_environment():
    """Validate environment configuration"""
    logger.info("🔍 Validating environment configuration...")
    
    required_vars = [
        'ARBITRUM_RPC',
        'DEPLOYER_PRIVATE_KEY',
        'AGENT_PRIVATE_KEY',
        'GEMINI_API_KEY',
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        logger.error("Please update your .env file")
        return False
    
    # Check contract addresses
    if not os.getenv('NEXUS_VAULT_ADDRESS'):
        logger.warning("⚠️  NEXUS_VAULT_ADDRESS not set - contracts may not be deployed")
        logger.warning("Run deployment first: npm run deploy:arbitrum")
        return False
    
    logger.info("✅ Environment configuration valid")
    return True

def check_contract_deployment():
    """Check if contracts are deployed and accessible"""
    logger.info("🔍 Checking contract deployment...")
    
    from web3 import Web3
    
    rpc_url = os.getenv('ARBITRUM_RPC')
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    if not w3.is_connected():
        logger.error(f"❌ Cannot connect to Arbitrum RPC: {rpc_url}")
        return False
    
    logger.info(f"✅ Connected to Arbitrum (Chain ID: {w3.eth.chain_id})")
    
    vault_address = os.getenv('NEXUS_VAULT_ADDRESS')
    if vault_address:
        code = w3.eth.get_code(vault_address)
        if code == b'':
            logger.error(f"❌ No contract found at NexusVault address: {vault_address}")
            return False
        logger.info(f"✅ NexusVault contract verified: {vault_address}")
    
    return True

def check_vault_balance():
    """Check USDC balance in vault"""
    logger.info("💰 Checking vault balance...")
    
    try:
        from web3 import Web3
        from web3.middleware import geth_poa_middleware
        
        w3 = Web3(Web3.HTTPProvider(os.getenv('ARBITRUM_RPC')))
        w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        vault_address = os.getenv('NEXUS_VAULT_ADDRESS')
        usdc_address = os.getenv('USDC_ADDRESS')
        
        # USDC ABI (balanceOf only)
        usdc_abi = [
            {
                "constant": True,
                "inputs": [{"name": "_owner", "type": "address"}],
                "name": "balanceOf",
                "outputs": [{"name": "balance", "type": "uint256"}],
                "type": "function"
            }
        ]
        
        usdc = w3.eth.contract(address=usdc_address, abi=usdc_abi)
        balance = usdc.functions.balanceOf(vault_address).call()
        balance_usdc = balance / 1e6  # USDC has 6 decimals
        
        logger.info(f"✅ Vault balance: {balance_usdc:,.2f} USDC")
        
        if balance_usdc < 100:
            logger.warning("⚠️  Vault balance is low! Fund the vault with USDC to start trading.")
            logger.warning(f"   Vault address: {vault_address}")
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to check vault balance: {e}")
        return False

async def run_strategy_loop(dry_run=False):
    """Run the main strategy loop"""
    logger.info("🚀 Starting NEXUS strategy loop...")
    
    if dry_run:
        logger.warning("⚠️  DRY RUN MODE - No real trades will be executed")
    
    try:
        from agent.strategy_loop import NEXUSStrategyLoop
        
        strategy = NEXUSStrategyLoop()
        
        if dry_run:
            strategy.executor.dry_run = True
        
        await strategy.run()
        
    except KeyboardInterrupt:
        logger.info("\n⏸️  Strategy loop stopped by user")
    except Exception as e:
        logger.error(f"❌ Strategy loop error: {e}")
        import traceback
        traceback.print_exc()

def run_tests():
    """Run system tests"""
    logger.info("🧪 Running system tests...")
    
    import subprocess
    
    # Run Python tests
    logger.info("Running Python tests...")
    result = subprocess.run(['python3', '-m', 'pytest', 'agent/tests/', '-v'], 
                          capture_output=True, text=True)
    
    if result.returncode != 0:
        logger.error("❌ Python tests failed")
        print(result.stdout)
        print(result.stderr)
        return False
    
    logger.info("✅ Python tests passed")
    
    # Run Hardhat tests
    logger.info("Running smart contract tests...")
    result = subprocess.run(['npx', 'hardhat', 'test'], 
                          capture_output=True, text=True)
    
    if result.returncode != 0:
        logger.error("❌ Smart contract tests failed")
        print(result.stdout)
        print(result.stderr)
        return False
    
    logger.info("✅ Smart contract tests passed")
    return True

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='NEXUS Autonomous Trading Agent')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Run in simulation mode (no real trades)')
    parser.add_argument('--test', action='store_true',
                       help='Run tests before starting')
    parser.add_argument('--skip-checks', action='store_true',
                       help='Skip environment and contract checks')
    
    args = parser.parse_args()
    
    # Load environment
    load_dotenv()
    
    # Create logs directory
    Path('logs').mkdir(exist_ok=True)
    
    # Print banner
    print_banner()
    logger.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run tests if requested
    if args.test:
        if not run_tests():
            logger.error("Tests failed. Fix issues before running.")
            sys.exit(1)
    
    # Validation checks
    if not args.skip_checks:
        if not validate_environment():
            logger.error("Environment validation failed")
            sys.exit(1)
        
        if not check_contract_deployment():
            logger.error("Contract deployment check failed")
            sys.exit(1)
        
        if not check_vault_balance():
            logger.warning("Vault balance check failed - proceeding with caution")
    
    # Start strategy loop
    logger.info("")
    logger.info("="*60)
    logger.info("🎬 NEXUS is ready to start trading!")
    logger.info("="*60)
    logger.info("")
    
    if args.dry_run:
        logger.info("Mode: DRY RUN (simulation only)")
    else:
        logger.info("Mode: LIVE TRADING")
        logger.warning("⚠️  Real trades will be executed with real funds!")
        
        # Safety confirmation for live mode
        response = input("\nContinue with LIVE trading? (yes/no): ")
        if response.lower() != 'yes':
            logger.info("Aborted by user")
            sys.exit(0)
    
    logger.info("")
    logger.info("Press Ctrl+C to stop")
    logger.info("")
    
    # Run the strategy loop
    try:
        asyncio.run(run_strategy_loop(dry_run=args.dry_run))
    except KeyboardInterrupt:
        logger.info("\n👋 NEXUS stopped gracefully")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
