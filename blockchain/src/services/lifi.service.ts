/**
 * LI.FI Service - Cross-chain USDC bridging for GMX execution
 * 
 * Architecture:
 * 1. Bridge IN: Any chain → Arbitrum (for GMX shorts)
 * 2. Bridge OUT: Arbitrum → Any chain (return profits)
 */

import { getRoutes, createConfig } from '@lifi/sdk';
import type { RoutesRequest, Route, ChainId } from '@lifi/sdk';

export class LiFiService {

  // Chain name to ID mapping
  private chainIds: Record<string, number> = {
    'arbitrum': 42161,
    'arbitrum-sepolia': 421614,
    'base': 8453,
    'optimism': 10,
    'polygon': 137,
    'ethereum': 1
  };

  // USDC addresses by chain
  private usdcAddresses: Record<string, string> = {
    'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'arbitrum': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'arbitrum-sepolia': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'optimism': '0x0b2C639c433813f4Aa9D7837CAf62653d097Ff85',
    'polygon': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  };

  constructor() {
    const isTestnet = process.env.NETWORK === 'arbitrum-sepolia' || process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';

    createConfig({
      integrator: 'nexus-autonomous-agent'
    });

    console.log(`📡 LiFiService: Initialized in ${isTestnet ? 'TESTNET' : 'MAINNET'} mode`);
  }

  /**
   * Get USDC address for a chain
   */
  getUSDCAddress(chain: string): string {
    const network = process.env.NETWORK || 'arbitrum';
    const isTestnet = network === 'arbitrum-sepolia' || process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';

    // If we are on testnet, use sepolia addresses for known chains
    if (isTestnet) {
      if (chain.toLowerCase() === 'arbitrum' || chain.toLowerCase() === 'arbitrum-sepolia') {
        return this.usdcAddresses['arbitrum-sepolia'];
      }
      // Add other testnet mappings as needed (e.g. base-sepolia)
    }

    const address = this.usdcAddresses[chain.toLowerCase()];
    if (!address) {
      throw new Error(`No USDC address for chain: ${chain}`);
    }
    return address;
  }

  /**
   * Get chain ID for a chain name
   */
  getChainId(chain: string): number {
    const network = process.env.NETWORK || 'arbitrum';
    const isTestnet = network === 'arbitrum-sepolia' || process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true';

    if (isTestnet && (chain.toLowerCase() === 'arbitrum' || chain.toLowerCase() === 'arbitrum-sepolia')) {
      return this.chainIds['arbitrum-sepolia'];
    }

    const id = this.chainIds[chain.toLowerCase()];
    if (!id) {
      throw new Error(`Unknown chain: ${chain}`);
    }
    return id;
  }

  /**
   * Get bridge route TO Arbitrum (for GMX execution)
   */
  async getShortRoute(params: {
    fromChain: string;
    toChain: string;
    tokenAddress: string;
    amountUSDC: string;
  }): Promise<Route> {
    const { fromChain, toChain, amountUSDC } = params;

    const nexusVaultAddress = process.env.NEXUS_VAULT_ADDRESS;
    if (!nexusVaultAddress) throw new Error('NEXUS_VAULT_ADDRESS not configured');

    const routesRequest: RoutesRequest = {
      fromChainId: this.getChainId(fromChain),
      toChainId: this.getChainId(toChain),
      fromTokenAddress: this.getUSDCAddress(fromChain),
      toTokenAddress: this.getUSDCAddress(toChain),
      fromAmount: amountUSDC,
      fromAddress: nexusVaultAddress, // Required for route calculation
      toAddress: nexusVaultAddress,
      options: {
        slippage: 0.01,
        order: 'FASTEST',
        allowSwitchChain: false
      }
    };

    console.log(`📡 LiFiService: Fetching route for ${amountUSDC} USDC from ${fromChain} to ${toChain}...`);
    const result = await getRoutes(routesRequest);
    if (!result.routes || result.routes.length === 0) {
      console.error('❌ LiFiService: No routes found', routesRequest);
      throw new Error(`No routes found from ${fromChain} to ${toChain}`);
    }

    console.log(`✅ LiFiService: Found ${result.routes.length} routes. Best bridge: ${result.routes[0].steps[0]?.toolDetails?.name}`);
    return result.routes[0];
  }

  /**
   * Get bridge route FROM Arbitrum (return profits)
   */
  async getCloseRoute(params: {
    fromChain: string;
    toChain: string;
    tokenAddress: string;
    sizeTokens: string;
  }): Promise<Route> {
    const { fromChain, toChain, sizeTokens } = params;

    const recipientAddress = process.env.AGENT_ADDRESS || process.env.DEPLOYER_ADDRESS;
    if (!recipientAddress) throw new Error('Recipient address not configured (AGENT_ADDRESS)');

    const routesRequest: RoutesRequest = {
      fromChainId: this.getChainId(fromChain),
      toChainId: this.getChainId(toChain),
      fromTokenAddress: this.getUSDCAddress(fromChain),
      toTokenAddress: this.getUSDCAddress(toChain),
      fromAmount: sizeTokens,
      fromAddress: recipientAddress,
      toAddress: recipientAddress,
      options: {
        slippage: 0.01,
        order: 'CHEAPEST',
        allowSwitchChain: false
      }
    };

    const result = await getRoutes(routesRequest);
    if (!result.routes || result.routes.length === 0) {
      throw new Error(`No routes found from ${fromChain} to ${toChain}`);
    }

    return result.routes[0];
  }
}
