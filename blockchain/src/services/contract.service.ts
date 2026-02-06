/**
 * Contract Service - Interact with NexusVault, SignalOracle, PositionRegistry
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  
  private nexusVault: ethers.Contract;
  private positionRegistry: ethers.Contract;
  
  constructor() {
    // Initialize provider and signer
    const rpcUrl = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const privateKey = process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('AGENT_PRIVATE_KEY not set in .env');
    }
    
    this.signer = new ethers.Wallet(privateKey, this.provider);
    
    // Initialize contract instances
    const vaultAddress = process.env.NEXUS_VAULT_ADDRESS;
    const registryAddress = process.env.POSITION_REGISTRY_ADDRESS;
    
    if (!vaultAddress || !registryAddress) {
      throw new Error('Contract addresses not configured in .env');
    }
    
    // Load ABIs (simplified - in production load from files)
    const vaultABI = [
      'function executeShort(address,string,uint256,bytes,address) external returns (uint256)',
      'function closePosition(uint256,bytes,address) external',
      'function getOpenPositions() external view returns (tuple(uint256,address,string,uint256,uint256,uint256,uint256,bool)[])'
    ];
    
    const registryABI = [
      'function getPerformanceMetrics() external view returns (tuple(uint256,uint256,uint256,int256,uint256,uint16,int256,int256,int256))',
      'function getOpenPositions() external view returns (tuple[])'
    ];
    
    this.nexusVault = new ethers.Contract(vaultAddress, vaultABI, this.signer);
    this.positionRegistry = new ethers.Contract(registryAddress, registryABI, this.provider);
  }
  
  /**
   * Execute short via NexusVault
   */
  async executeShort(params: {
    tokenAddress: string;
    chain: string;
    amountUSDC: number;
    lifiCalldata: string;
    lifiDiamond: string;
  }) {
    const { tokenAddress, chain, amountUSDC, lifiCalldata, lifiDiamond } = params;
    
    const tx = await this.nexusVault.executeShort(
      tokenAddress,
      chain,
      amountUSDC,
      lifiCalldata,
      lifiDiamond
    );
    
    const receipt = await tx.wait();
    
    // Parse event to get position ID
    const event = receipt.logs.find((log: any) => 
      log.topics[0] === ethers.id('ShortExecuted(uint256,address,string,uint256,uint256,uint16)')
    );
    
    const positionId = event ? ethers.toBigInt(event.topics[1]) : 0n;
    
    return {
      hash: receipt.hash,
      positionId: positionId.toString()
    };
  }
  
  /**
   * Close position via NexusVault
   */
  async closePosition(params: {
    positionId: number;
    lifiCalldata: string;
    lifiDiamond: string;
  }) {
    const { positionId, lifiCalldata, lifiDiamond } = params;
    
    const tx = await this.nexusVault.closePosition(
      positionId,
      lifiCalldata,
      lifiDiamond
    );
    
    const receipt = await tx.wait();
    
    // Parse event to get P&L
    const event = receipt.logs.find((log: any) => 
      log.topics[0] === ethers.id('PositionClosed(uint256,uint256,int256)')
    );
    
    const pnl = event ? ethers.toBigInt(event.data) : 0n;
    
    return {
      hash: receipt.hash,
      pnl: pnl.toString()
    };
  }
  
  /**
   * Get performance metrics from PositionRegistry
   */
  async getPerformanceMetrics() {
    return await this.positionRegistry.getPerformanceMetrics();
  }
  
  /**
   * Get open positions
   */
  async getOpenPositions() {
    return await this.nexusVault.getOpenPositions();
  }
}
