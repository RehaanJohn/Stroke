/**
 * LI.FI Service - Cross-chain USDC bridging for GMX execution
 * 
 * Architecture:
 * 1. Bridge IN: Any chain → Arbitrum (for GMX shorts)
 * 2. Bridge OUT: Arbitrum → Any chain (return profits)
 */

import { LiFi, RoutesRequest, Route } from '@lifi/sdk';
import { ChainId } from '@lifi/types';

export class LiFiService {
  private lifi: LiFi;
  
  // Chain name to ID mapping
  private chainIds: Record<string, ChainId> = {
    'arbitrum': 42161,
    'base': 8453,
    'optimism': 10,
    'polygon': 137,
    'ethereum': 1
  };
  
  // USDC addresses by chain
  private usdcAddresses: Record<string, string> = {
    'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    'arbitrum': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    'optimism': '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    'polygon': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  };
  
  constructor() {
    this.lifi = new LiFi({
      integrator: 'nexus-autonomous-agent'
    });
  }
  
  /**
   * Get bridge route TO Arbitrum (for GMX execution)
   * @param fromChain Source chain where user has USDC
   * @param amountUSDC Amount in USDC (6 decimals)
   * @param nexusVaultAddress NexusVault contract address on Arbitrum
   */
  async getBridgeToArbitrumRoute(params: {
    fromChain: string;
    amountUSDC: string;
    nexusVaultAddress: string;
  }): Promise<Route> {
    const { fromChain, amountUSDC, nexusVaultAddress } = params;
    
    if (fromChain.toLowerCase() === 'arbitrum') {
      throw new Error('Already on Arbitrum, no bridge needed');
    }
    
    const routesRequest: RoutesRequest = {
      fromChainId: this.chainIds[fromChain],
      toChainId: this.chainIds['arbitrum'],
      fromTokenAddress: this.getUSDCAddress(fromChain),
      toTokenAddress: this.getUSDCAddress('arbitrum'),
      fromAmount: amountUSDC,
      toAddress: nexusVaultAddress, // Receive on NexusVault
      options: {
        slippage: 0.01, // 1% slippage
        order: 'FASTEST', // Speed is critical for shorts
        allowSwitchChain: false
      }
    };
    
    const result = await this.lifi.getRoutes(routesRequest);
    
    if (!result.routes || result.routes.length === 0) {
      throw new Error(`No routes found from ${fromChain} to Arbitrum`);
    }
    
    return result.routes[0];
  }
  
  /**
   * Get bridge route FROM Arbitrum (return profits)
   * @param toChain Destination chain for user's profits
   * @param amountUSDC Profit amount in USDC (6 decimals)
   * @param recipientAddress User's address on destination chain
   */
  async getBridgeFromArbitrumRoute(params: {
    toChain: string;
    amountUSDC: string;
    recipientAddress: string;
  }): Promise<Route> {
    const { toChain, amountUSDC, recipientAddress } = params;
    
    if (toChain.toLowerCase() === 'arbitrum') {
      throw new Error('Already on Arbitrum, no bridge needed');
    }
    
    const routesRequest: RoutesRequest = {
      fromChainId: this.chainIds['arbitrum'],
      toChainId: this.chainIds[toChain],
      fromTokenAddress: this.getUSDCAddress('arbitrum'),
      toTokenAddress: this.getUSDCAddress(toChain),
      fromAmount: amountUSDC,
      toAddress: recipientAddress,
      options: {
        slippage: 0.01,
        order: 'CHEAPEST', // Cheapest for returning profits
        allowSwitchChain: false
      }
    };
    
    const result = await this.lifi.getRoutes(routesRequest);
    
    if (!result.routes || result.routes.length === 0) {
      throw new Error(`No routes found from Arbitrum to ${toChain}`);
    }
    
    return result.routes[0];
  }
  
  /**
   * Get USDC address for a chain
   */
  getUSDCAddress(chain: string): string {
    const address = this.usdcAddresses[chain.toLowerCase()];
    if (!address) {
      throw new Error(`No USDC address for chain: ${chain}`);
    }
    return address;
  }
  
  /**
   * Get chain ID for a chain name
   */
  getChainId(chain: string): ChainId {
    const id = this.chainIds[chain.toLowerCase()];
    if (!id) {
      throw new Error(`Unknown chain: ${chain}`);
    }
    return id;
  }
}
