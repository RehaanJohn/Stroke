"""
Signal Classifier - Routes trading signals to appropriate execution strategies

Strategies:
1. GMX_SHORT - Blue-chip tokens (WETH, WBTC, LINK, UNI) bearish → GMX perpetual short
2. CORRELATED_SHORT - Memecoin pre-rug → Short correlated blue-chip (ETH)
3. DIP_BUY - Memecoin post-rug → Buy the dip for dead cat bounce
"""

import logging
from typing import Dict, Optional, List
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class Strategy(Enum):
    """Execution strategies"""
    GMX_SHORT = "GMX_SHORT"                 # Direct short on GMX
    CORRELATED_SHORT = "CORRELATED_SHORT"   # Short ETH/BTC when memecoin rugs
    DIP_BUY = "DIP_BUY"                     # Buy memecoin after rug
    SKIP = "SKIP"                           # Don't trade


class TokenType(Enum):
    """Token classification"""
    BLUE_CHIP = "BLUE_CHIP"     # WETH, WBTC, LINK, UNI (GMX supported)
    MEMECOIN = "MEMECOIN"        # PEPE, SHIB, random memecoins
    DEFI = "DEFI"                # Medium-cap DeFi tokens
    UNKNOWN = "UNKNOWN"


class MarketPhase(Enum):
    """Market phase for memecoins"""
    PRE_RUG = "PRE_RUG"         # Rug about to happen
    POST_RUG = "POST_RUG"       # Already rugged, crashed >60%
    BOUNCE = "BOUNCE"            # Dead cat bounce happening
    UNCLEAR = "UNCLEAR"


@dataclass
class TradePlan:
    """Trade plan from Claude/Gemini Tier 2"""
    token_symbol: str
    token_address: str
    chain: str
    confidence: int  # 0-100
    position_size_usd: float
    leverage: int
    reasoning: str
    entry_price: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None


@dataclass
class Classification:
    """Signal classification result"""
    strategy: Strategy
    token_type: TokenType
    market_phase: Optional[MarketPhase] = None
    correlated_asset: Optional[str] = None
    current_price: Optional[float] = None
    price_drop_24h: Optional[float] = None
    bounce_target: Optional[float] = None
    confidence_multiplier: float = 1.0
    reason: Optional[str] = None


