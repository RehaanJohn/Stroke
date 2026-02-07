# NEXUS Smart Contracts Integration - GMX + LI.FI

## Overview

NEXUS executes **real perpetual shorts** using **GMX** (perpetual DEX) with **LI.FI** (cross-chain bridging) for capital efficiency.

## Architecture

```
Python AI Agent (Tier 1 + Tier 2)
    ↓
    Publishes signals to SignalOracle.sol
    ↓
Node.js Blockchain Service (Express API)
    ↓
    Fetches LI.FI bridge routes
    ↓
NexusVault.sol
    ↓
    1. LI.FI bridges USDC to Arbitrum (if needed)
    2. GMX opens perpetual SHORT position
    3. Price crashes → SHORT profits
    4. GMX closes position
    5. LI.FI bridges profits back (optional)
    ↓
    Records in PositionRegistry.sol
```

## How It Works

### ✅ Real Perpetual Shorts (Not Fake!)

**Traditional (Wrong) Approach:**

- Swap USDC → Token (you're now LONG the token)
- Price drops → You lose money ❌

**NEXUS (Correct) Approach:**

- Open GMX SHORT with USDC collateral
- Price drops → GMX position profits ✅
- No need to hold the scam token
- Up to 50x leverage available

### Cross-Chain Flow

```
User has $20k USDC on Base
    ↓
LI.FI bridges: Base → Arbitrum (~30 sec)
    ↓
GMX opens 2x SHORT on $SCAMCOIN
  Collateral: $20k USDC
  Position: $40k SHORT
    ↓
Price: $0.85 → $0.28 (-67%)
    ↓
Profit: $26,800 (67% × 2x leverage)
    ↓
LI.FI bridges back: Arbitrum → Base
    ↓
Final: $46,800 USDC on Base
```

## Smart Contracts

### 1. **NexusVault.sol** - Main Execution Contract

- Holds USDC treasury
- **Bridges via LI.FI** to Arbitrum (if funds on other chains)
- **Executes perpetual SHORTS on GMX** (not just buying tokens!)
- Validates signals from SignalOracle
- Enforces position limits (max 20% of vault per short)
- Handles GMX callbacks after execution
- Bridges profits back via LI.FI

**Key Functions:**

```solidity
executeShort(indexToken, amountUSDC, leverage, acceptablePrice, sourceChain, lifiCalldata)
  → Opens GMX SHORT position with up to 50x leverage

closePosition(positionId, minExitPrice, bridgeBack, destinationChain, recipient, lifiCalldata)
  → Closes GMX SHORT, calculates P&L, bridges profits back

gmxPositionCallback(positionKey, isExecuted, isIncrease)
  → Receives GMX execution confirmation
```

### 2. **SignalOracle.sol** - Signal Publisher

- Stores AI agent signals on-chain
- Aggregates confidence scores
- Provides transparent audit trail
- 12 signal types (REGULATORY_RISK, INSIDER_WALLET_DUMP, etc.)

### 3. **PositionRegistry.sol** - Performance Tracker

- Records all positions (open/closed)
- Calculates P&L automatically
- Tracks win rate, average return
- On-chain proof of performance

## GMX Integration

### What is GMX?

GMX is a **decentralized perpetual exchange** on Arbitrum that allows leveraged trading (1-50x) without holding the underlying asset.

**Why GMX?**

- ✅ Real perpetual shorts (not fake swaps)
- ✅ Up to 50x leverage
- ✅ Decentralized (no KYC, no CEX risk)
- ✅ $50B+ trading volume (battle-tested)
- ✅ Only on Arbitrum (perfect for LI.FI integration)

### GMX Position Flow

1. **Open SHORT:**

   ```
   NexusVault approves USDC → GMX Position Router
   Creates increase position request (isLong = false)
   GMX Keeper executes position (~30 sec)
   Callback confirms execution
   ```

2. **Track Position:**

   ```
   Query GMX Vault for position size, collateral, P&L
   Check unrealized profit/loss
   Monitor liquidation price
   ```

3. **Close SHORT:**
   ```
   Create decrease position request
   GMX Keeper closes position
   USDC returned (collateral + profit/loss)
   Callback confirms close
   ```

## LI.FI Integration

### Why LI.FI?

**Problem:** GMX only on Arbitrum, but users have USDC on Base/Polygon/etc.

**Solution:** LI.FI bridges USDC cross-chain automatically.

**Use Cases:**

1. **Bridge IN:** Any chain → Arbitrum (for GMX execution)
2. **Bridge OUT:** Arbitrum → Any chain (return profits to user)

### LI.FI Flow

```typescript
// Example: Bridge from Base to Arbitrum
const route = await lifi.getBridgeToArbitrumRoute({
  fromChain: 'base',
  amountUSDC: '20000000', // 20 USDC
  nexusVaultAddress: NEXUS_VAULT
});

// Execute bridge
NexusVault.executeShort(..., lifiCalldata);
// → LI.FI bridges USDC
// → Callback triggers GMX short opening
```

### Sponsor Track Compliance

✅ **Cross-chain capital efficiency:** Users keep USDC on preferred chain  
✅ **Bridge aggregation:** LI.FI finds fastest/cheapest route  
✅ **Destination execution:** GMX short opens after bridge  
✅ **Profit repatriation:** Bridge profits back to original chain  
✅ **Multi-chain support:** Works from Ethereum, Base, Optimism, Polygon

## Setup

### 1. Install Blockchain Service Dependencies

```bash
cd blockchain
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
# Arbitrum Mainnet (GMX only works on mainnet)
RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY

# Agent wallet private key
AGENT_PRIVATE_KEY=0x...

# GMX Contracts (Arbitrum Mainnet)
GMX_POSITION_ROUTER=0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868
GMX_VAULT=0x489ee077994B6658eAfA855C308275EAd8097C4A

# LI.FI Diamond (Arbitrum)
LIFI_DIAMOND=0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE

# Contract addresses (after deployment)
NEXUS_VAULT_ADDRESS=0x...
SIGNAL_ORACLE_ADDRESS=0x...
POSITION_REGISTRY_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...

# Enable blockchain integration
BLOCKCHAIN_ENABLED=true
```

### 3. Deploy Contracts (Arbitrum Mainnet)

⚠️ **Note:** GMX does NOT support testnets. You must deploy to Arbitrum Mainnet.

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Deploy to Arbitrum Mainnet
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY \
  --broadcast \
  --verify
```

**Estimated Deployment Cost:** ~$10-20 (Arbitrum is cheap!)

### 4. Fund Vault & Approve Tokens

```bash
# Send USDC to vault (start with $50-100 for testing)
cast send 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
  "transfer(address,uint256)" $NEXUS_VAULT 50000000 \
  --rpc-url arbitrum --private-key $PRIVATE_KEY

# Approve WETH for shorting
cast send $NEXUS_VAULT "approveToken(address,bool)" \
  0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 true \
  --rpc-url arbitrum --private-key $PRIVATE_KEY

# Approve WBTC for shorting
cast send $NEXUS_VAULT "approveToken(address,bool)" \
  0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f true \
  --rpc-url arbitrum --private-key $PRIVATE_KEY
```

### 5. Start Blockchain Service

```bash
cd blockchain
npm run dev
```

Service will run on `http://localhost:8001`

### 6. Enable in Python Agent

Set in `.env`:

```
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_SERVICE_URL=http://localhost:8001
```

## Usage

### Execute Cross-Chain Short

```python
from agent.blockchain_integration import BlockchainIntegration

blockchain = BlockchainIntegration()

# Example: User has USDC on Base, wants to short WETH
result = blockchain.execute_cross_chain_short(
    index_token='WETH',          # Token to short
    collateral_usdc=20_000_000,  # 20 USDC collateral (6 decimals)
    leverage=2,                  # 2x leverage (conservative)
    source_chain='base',         # User's USDC is on Base
    destination_chain='arbitrum', # GMX is on Arbitrum
    confidence=85                # AI confidence score
)

print(f"Position ID: {result['positionId']}")
print(f"Bridge TX: {result['bridgeTx']}")  # LI.FI bridge
print(f"GMX Position Key: {result['gmxKey']}")
```

### Execute Direct Short (Already on Arbitrum)

```python
# If USDC already on Arbitrum, skip bridge
result = blockchain.execute_short(
    index_token='WBTC',
    collateral_usdc=10_000_000,  # 10 USDC
    leverage=3,                  # 3x leverage
    confidence=90
)

print(f"Position opened: {result['positionId']}")
print(f"TX: {result['txHash']}")
```

### Close Position

```python
# Close and keep profits on Arbitrum
result = blockchain.close_position(
    position_id=1,
    min_exit_price=2800_000_000_000_000_000_000_000_000_000,  # 30 decimals
    bridge_back=False
)

print(f"Position closed: {result['txHash']}")
print(f"P&L: ${result['pnl'] / 1e6} USDC")

# OR: Close and bridge profits back to Base
result = blockchain.close_position_and_bridge(
    position_id=1,
    min_exit_price=2800_000_000_000_000_000_000_000_000_000,
    destination_chain='base',
    recipient='0x...'  # User's wallet on Base
)

print(f"Profit bridged to Base: ${result['amount'] / 1e6} USDC")
```

### Get Performance Metrics

```python
metrics = blockchain.get_performance_metrics()
print(f"Win rate: {metrics['winRate']}%")
print(f"Total P&L: ${metrics['totalPnL'] / 1e6} USDC")
print(f"Total shorts: {metrics['totalPositions']}")
print(f"Avg profit: ${metrics['averagePnL'] / 1e6} USDC")
```

### Check Open Positions

```python
positions = blockchain.get_open_positions()
for pos in positions:
    print(f"Position {pos['id']}: {pos['indexToken']}")
    print(f"  Collateral: ${pos['collateralUSDC'] / 1e6} USDC")
    print(f"  Leverage: {pos['leverage']}x")
    print(f"  Entry Price: ${pos['entryPrice'] / 1e30}")

    # Get live P&L from GMX
    gmx_info = blockchain.get_gmx_position_info(pos['id'])
    print(f"  Unrealized P&L: ${gmx_info['delta'] / 1e30} {'profit' if gmx_info['hasProfit'] else 'loss'}")
```

## API Endpoints

### Blockchain Service (http://localhost:8001)

#### Publish Signals

```
POST /api/signals/publish
{
  "signals": [
    {
      "type": "REGULATORY_RISK",
      "urgency": 9,
      "chain": "arbitrum"
    }
  ]
}
```

#### Execute Short

```
POST /api/shorts/execute
{
  "tokenAddress": "0x...",
  "chain": "base",
  "amountUSDC": 20000000
}
```

#### Close Position

```
POST /api/shorts/close
{
  "positionId": 1,
  "tokenAddress": "0x...",
  "chain": "base",
  "sizeTokens": "1000000000000000000"
}
```

#### Get Metrics

```
GET /api/metrics
```

#### Get Open Positions

```
GET /api/positions/open
```

## Testing

Run the full integration demo:

```bash
python test_full_integration.py
```

This will:

1. Ingest social signals from Twitter
2. Screen with HuggingFace (Tier 1)
3. Analyze with Claude/Gemini (Tier 2)
4. Publish signals to SignalOracle
5. Execute shorts via NexusVault
6. Show on-chain performance metrics

## Security Notes

- **Testnet Only**: Start with Arbitrum Sepolia
- **Private Keys**: Never commit real private keys
- **Whitelist Tokens**: Only approved tokens can be shorted
- **Position Limits**: Max 20% of vault per position
- **Pause Function**: Emergency stop if needed

## Contract Addresses (Testnet)

After deployment, update these in `.env`:

```
NEXUS_VAULT_ADDRESS=0x... (deployed address)
SIGNAL_ORACLE_ADDRESS=0x... (deployed address)
POSITION_REGISTRY_ADDRESS=0x... (deployed address)
```

## Next Steps

1. **Deploy to Testnet**: Deploy contracts to Arbitrum Sepolia
2. **Fund Vault**: Send test USDC to NexusVault
3. **Approve Tokens**: Whitelist tokens for shorting
4. **Test Execution**: Run small test shorts
5. **Monitor**: Watch positions in dashboard
6. **Mainnet**: After thorough testing, deploy to mainnet

## Support

For issues or questions, check:

- LI.FI Docs: https://docs.li.fi/
- Arbitrum Docs: https://docs.arbitrum.io/
- Contract source: `/contracts/`
