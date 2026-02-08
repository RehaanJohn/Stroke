"""
Python-to-Solidity Bridge for NEXUS
====================================

This module handles transaction building, signing, and submission to the NexusVault
smart contract on Arbitrum. It bridges the gap between off-chain AI decisions and
on-chain execution.

Key Features:
- Web3.py integration for Arbitrum
- Transaction signing with agent private key
- Nonce management and gas estimation
- Error handling and retry logic
- LI.FI route data preparation
"""

from web3 import Web3
from eth_account import Account
from typing import Dict, Optional, List
import os
import json
import time
from dataclasses import dataclass

@dataclass
class TradePlan:
    """Trade plan from AI analysis"""
    token_address: str
    token_symbol: str
    source_chain: str
    collateral_usdc: int  # 6 decimals
    entry_price: int  # 30 decimals
    confidence: int  # 0-100
    leverage: int  # 1-50x
    signals: List[str]

@dataclass
class LiFiBridgeData:
    """LI.FI bridge data structure matching Solidity struct"""
    transaction_id: bytes  # bytes32
    bridge: str
    receiver: str
    destination_chain_id: int
    min_amount: int

class ContractExecutor:
    """
    Executes trades on NexusVault smart contract
    """
    
    def __init__(self):
        # Load environment variables
        self.rpc_url = os.getenv('RPC_URL', 'https://sepolia-rollup.arbitrum.io/rpc')
        self.agent_key = os.getenv('AGENT_PRIVATE_KEY')
        self.vault_address = os.getenv('NEXUS_VAULT_ADDRESS')
        
        if not self.agent_key:
            raise ValueError("AGENT_PRIVATE_KEY not set")
        if not self.vault_address:
            raise ValueError("NEXUS_VAULT_ADDRESS not set")
        
        # Setup Web3
        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        
        if not self.w3.is_connected():
            raise ConnectionError("Failed to connect to Arbitrum RPC")
        
        # Setup account
        self.account = Account.from_key(self.agent_key)
        self.agent_address = self.account.address
        
        print(f"✅ Connected to Arbitrum")
        print(f"   Agent address: {self.agent_address}")
        print(f"   Vault address: {self.vault_address}")
        
        # Load contract ABI
        self.vault_abi = self._load_vault_abi()
        self.vault = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.vault_address),
            abi=self.vault_abi
        )
    
    def _load_vault_abi(self) -> List:
        """Load NexusVault ABI from file or define inline"""
        # Simplified ABI with just the functions we need
        return [
            {
                "inputs": [
                    {"name": "indexToken", "type": "address"},
                    {"name": "amountUSDC", "type": "uint256"},
                    {"name": "leverage", "type": "uint256"},
                    {"name": "acceptablePrice", "type": "uint256"},
                    {"name": "sourceChain", "type": "string"},
                    {
                        "name": "bridgeData",
                        "type": "tuple",
                        "components": [
                            {"name": "transactionId", "type": "bytes32"},
                            {"name": "bridge", "type": "string"},
                            {"name": "receiver", "type": "address"},
                            {"name": "destinationChainId", "type": "uint256"},
                            {"name": "minAmount", "type": "uint256"}
                        ]
                    }
                ],
                "name": "executeShort",
                "outputs": [{"name": "positionId", "type": "uint256"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [
                    {"name": "positionId", "type": "uint256"},
                    {"name": "minExitPrice", "type": "uint256"},
                    {"name": "bridgeBack", "type": "bool"},
                    {"name": "destinationChain", "type": "string"},
                    {"name": "recipient", "type": "address"},
                    {
                        "name": "bridgeData",
                        "type": "tuple",
                        "components": [
                            {"name": "transactionId", "type": "bytes32"},
                            {"name": "bridge", "type": "string"},
                            {"name": "receiver", "type": "address"},
                            {"name": "destinationChainId", "type": "uint256"},
                            {"name": "minAmount", "type": "uint256"}
                        ]
                    }
                ],
                "name": "closePosition",
                "outputs": [],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getTotalVaultValue",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "getOpenPositions",
                "outputs": [{
                    "name": "",
                    "type": "tuple[]",
                    "components": [
                        {"name": "id", "type": "uint256"},
                        {"name": "indexToken", "type": "address"},
                        {"name": "collateralUSDC", "type": "uint256"},
                        {"name": "positionSizeUSD", "type": "uint256"},
                        {"name": "leverage", "type": "uint256"},
                        {"name": "entryPrice", "type": "uint256"},
                        {"name": "entryTimestamp", "type": "uint256"},
                        {"name": "gmxPositionKey", "type": "bytes32"},
                        {"name": "isOpen", "type": "bool"},
                        {"name": "sourceChain", "type": "string"}
                    ]
                }],
                "stateMutability": "view",
                "type": "function"
            }
        ]
    
    async def execute_trade(self, trade_plan) -> str:
        """
        Execute trade from gemini_analyzer.TradePlan
        
        Args:
            trade_plan: TradePlan from gemini_analyzer with confidence, decision, etc.
        
        Returns:
            Transaction hash
        """
        from agent.gemini_analyzer import TradePlan as GeminiTradePlan
        
        # Map token symbols to actual Arbitrum addresses
        TOKEN_ADDRESSES = {
            "WETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",  # Wrapped ETH on Arbitrum
            "WBTC": "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f",  # Wrapped BTC on Arbitrum
            "ARB": "0x912CE59144191C1204E64559FE8253a0e49E6548",   # Arbitrum token
            "USDC": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",  # USDC on Arbitrum
            "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",  # USDT on Arbitrum
        }
        
        # Default to WETH if token not found or invalid
        token_address = TOKEN_ADDRESSES.get(trade_plan.token_symbol, TOKEN_ADDRESSES["WETH"])
        
        # Convert to ContractExecutor TradePlan format
        executor_plan = TradePlan(
            token_address=token_address,
            token_symbol=trade_plan.token_symbol,
            source_chain=trade_plan.chain,
            collateral_usdc=int(trade_plan.position_size_usd * 1_000_000),  # Convert to 6 decimals
            entry_price=int(trade_plan.entry_price * 10**30),  # Convert to 30 decimals
            confidence=trade_plan.confidence,
            leverage=trade_plan.leverage,
            signals=trade_plan.risk_factors
        )
        
        # Execute the short
        print(f"\n🚀 Executing SHORT position...")
        print(f"   Token: {executor_plan.token_symbol} ({token_address})")
        print(f"   Amount: ${executor_plan.collateral_usdc / 1_000_000:.2f} USDC")
        print(f"   Leverage: {executor_plan.leverage}x")
        print(f"   Entry Price: ${executor_plan.entry_price / 10**30:.2f}")
        
        tx_hash = self.execute_short(executor_plan)
        return tx_hash
    
    def execute_short(
        self,
        trade_plan: TradePlan,
        lifi_route: Optional[Dict] = None
    ) -> str:
        """
        Execute short position via NexusVault contract
        
        Args:
            trade_plan: Trade parameters from AI analysis
            lifi_route: LI.FI route data (if cross-chain)
        
        Returns:
            Transaction hash (0x...)
        """
        print(f"\n⚡ Executing SHORT on {trade_plan.token_symbol}")
        print(f"   Collateral: ${trade_plan.collateral_usdc / 1e6:.2f} USDC")
        print(f"   Leverage: {trade_plan.leverage}x")
        print(f"   Entry price: ${trade_plan.entry_price / 1e30:.2f}")
        print(f"   Confidence: {trade_plan.confidence}%")
        
        # Prepare bridge data (if cross-chain)
        if trade_plan.source_chain.lower() != "arbitrum" and lifi_route:
            bridge_data = self._prepare_bridge_data(lifi_route)
        else:
            # Direct execution on Arbitrum (no bridge needed)
            bridge_data = (
                b'\x00' * 32,  # Empty transaction ID
                "",  # Empty bridge name
                self.agent_address,  # Receiver
                42161,  # Arbitrum chain ID
                0  # Min amount
            )
        
        # Get GMX execution fee (usually ~0.0001 ETH)
        gmx_fee = self.w3.to_wei(0.0001, 'ether')
        
        # Build transaction
        try:
            # Get current gas price and increase it by 20% to ensure it goes through
            base_gas_price = self.w3.eth.gas_price
            gas_price = int(base_gas_price * 1.2)
            
            tx = self.vault.functions.executeShort(
                Web3.to_checksum_address(trade_plan.token_address),
                trade_plan.collateral_usdc,
                trade_plan.leverage,
                trade_plan.entry_price,
                trade_plan.source_chain,
                bridge_data
            ).build_transaction({
                'from': self.agent_address,
                'value': gmx_fee,
                'gas': 800000,  # Gas limit
                'gasPrice': gas_price,  # Use increased gas price
                'nonce': self.w3.eth.get_transaction_count(self.agent_address),
                'chainId': 421614  # Arbitrum Sepolia testnet
            })
        except Exception as e:
            print(f"❌ Failed to build transaction: {e}")
            raise
        
        # Sign transaction
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.agent_key)
        
        # Send transaction
        try:
            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            print(f"✅ Transaction sent: {tx_hash.hex()}")
            
            # Wait for confirmation
            print("   Waiting for confirmation...")
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
            
            if receipt['status'] == 1:
                print(f"✅ Transaction confirmed in block {receipt['blockNumber']}")
                
                # Parse position ID from logs
                position_id = self._parse_position_id(receipt)
                if position_id:
                    print(f"   Position ID: {position_id}")
                
                return tx_hash.hex()
            else:
                print(f"❌ Transaction reverted")
                raise Exception("Transaction failed on-chain")
                
        except Exception as e:
            print(f"❌ Transaction failed: {e}")
            raise
    
    def close_position(
        self,
        position_id: int,
        min_exit_price: int,
        bridge_back: bool = False,
        destination_chain: str = "",
        recipient: str = ""
    ) -> str:
        """
        Close short position
        
        Args:
            position_id: Position ID to close
            min_exit_price: Minimum acceptable exit price (30 decimals)
            bridge_back: Whether to bridge profits back
            destination_chain: Destination chain if bridging
            recipient: Recipient address if bridging
        
        Returns:
            Transaction hash
        """
        print(f"\n🔚 Closing position #{position_id}")
        print(f"   Min exit price: ${min_exit_price / 1e30:.2f}")
        
        # Empty bridge data for now (can be enhanced with LI.FI)
        bridge_data = (
            b'\x00' * 32,
            "",
            recipient or self.agent_address,
            0,
            0
        )
        
        gmx_fee = self.w3.to_wei(0.0001, 'ether')
        
        tx = self.vault.functions.closePosition(
            position_id,
            min_exit_price,
            bridge_back,
            destination_chain,
            Web3.to_checksum_address(recipient or self.agent_address),
            bridge_data
        ).build_transaction({
            'from': self.agent_address,
            'value': gmx_fee,
            'gas': 500000,
            'gasPrice': self.w3.eth.gas_price,
            'nonce': self.w3.eth.get_transaction_count(self.agent_address),
            'chainId': 42161
        })
        
        signed_tx = self.w3.eth.account.sign_transaction(tx, self.agent_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"✅ Close transaction sent: {tx_hash.hex()}")
        
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if receipt['status'] == 1:
            print(f"✅ Position closed successfully")
        else:
            print(f"❌ Close transaction failed")
        
        return tx_hash.hex()
    
    def get_vault_balance(self) -> float:
        """Get total USDC in vault"""
        balance = self.vault.functions.getTotalVaultValue().call()
        return balance / 1e6  # Convert to USDC
    
    def get_open_positions(self) -> List[Dict]:
        """Get all open positions"""
        positions = self.vault.functions.getOpenPositions().call()
        
        result = []
        for pos in positions:
            result.append({
                'id': pos[0],
                'token': pos[1],
                'collateral': pos[2] / 1e6,
                'size': pos[3] / 1e30,
                'leverage': pos[4],
                'entry_price': pos[5] / 1e30,
                'timestamp': pos[6],
                'is_open': pos[8],
                'source_chain': pos[9]
            })
        
        return result
    
    def _prepare_bridge_data(self, lifi_route: Dict) -> tuple:
        """Convert LI.FI route to Solidity bridge data struct"""
        return (
            Web3.to_bytes(hexstr=lifi_route.get('id', '0x' + '00' * 32)),  # Transaction ID
            lifi_route.get('steps', [{}])[0].get('toolDetails', {}).get('name', 'stargate'),  # Bridge name
            Web3.to_checksum_address(self.agent_address),  # Receiver
            lifi_route.get('toChainId', 42161),  # Destination chain ID
            int(lifi_route.get('toAmountMin', '0'))  # Min amount
        )
    
    def _parse_position_id(self, receipt: Dict) -> Optional[int]:
        """Parse position ID from transaction receipt"""
        try:
            # Look for ShortExecuted event
            for log in receipt['logs']:
                if log['address'].lower() == self.vault_address.lower():
                    # First topic is event signature, second is position ID
                    if len(log['topics']) >= 2:
                        position_id = int.from_bytes(log['topics'][1], 'big')
                        return position_id
        except Exception as e:
            print(f"Warning: Could not parse position ID: {e}")
        
        return None

# Example usage
if __name__ == '__main__':
    executor = ContractExecutor()
    
    # Check vault balance
    balance = executor.get_vault_balance()
    print(f"Vault balance: ${balance:,.2f} USDC")
    
    # Example trade plan
    trade = TradePlan(
        token_address="0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",  # WETH
        token_symbol="WETH",
        source_chain="arbitrum",
        collateral_usdc=5_000_000,  # $5,000 USDC
        entry_price=2000 * 10**30,  # $2,000/ETH
        confidence=85,
        leverage=2,
        signals=["INSIDER_DUMP", "LIQUIDITY_REMOVAL"]
    )
    
    # Execute (uncomment to actually execute)
    # tx_hash = executor.execute_short(trade)
    # print(f"Transaction: https://arbiscan.io/tx/{tx_hash}")
