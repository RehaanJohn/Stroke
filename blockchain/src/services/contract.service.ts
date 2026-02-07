/**
 * Contract Service - Interact with NexusVault, SignalOracle, PositionRegistry
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

export class ContractService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;

  private nexusVault: ethers.Contract;
  private positionRegistry: ethers.Contract;
  private usdc: ethers.Contract;

  private readonly USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Arbitrum USDC

  constructor() {
    // Initialize provider and signer
    const rpcUrl = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc';
    console.log(`📡 ContractService: Initializing with RPC: ${rpcUrl}`);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) {
      console.error('❌ ContractService: AGENT_PRIVATE_KEY not set in .env');
      throw new Error('AGENT_PRIVATE_KEY not set in .env');
    }

    this.signer = new ethers.Wallet(privateKey, this.provider);

    // Initialize contract instances
    const vaultAddress = process.env.NEXUS_VAULT_ADDRESS;
    const registryAddress = process.env.POSITION_REGISTRY_ADDRESS;

    if (!vaultAddress || !registryAddress) {
      console.error('❌ ContractService: Contract addresses missing in .env', { vaultAddress, registryAddress });
      throw new Error('Contract addresses not configured in .env');
    }

    console.log(`📝 ContractService: NexusVault at ${vaultAddress}`);
    console.log(`📝 ContractService: PositionRegistry at ${registryAddress}`);

    // Load ABIs (simplified - in production load from files)
    const vaultABI = [
      'function executeShort(address,string,uint256,bytes,address) external returns (uint256)',
      'function executeDipBuy(address,string,uint256,uint256,uint256,uint256) external returns (uint256)',
      'function closePosition(uint256,bytes,address) external',
      'function getOpenPositions() external view returns (tuple(uint256,address,string,uint256,uint256,uint256,uint256,bool)[])',
      'function getVaultValue() external view returns (uint256)'
    ];

    const usdcABI = [
      'function balanceOf(address) external view returns (uint256)'
    ];

    const registryABI = [
      'function getPerformanceMetrics() external view returns (tuple(uint256,uint256,uint256,int256,uint256,uint16,int256,int256,int256))',
      'function getOpenPositions() external view returns (tuple[])'
    ];

    this.nexusVault = new ethers.Contract(vaultAddress, vaultABI, this.signer);
    this.positionRegistry = new ethers.Contract(registryAddress, registryABI, this.provider);
    this.usdc = new ethers.Contract(this.USDC_ADDRESS, usdcABI, this.provider);
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
   * Get vault USDC balance
   */
  async getVaultBalance() {
    return await this.usdc.balanceOf(await this.nexusVault.getAddress());
  }

  /**
   * Execute dip buy via NexusVault
   */
  async executeDipBuy(params: {
    tokenAddress: string;
    chain: string;
    amountUSDC: number;
    minTokensOut: number;
    takeProfitPrice: number;
    stopLossPrice: number;
  }) {
    const { tokenAddress, chain, amountUSDC, minTokensOut, takeProfitPrice, stopLossPrice } = params;

    // Helper to avoid underflow if price has >18 decimals
    const formatPrice = (p: number) => {
      const s = p.toFixed(18);
      return ethers.parseUnits(s, 18);
    };

    // Convert prices to contract precision if needed
    // In production, handles decimal conversion based on token decimals
    const tx = await this.nexusVault.executeDipBuy(
      tokenAddress,
      chain,
      amountUSDC,
      minTokensOut || 0,
      formatPrice(takeProfitPrice),
      formatPrice(stopLossPrice)
    );

    const receipt = await tx.wait();

    // Parse event to get position ID
    const event = receipt.logs.find((log: any) =>
      log.topics[0] === ethers.id('DipBuyInitiated(uint256,address,string,uint256)')
    );

    const positionId = event ? ethers.toBigInt(event.topics[1]) : 0n;

    return {
      hash: receipt.hash,
      positionId: positionId.toString()
    };
  }

  async getOpenPositions() {
    return await this.nexusVault.getOpenPositions();
  }
}