class SignalClassifier:
    """Classify trading signals into execution strategies"""
    
    # GMX-supported tokens on Arbitrum
    BLUE_CHIP_TOKENS = {
        'WETH': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        'WBTC': '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
        'LINK': '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
        'UNI': '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0'
    }
    
    # Token symbol → address mapping (expand as needed)
    TOKEN_ADDRESSES = {
        **BLUE_CHIP_TOKENS,
        'PEPE': '0x6982508145454Ce325dDbE47a25d4ec3d2311933',  # Ethereum
        'SHIB': '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
        'DOGE': '0xbA2aE424d960c26247Dd6c32edC70B295c744C43',  # Wrapped DOGE
    }
    
    # Chain → correlated blue chip for shorts
    CHAIN_CORRELATIONS = {
        'base': 'WETH',
        'ethereum': 'WETH',
        'arbitrum': 'WETH',
        'optimism': 'WETH',
        'polygon': 'WETH',
        'bsc': 'WBTC'
    }
    
    def __init__(self):
        logger.info("SignalClassifier initialized")
    
    def classify(self, trade_plan: TradePlan) -> Classification:
        """
        Classify a trade plan into execution strategy
        
        Args:
            trade_plan: Trade plan from Tier 2 AI
            
        Returns:
            Classification with strategy and parameters
        """
        logger.info(f"Classifying signal for {trade_plan.token_symbol}")
        
        # Determine token type
        token_type = self._classify_token(trade_plan.token_symbol, trade_plan.token_address)
        
        # Route based on token type
        if token_type == TokenType.BLUE_CHIP:
            return self._classify_blue_chip(trade_plan)
        
        elif token_type == TokenType.MEMECOIN:
            return self._classify_memecoin(trade_plan)
        
        elif token_type == TokenType.DEFI:
            return self._classify_defi(trade_plan)
        
        else:
            return Classification(
                strategy=Strategy.SKIP,
                token_type=TokenType.UNKNOWN,
                reason=f"Unknown token type for {trade_plan.token_symbol}"
            )
    
    def _classify_token(self, symbol: str, address: str) -> TokenType:
        """Determine token type from symbol/address"""
        
        # Check if blue chip
        if symbol in self.BLUE_CHIP_TOKENS:
            return TokenType.BLUE_CHIP
        
        if address.lower() in [addr.lower() for addr in self.BLUE_CHIP_TOKENS.values()]:
            return TokenType.BLUE_CHIP
        
        # Check known memecoins
        memecoin_keywords = ['PEPE', 'SHIB', 'DOGE', 'FLOKI', 'ELON', 'WOJAK', 'TURBO']
        if any(keyword in symbol.upper() for keyword in memecoin_keywords):
            return TokenType.MEMECOIN
        
        # Check DeFi tokens
        defi_keywords = ['AAVE', 'UNI', 'CRV', 'SNX', 'MKR', 'COMP', 'SUSHI']
        if any(keyword in symbol.upper() for keyword in defi_keywords):
            return TokenType.DEFI
        
        # Default to memecoin if unclear (conservative)
        return TokenType.MEMECOIN
    
    def _classify_blue_chip(self, plan: TradePlan) -> Classification:
        """Blue-chip token → GMX short"""
        
        logger.info(f"Blue-chip detected: {plan.token_symbol} → GMX SHORT")
        
        return Classification(
            strategy=Strategy.GMX_SHORT,
            token_type=TokenType.BLUE_CHIP,
            confidence_multiplier=1.0,
            reason=f"GMX supports {plan.token_symbol} perpetual shorts"
        )
    
    def _classify_memecoin(self, plan: TradePlan) -> Classification:
        """Memecoin → determine market phase and strategy"""
        
        # Get current price data
        price_data = self._get_price_data(plan.token_address, plan.chain)
        
        if not price_data:
            logger.warning(f"No price data for {plan.token_symbol}, skipping")
            return Classification(
                strategy=Strategy.SKIP,
                token_type=TokenType.MEMECOIN,
                reason="No price data available"
            )
        
        # Determine market phase
        market_phase = self._detect_market_phase(price_data)
        
        if market_phase == MarketPhase.PRE_RUG:
            # Rug about to happen → Short correlated ETH
            logger.info(f"Memecoin PRE-RUG detected: {plan.token_symbol} → CORRELATED SHORT")
            
            return Classification(
                strategy=Strategy.CORRELATED_SHORT,
                token_type=TokenType.MEMECOIN,
                market_phase=MarketPhase.PRE_RUG,
                correlated_asset=self._get_correlated_asset(plan.chain),
                confidence_multiplier=0.7,  # Discount for correlation risk
                reason=f"Memecoin rug imminent, shorting correlated {self._get_correlated_asset(plan.chain)}"
            )
        
        elif market_phase == MarketPhase.POST_RUG:
            # Already rugged → Buy the dip
            logger.info(f"Memecoin POST-RUG detected: {plan.token_symbol} → DIP BUY")
            
            current_price = price_data['current']
            bounce_target = current_price * 1.4  # +40% bounce target
            
            return Classification(
                strategy=Strategy.DIP_BUY,
                token_type=TokenType.MEMECOIN,
                market_phase=MarketPhase.POST_RUG,
                current_price=current_price,
                price_drop_24h=price_data['change_24h'],
                bounce_target=bounce_target,
                confidence_multiplier=0.8,
                reason=f"Rug complete ({price_data['change_24h']:.1f}% drop), buying dip for bounce"
            )
        
        else:
            logger.info(f"Unclear market phase for {plan.token_symbol}, skipping")
            return Classification(
                strategy=Strategy.SKIP,
                token_type=TokenType.MEMECOIN,
                market_phase=MarketPhase.UNCLEAR,
                reason="Market phase unclear, not trading"
            )
    
    def _classify_defi(self, plan: TradePlan) -> Classification:
        """DeFi token → check if GMX supports it"""
        
        # For now, treat like memecoin (no GMX support)
        # In future, could check GMX API for supported tokens
        logger.info(f"DeFi token {plan.token_symbol} → treating as memecoin")
        return self._classify_memecoin(plan)
    
    def _detect_market_phase(self, price_data: Dict) -> MarketPhase:
        """Determine market phase from price data"""
        
        change_24h = price_data.get('change_24h', 0)
        volume_spike = price_data.get('volume_spike', False)
        
        if change_24h < -60:
            # Crashed >60% in 24h = POST_RUG
            return MarketPhase.POST_RUG
        
        elif change_24h > 20 and volume_spike:
            # Pumping with volume spike = Potential rug setup
            return MarketPhase.PRE_RUG
        
        elif -60 < change_24h < -20:
            # Dropping but not crashed yet = PRE_RUG
            return MarketPhase.PRE_RUG
        
        else:
            return MarketPhase.UNCLEAR
    
    def _get_correlated_asset(self, chain: str) -> str:
        """Get blue chip to short when memecoin rugs"""
        return self.CHAIN_CORRELATIONS.get(chain.lower(), 'WETH')
    
    def _get_price_data(self, token_address: str, chain: str) -> Optional[Dict]:
        """
        Get current price data for token
        
        TODO: Integrate with real price oracle (CoinGecko, DEX aggregator)
        For now, returns mock data
        """
        
        # Mock price data
        # In production, query CoinGecko API or on-chain oracle
        return {
            'current': 0.0000012,
            'change_24h': -85.0,  # -85% drop (post-rug)
            'volume_spike': False,
            'liquidity': 50000
        }
    
    def get_token_address(self, symbol: str) -> Optional[str]:
        """Get token address from symbol"""
        return self.TOKEN_ADDRESSES.get(symbol.upper())
