/**
 * Signal Publisher Service - Publishes AI signals to SignalOracle
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

export interface Signal {
  signalType: number; // 0-11 (SignalType enum)
  tokenAddress: string;
  chain: string;
  score: number; // 0-100
  metadataHash: string; // IPFS hash
}

export class SignalPublisher {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private signalOracle: ethers.Contract;

  constructor() {
    const rpcUrl = process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('AGENT_PRIVATE_KEY not set');
    }

    this.signer = new ethers.Wallet(privateKey, this.provider);

    const oracleAddress = process.env.SIGNAL_ORACLE_ADDRESS;
    if (!oracleAddress) {
      throw new Error('SIGNAL_ORACLE_ADDRESS not configured');
    }

    const oracleABI = [
      'function publishSignalBatch(tuple(uint8,address,string,uint8,bytes32,address)[]) external'
    ];

    this.signalOracle = new ethers.Contract(oracleAddress, oracleABI, this.signer);
  }

  /**
   * Map signal type name to enum value
   */
  private getSignalTypeEnum(typeName: string): number {
    const typeMap: Record<string, number> = {
      'INSIDER_WALLET_DUMP': 0,
      'LIQUIDITY_REMOVAL': 1,
      'TWITTER_ENGAGEMENT_DROP': 2,
      'TWITTER_SENTIMENT_NEGATIVE': 3,
      'GOVERNANCE_BEARISH': 4,
      'GITHUB_COMMIT_DROP': 5,
      'DEVELOPER_EXODUS': 6,
      'WHALE_ALERT': 7,
      'REGULATORY_RISK': 8,
      'MACRO_EVENT': 9,
      'INSTITUTIONAL_MOVE': 10,
      'SENTIMENT_SHIFT': 11
    };

    return typeMap[typeName] ?? 8; // Default to REGULATORY_RISK
  }

  /**
   * Publish batch of signals to SignalOracle
   */
  async publishBatch(signals: any[]): Promise<{ hash: string }> {
    const publisherAddress = await this.signer.getAddress();

    // Convert agent signals to contract format
    const contractSignals = signals.map(s => ({
      signalType: this.getSignalTypeEnum(s.type || s.signal_type),
      tokenAddress: s.token || s.tokenAddress || ethers.ZeroAddress,
      chain: s.chain || 'arbitrum',
      score: Math.min(100, Math.floor(s.urgency * 10 || s.score || 50)),
      metadataHash: s.metadataHash || ethers.ZeroHash,
      publisher: publisherAddress
    }));

    console.log(`Publishing ${contractSignals.length} signals...`);

    const tx = await this.signalOracle.publishSignalBatch(contractSignals);
    const receipt = await tx.wait();

    console.log(`✅ Signals published: ${receipt.hash}`);

    return { hash: receipt.hash };
  }
}
