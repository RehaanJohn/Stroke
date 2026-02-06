"""
Blockchain Integration Module
Connects Python AI Agent to Blockchain Service (Node.js) and Smart Contracts
"""

import logging
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class BlockchainIntegration:
    """Publishes signals and executes shorts via blockchain"""
    
    def __init__(
        self,
        blockchain_service_url: str = "http://localhost:8001",
        min_confidence_for_publish: int = 60,
        min_confidence_for_short: int = 75,
        enabled: bool = True
    ):
        self.blockchain_url = blockchain_service_url
        self.min_confidence_publish = min_confidence_for_publish
        self.min_confidence_short = min_confidence_for_short
        self.enabled = enabled
        
        self.stats = {
            "signals_published": 0,
            "shorts_executed": 0,
            "dip_buys_executed": 0,
            "positions_closed": 0,
            "publish_errors": 0,
            "execution_errors": 0
        }
        
        if self.enabled:
            logger.info(f"Blockchain integration initialized: {blockchain_service_url}")
        else:
            logger.info("Blockchain integration DISABLED")
    
    def publish_signals(self, signals: List[Dict[str, Any]]) -> Optional[str]:
        """
        Publish signals to SignalOracle contract
        
        Args:
            signals: List of signal dicts with urgency, type, tokens, etc.
        
        Returns:
            Transaction hash if successful, None otherwise
        """
        if not self.enabled:
            logger.debug("Blockchain disabled - skipping signal publish")
            return None
        
        # Filter signals above minimum confidence
        high_confidence = [
            s for s in signals 
            if s.get('urgency', 0) >= self.min_confidence_publish
        ]
        
        if not high_confidence:
            logger.debug(f"No signals above {self.min_confidence_publish} confidence threshold")
            return None
        
        try:
            # Format signals for blockchain
            blockchain_signals = []
            for signal in high_confidence:
                blockchain_signals.append({
                    'type': signal.get('signal_type', 'REGULATORY_RISK'),
                    'tokenAddress': self._extract_token_address(signal),
                    'chain': signal.get('chain', 'arbitrum'),
                    'score': min(100, signal.get('urgency', 50) * 10),
                    'urgency': signal.get('urgency', 5),
                    'metadataHash': self._create_metadata_hash(signal)
                })
            
            logger.info(f"📡 Publishing {len(blockchain_signals)} signals to blockchain...")
            
            response = requests.post(
                f"{self.blockchain_url}/api/signals/publish",
                json={'signals': blockchain_signals},
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                tx_hash = result.get('txHash')
                
                self.stats['signals_published'] += len(blockchain_signals)
                logger.info(f"✅ Signals published on-chain: {tx_hash}")
                
                return tx_hash
            else:
                logger.error(f"❌ Signal publish failed: {response.status_code} - {response.text}")
                self.stats['publish_errors'] += 1
                return None
                
        except Exception as e:
            logger.error(f"❌ Blockchain publish error: {e}")
            self.stats['publish_errors'] += 1
            return None
    
    def execute_short(
        self,
        index_token: str,
        collateral_usdc: int,
        leverage: int,
        confidence: int,
        source_chain: str = 'arbitrum',
        token_address: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Execute GMX perpetual short position
        
        Args:
            index_token: Token symbol to short (e.g., 'WETH', 'WBTC')
            collateral_usdc: USDC collateral amount (6 decimals)
            leverage: Leverage multiplier (1-50x, typically 2-10x)
            confidence: AI confidence score 0-100
            source_chain: Chain where funds originate
            token_address: Optional token contract address
        
        Returns:
            Dict with txHash, positionId, gmxKey if successful
        """
        if not self.enabled:
            logger.warning("Blockchain disabled - cannot execute short")
            return None
        
        if confidence < self.min_confidence_short:
            logger.warning(
                f"Confidence {confidence} below threshold {self.min_confidence_short} - skipping short"
            )
            return None
        
        try:
            # Get token address if not provided
            if not token_address:
                token_address = self._lookup_token_address(index_token, 'arbitrum')  # GMX only on Arbitrum
            
            if not token_address:
                logger.error(f"Cannot find token address for {index_token}")
                return None
            
            logger.info(f"\n🎯 EXECUTING GMX SHORT")
            logger.info(f"Token: {index_token} ({token_address})")
            logger.info(f"Collateral: {collateral_usdc / 1e6:.2f} USDC")
            logger.info(f"Leverage: {leverage}x")
            logger.info(f"Confidence: {confidence}%")
            
            response = requests.post(
                f"{self.blockchain_url}/api/shorts/execute",
                json={
                    'indexToken': token_address,
                    'collateralUSDC': collateral_usdc,
                    'leverage': leverage,
                    'sourceChain': source_chain
                },
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                
                self.stats['shorts_executed'] += 1
                logger.info(f"✅ GMX SHORT executed successfully!")
                logger.info(f"TX: {result.get('txHash')}")
                logger.info(f"Position ID: {result.get('positionId')}")
                logger.info(f"GMX Key: {result.get('gmxPositionKey')}")
                
                return result
            else:
                logger.error(f"❌ Short execution failed: {response.status_code} - {response.text}")
                self.stats['execution_errors'] += 1
                return None
                
        except Exception as e:
            logger.error(f"❌ Short execution error: {e}")
            self.stats['execution_errors'] += 1
            return None
    
    def execute_dip_buy(
        self,
        token: str,
        chain: str,
        amount_usdc: int,
        take_profit_price: float,
        stop_loss_price: float,
        confidence: int
    ) -> Optional[Dict[str, Any]]:
        """
        Execute memecoin dip buy after rug pull
        
        Args:
            token: Memecoin contract address
            chain: Chain where memecoin lives (e.g., 'base', 'ethereum')
            amount_usdc: USDC to spend (6 decimals)
            take_profit_price: Target sell price for bounce
            stop_loss_price: Stop loss price
            confidence: AI confidence score
        
        Returns:
            Dict with txHash and positionId if successful
        """
        if not self.enabled:
            logger.warning("Blockchain disabled - cannot execute dip buy")
            return None
        
        try:
            logger.info(f"\n🎯 EXECUTING DIP BUY")
            logger.info(f"Token: {token}")
            logger.info(f"Chain: {chain}")
            logger.info(f"Amount: {amount_usdc / 1e6:.2f} USDC")
            logger.info(f"Take Profit: ${take_profit_price:.8f}")
            logger.info(f"Stop Loss: ${stop_loss_price:.8f}")
            logger.info(f"Confidence: {confidence}%")
            
            response = requests.post(
                f"{self.blockchain_url}/api/dip-buys/execute",
                json={
                    'token': token,
                    'chain': chain,
                    'amountUSDC': amount_usdc,
                    'takeProfitPrice': take_profit_price,
                    'stopLossPrice': stop_loss_price
                },
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                
                self.stats['dip_buys_executed'] += 1
                logger.info(f"✅ DIP BUY executed successfully!")
                logger.info(f"TX: {result.get('txHash')}")
                logger.info(f"Position ID: {result.get('positionId')}")
                
                return result
            else:
                logger.error(f"❌ Dip buy failed: {response.status_code} - {response.text}")
                self.stats['execution_errors'] += 1
                return None
                
        except Exception as e:
            logger.error(f"❌ Dip buy error: {e}")
            self.stats['execution_errors'] += 1
            return None
    
    def get_vault_balance(self) -> float:
        """Get vault USDC balance"""
        if not self.enabled:
            return 0.0
        
        try:
            response = requests.get(
                f"{self.blockchain_url}/api/vault/balance",
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                return float(result.get('balanceUSDC', 0)) / 1e6
            return 0.0
            
        except Exception as e:
            logger.error(f"Vault balance fetch error: {e}")
            return 0.0
    
    def close_position(
        self,
        position_id: int,
        token_address: str,
        chain: str,
        size_tokens: str
    ) -> Optional[Dict[str, Any]]:
        """Close a short position"""
        if not self.enabled:
            return None
        
        try:
            logger.info(f"\n🔄 CLOSING POSITION #{position_id}")
            
            response = requests.post(
                f"{self.blockchain_url}/api/shorts/close",
                json={
                    'positionId': position_id,
                    'tokenAddress': token_address,
                    'chain': chain,
                    'sizeTokens': size_tokens,
                    'toChain': 'arbitrum'
                },
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                
                self.stats['positions_closed'] += 1
                logger.info(f"✅ Position closed!")
                logger.info(f"TX: {result.get('txHash')}")
                logger.info(f"P&L: {result.get('pnl')} USDC")
                
                return result
            else:
                logger.error(f"❌ Close failed: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Close error: {e}")
            return None
    
    def get_performance_metrics(self) -> Optional[Dict[str, Any]]:
        """Get on-chain performance metrics"""
        if not self.enabled:
            return None
        
        try:
            response = requests.get(
                f"{self.blockchain_url}/api/metrics",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json().get('metrics')
            return None
            
        except Exception as e:
            logger.error(f"Metrics fetch error: {e}")
            return None
    
    def get_open_positions(self) -> List[Dict[str, Any]]:
        """Get all open positions"""
        if not self.enabled:
            return []
        
        try:
            response = requests.get(
                f"{self.blockchain_url}/api/positions/open",
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json().get('positions', [])
            return []
            
        except Exception as e:
            logger.error(f"Positions fetch error: {e}")
            return []
    
    def get_stats(self) -> Dict[str, int]:
        """Get integration stats"""
        return self.stats.copy()
    
    # ========================================
    # HELPER METHODS
    # ========================================
    
    def _extract_token_address(self, signal: Dict[str, Any]) -> str:
        """Extract or lookup token address from signal"""
        # Try to get from signal metadata
        if 'token_address' in signal:
            return signal['token_address']
        
        # Try to extract from tokens list
        tokens = signal.get('tokens', [])
        if tokens and len(tokens) > 0:
            # TODO: Lookup actual address
            return '0x0000000000000000000000000000000000000000'
        
        return '0x0000000000000000000000000000000000000000'
    
    def _create_metadata_hash(self, signal: Dict[str, Any]) -> str:
        """Create metadata hash (simplified - in production upload to IPFS)"""
        # In production: Upload full signal JSON to IPFS, return hash
        # For now: Create simple hash
        import hashlib
        metadata_json = json.dumps(signal, sort_keys=True)
        hash_bytes = hashlib.sha256(metadata_json.encode()).digest()
        return '0x' + hash_bytes.hex()
    
    def _lookup_token_address(self, symbol: str, chain: str) -> Optional[str]:
        """Lookup token contract address by symbol"""
        # Simplified token address mapping
        # In production: Use real token registry or API
        
        token_addresses = {
            'arbitrum': {
                'USDC': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
                'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
                'LINK': '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
                'UNI': '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0',
                'ARB': '0x912CE59144191C1204E64559FE8253a0e49E6548',
            },
            'base': {
                'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                'WETH': '0x4200000000000000000000000000000000000006',
            },
            'optimism': {
                'USDC': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
                'WETH': '0x4200000000000000000000000000000000000006',
                'OP': '0x4200000000000000000000000000000000000042',
            }
        }
        
        return token_addresses.get(chain, {}).get(symbol.upper())
