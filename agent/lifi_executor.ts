/**
 * LI.FI SDK Integration for NEXUS
 * 
 * This module provides a TypeScript interface to LI.FI's cross-chain bridge aggregator.
 * It handles route requests, quote validation, and execution of cross-chain bridges.
 * 
 * Key Features:
 * - Multi-chain support (Arbitrum, Base, Optimism, Polygon, etc.)
 * - Automatic best route selection
 * - Route monitoring with status updates
 * - Gas estimation and fee calculation
 */

import { createConfig, getRoutes, executeRoute, getStatus } from '@lifi/sdk';
import { createWalletClient, createPublicClient, http, Address } from 'viem';
import { arbitrum, base, optimism, polygon, mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Chain ID mapping
const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  arbitrum: 42161,
  base: 8453,
  optimism: 10,
  polygon: 137,
};

// USDC addresses per chain
const USDC_ADDRESSES: Record<number, Address> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism
  137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',    // Polygon
};

interface LiFiRoute {
  id: string;
  fromChainId: number;
  toChainId: number;
  fromAmountUSD: string;
  toAmountUSD: string;
  fromAmount: string;
  toAmount: string;
  toAmountMin: string;
  steps: any[];
  gasCostUSD?: string;
  insurance?: {
    state: string;
    feeAmountUsd: string;
  };
}

interface BridgeResult {
  transactionHash: string;
  status: 'PENDING' | 'DONE' | 'FAILED';
  sending: {
    txHash: string;
    chainId: number;
    amount: string;
  };
  receiving?: {
    txHash: string;
    chainId: number;
    amount: string;
  };
}

export class LiFiExecutor {
  private walletClient: any;
  private publicClient: any;
  private account: any;

