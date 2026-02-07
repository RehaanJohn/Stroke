# GMX + LI.FI Integration - Contract Addresses

## Arbitrum Mainnet

### GMX Protocol

- **GMX Position Router**: `0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868`
- **GMX Vault**: `0x489ee077994B6658eAfA855C308275EAd8097C4A`
- **GMX Router**: `0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064`

### LI.FI

- **LI.FI Diamond**: `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`

### Tokens (Arbitrum)

- **USDC**: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- **WETH**: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- **WBTC**: `0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f`
- **ARB**: `0x912CE59144191C1204E64559FE8253a0e49E6548`

## Deployment Steps

1. **Deploy PositionRegistry** (no dependencies)
2. **Deploy SignalOracle** (no dependencies)
3. **Deploy PriceOracle** (implement with Chainlink)
4. **Deploy NexusVault** with:
   - USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
   - Agent address: (your wallet)
   - SignalOracle: (from step 2)
   - PositionRegistry: (from step 1)
   - PriceOracle: (from step 3)
   - GMX Position Router: `0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868`
   - GMX Vault: `0x489ee077994B6658eAfA855C308275EAd8097C4A`
   - LI.FI Diamond: `0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE`

## Environment Variables

Update `.env`:

```bash
# Arbitrum Mainnet
RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY

# GMX Contracts
GMX_POSITION_ROUTER=0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868
GMX_VAULT=0x489ee077994B6658eAfA855C308275EAd8097C4A

# LI.FI
LIFI_DIAMOND=0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE

# Deployed Contracts (after deployment)
NEXUS_VAULT_ADDRESS=0x...
SIGNAL_ORACLE_ADDRESS=0x...
POSITION_REGISTRY_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...

# Tokens
USDC_ADDRESS=0xaf88d065e77c8cC2239327C5EDb3A432268e5831
WETH_ADDRESS=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
WBTC_ADDRESS=0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f
```

## GMX Execution Fees

- Minimum execution fee: ~0.0001 ETH (~$0.20)
- Returned if position executes successfully
- Lost if position fails (e.g., slippage too high)

## Testing Commands

```bash
# Approve WETH for shorting
cast send $NEXUS_VAULT "approveToken(address,bool)" $WETH_ADDRESS true \
  --rpc-url arbitrum --private-key $PRIVATE_KEY

# Fund vault with USDC
cast send $USDC_ADDRESS "transfer(address,uint256)" $NEXUS_VAULT 50000000 \
  --rpc-url arbitrum --private-key $PRIVATE_KEY

# Check vault balance
cast call $USDC_ADDRESS "balanceOf(address)" $NEXUS_VAULT --rpc-url arbitrum
```