  constructor(privateKey: string) {
    // Initialize LI.FI SDK
    createConfig({
      integrator: 'NEXUS-AI-Agent',
      rpcUrls: {
        [arbitrum.id]: [process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc'],
        [base.id]: [process.env.BASE_RPC || 'https://mainnet.base.org'],
        [optimism.id]: [process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io'],
        [polygon.id]: [process.env.POLYGON_RPC || 'https://polygon-rpc.com'],
        [mainnet.id]: [process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com'],
      },
    });

    // Setup wallet
    this.account = privateKeyToAccount(`0x${privateKey}` as `0x${string}`);
    
    this.walletClient = createWalletClient({
      account: this.account,
      chain: arbitrum,
      transport: http(),
    });

    this.publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(),
    });
  }

  /**
   * Request bridge route from LI.FI
   * 
   * @param fromChain Source chain name (e.g., "base")
   * @param toChain Destination chain name (e.g., "arbitrum")
   * @param amount USDC amount (6 decimals)
   * @param userAddress Address initiating the bridge
   * @returns Best route with quotes and fee breakdown
   */
  async getBestRoute(
    fromChain: string,
    toChain: string,
    amount: string,
    userAddress: string
  ): Promise<LiFiRoute> {
    const fromChainId = CHAIN_IDS[fromChain.toLowerCase()];
    const toChainId = CHAIN_IDS[toChain.toLowerCase()];

    if (!fromChainId || !toChainId) {
      throw new Error(`Unsupported chain: ${fromChain} or ${toChain}`);
    }

    console.log(`🔍 Requesting LI.FI route: ${fromChain} → ${toChain}`);
    console.log(`   Amount: ${amount} USDC`);

    const routesRequest = {
      fromChainId,
      toChainId,
      fromTokenAddress: USDC_ADDRESSES[fromChainId],
      toTokenAddress: USDC_ADDRESSES[toChainId],
      fromAmount: amount,
      fromAddress: userAddress,
      toAddress: userAddress,
      options: {
        slippage: 0.005, // 0.5% slippage
        order: 'RECOMMENDED', // Best route by LI.FI
        allowSwitchChain: false,
      },
    };

    const result = await getRoutes(routesRequest);
    
    if (!result.routes || result.routes.length === 0) {
      throw new Error('No routes found');
    }

    const bestRoute = result.routes[0];

    console.log(`✅ Route found:`);
    console.log(`   Bridge: ${bestRoute.steps[0]?.toolDetails?.name || 'Unknown'}`);
    console.log(`   Est. output: ${bestRoute.toAmountUSD} USD`);
    console.log(`   Gas cost: ${bestRoute.gasCostUSD || '0'} USD`);
    console.log(`   Time: ~${bestRoute.steps[0]?.estimate?.executionDuration || 0}s`);

    return bestRoute as LiFiRoute;
  }

  /**
   * Execute cross-chain bridge via LI.FI
   * 
   * @param route LI.FI route from getBestRoute()
   * @returns Bridge result with transaction hashes
   */
  async executeBridge(route: LiFiRoute): Promise<BridgeResult> {
    console.log(`⚡ Executing LI.FI bridge...`);
    console.log(`   Route ID: ${route.id}`);

    // Execute route with monitoring
    const executionResult = await executeRoute(route, {
      updateRouteHook: (updatedRoute) => {
        const currentStep = updatedRoute.steps.find((step: any) => step.execution);
        if (currentStep) {
          console.log(`   Step: ${currentStep.toolDetails?.name || 'Unknown'}`);
          console.log(`   Status: ${currentStep.execution?.status}`);
        }
      },
    });

    // Wait for bridge completion
    let status = await getStatus({
      txHash: executionResult.steps[0].execution?.process[0]?.txHash || '',
      bridge: route.steps[0].toolDetails?.name || '',
      fromChain: route.fromChainId,
      toChain: route.toChainId,
    });

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (status.status !== 'DONE' && status.status !== 'FAILED' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      status = await getStatus({
        txHash: executionResult.steps[0].execution?.process[0]?.txHash || '',
        bridge: route.steps[0].toolDetails?.name || '',
        fromChain: route.fromChainId,
        toChain: route.toChainId,
      });
      attempts++;
      
      if (attempts % 6 === 0) {
        console.log(`   Still pending... (${attempts * 5}s elapsed)`);
      }
    }

    if (status.status === 'FAILED') {
      throw new Error('Bridge failed');
    }

    if (status.status !== 'DONE') {
      throw new Error('Bridge timeout');
    }

    console.log(`✅ Bridge completed!`);
    console.log(`   Sending TX: ${status.sending?.txHash}`);
    console.log(`   Receiving TX: ${status.receiving?.txHash}`);

    return {
      transactionHash: status.sending?.txHash || '',
      status: status.status,
      sending: {
        txHash: status.sending?.txHash || '',
        chainId: route.fromChainId,
        amount: status.sending?.amount || '0',
      },
      receiving: status.receiving ? {
        txHash: status.receiving.txHash || '',
        chainId: route.toChainId,
        amount: status.receiving.amount || '0',
      } : undefined,
    };
  }

  /**
   * Full flow: Get route and execute bridge
   * 
   * @param fromChain Source chain
   * @param toChain Destination chain (usually "arbitrum" for GMX)
   * @param amount USDC amount (6 decimals)
   * @param userAddress User address
   * @returns Bridge result with transaction details
   */
  async bridgeToGMX(
    fromChain: string,
    toChain: string = 'arbitrum',
    amount: string,
    userAddress: string
  ): Promise<BridgeResult> {
    // 1. Request route
    const route = await this.getBestRoute(fromChain, toChain, amount, userAddress);

    // 2. Validate route
    if (!route || !route.toAmount || route.toAmount === '0') {
      throw new Error('Invalid route: zero output');
    }

    // 3. Check slippage
    const outputUSD = parseFloat(route.toAmountUSD);
    const inputUSD = parseFloat(route.fromAmountUSD);
    const slippage = ((inputUSD - outputUSD) / inputUSD) * 100;

    if (slippage > 1.0) {
      throw new Error(`Slippage too high: ${slippage.toFixed(2)}%`);
    }

    console.log(`   Slippage: ${slippage.toFixed(3)}%`);

    // 4. Execute bridge
    const result = await this.executeBridge(route);

    return result;
  }

  /**
   * Prepare LiFiBridgeData struct for NexusVault contract
   * 
   * @param route LI.FI route
   * @returns Structured bridge data for Solidity contract
   */
  prepareBridgeData(route: LiFiRoute): any {
    return {
      transactionId: route.id,
      bridge: route.steps[0]?.toolDetails?.name || 'stargate',
      receiver: this.account.address,
      destinationChainId: route.toChainId,
      minAmount: route.toAmountMin,
    };
  }

  /**
   * Get chain ID from name
   */
  getChainId(chain: string): number {
    const chainId = CHAIN_IDS[chain.toLowerCase()];
    if (!chainId) {
      throw new Error(`Unknown chain: ${chain}`);
    }
    return chainId;
  }
}

// Example usage
if (require.main === module) {
  (async () => {
    const executor = new LiFiExecutor(process.env.AGENT_PRIVATE_KEY || '');
    
    try {
      // Test bridge from Base to Arbitrum
      const result = await executor.bridgeToGMX(
        'base',
        'arbitrum',
        '1000000', // 1 USDC (6 decimals)
        executor.account.address
      );
      
      console.log('\n✅ Bridge successful:', result);
    } catch (error) {
      console.error('❌ Bridge failed:', error);
    }
  })();
}

export default LiFiExecutor;
