/**
 * NEXUS Blockchain Integration Service
 * Bridges Python AI Agent → Smart Contracts
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { LiFiService } from './services/lifi.service';
import { ContractService } from './services/contract.service';
import { SignalPublisher } from './services/signal-publisher.service';

dotenv.config();

const app = express();
const PORT = process.env.BLOCKCHAIN_PORT || 8001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const lifiService = new LiFiService();
const contractService = new ContractService();
const signalPublisher = new SignalPublisher();

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'nexus-blockchain-integration' });
});

/**
 * Publish signals to SignalOracle
 * Called by Python agent when new signals detected
 */
app.post('/api/signals/publish', async (req, res) => {
  try {
    const { signals } = req.body;

    console.log(`📡 Publishing ${signals.length} signals to SignalOracle...`);

    const tx = await signalPublisher.publishBatch(signals);

    res.json({
      success: true,
      txHash: tx.hash,
      signalCount: signals.length
    });
  } catch (error: any) {
    console.error('❌ Signal publishing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute short position
 * Called by Python agent when confidence threshold met
 */
app.post('/api/shorts/execute', async (req, res) => {
  try {
    const {
      tokenAddress,
      chain,
      amountUSDC,
      fromChain = 'arbitrum' // Default source chain
    } = req.body;

    console.log(`\n🎯 EXECUTING SHORT`);
    console.log(`Token: ${tokenAddress}`);
    console.log(`Chain: ${chain}`);
    console.log(`Amount: ${amountUSDC / 1e6} USDC`);

    // Step 1: Get route from LI.FI
    console.log('🔄 Fetching route from LI.FI...');
    const route = await lifiService.getShortRoute({
      fromChain,
      toChain: chain,
      tokenAddress,
      amountUSDC
    });

    console.log(`✅ Route found: ${route.steps.length} steps`);
    console.log(`Estimated gas: ${route.gasCosts?.estimate || 'unknown'}`);

    // Step 2: Execute via NexusVault
    console.log('📝 Executing via NexusVault...');
    const tx = await contractService.executeShort({
      tokenAddress,
      chain,
      amountUSDC,
      lifiCalldata: route.transactionRequest.data,
      lifiDiamond: route.transactionRequest.to
    });

    console.log(`✅ Short executed! TX: ${tx.hash}`);
    console.log(`Position ID: ${tx.positionId}`);

    res.json({
      success: true,
      txHash: tx.hash,
      positionId: tx.positionId,
      route: {
        steps: route.steps.length,
        estimatedGas: route.gasCosts?.estimate
      }
    });
  } catch (error: any) {
    console.error('❌ Short execution failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Close short position
 * Called by Python agent when take-profit/stop-loss hit
 */
app.post('/api/shorts/close', async (req, res) => {
  try {
    const {
      positionId,
      tokenAddress,
      chain,
      sizeTokens,
      toChain = 'arbitrum'
    } = req.body;

    console.log(`\n🔄 CLOSING POSITION #${positionId}`);

    // Step 1: Get reverse route from LI.FI
    console.log('🔄 Fetching reverse route from LI.FI...');
    const route = await lifiService.getCloseRoute({
      fromChain: chain,
      toChain,
      tokenAddress,
      sizeTokens
    });

    // Step 2: Execute close via NexusVault
    console.log('📝 Closing position...');
    const tx = await contractService.closePosition({
      positionId,
      lifiCalldata: route.transactionRequest.data,
      lifiDiamond: route.transactionRequest.to
    });

    console.log(`✅ Position closed! TX: ${tx.hash}`);

    res.json({
      success: true,
      txHash: tx.hash,
      positionId,
      pnl: tx.pnl
    });
  } catch (error: any) {
    console.error('❌ Close failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get vault balance
 */
app.get('/api/vault/balance', async (req: Request, res: Response) => {
  try {
    const balance = await contractService.getVaultBalance();
    res.json({
      success: true,
      balanceUSDC: balance.toString()
    });
  } catch (error: any) {
    console.error('❌ Vault balance fetch failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get generic bridge quote
 * Called by Frontend or Agent to preview bridging costs
 */
app.post('/api/bridge/quote', async (req: Request, res: Response) => {
  try {
    const { fromChain, toChain, amountUSDC } = req.body;

    console.log(`\n🌉 FETCHING BRIDGE QUOTE: ${fromChain} → ${toChain} (${amountUSDC / 1e6} USDC)`);

    const route = await lifiService.getShortRoute({
      fromChain,
      toChain,
      tokenAddress: '', // Not used for simple bridge UI
      amountUSDC: amountUSDC.toString()
    });

    res.json({
      success: true,
      route: {
        steps: route.steps.length,
        fromAmount: route.fromAmount,
        toAmount: route.toAmount,
        gasCostUSD: route.gasCosts?.[0]?.amountUSD || '0',
        bridge: route.steps[0]?.toolDetails?.name || 'unknown'
      }
    });
  } catch (error: any) {
    console.error('❌ Bridge quote failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get performance metrics
 */
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await contractService.getPerformanceMetrics();

    res.json({
      success: true,
      metrics: {
        totalPositions: metrics.totalPositions.toString(),
        closedPositions: metrics.closedPositions.toString(),
        profitablePositions: metrics.profitablePositions.toString(),
        totalPnL: metrics.totalPnLUSDC.toString(),
        winRate: (metrics.winRatePercent / 100).toFixed(2) + '%',
        averagePnL: metrics.averagePnL.toString()
      }
    });
  } catch (error: any) {
    console.error('❌ Metrics fetch failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get open positions
 */
app.get('/api/positions/open', async (req, res) => {
  try {
    const positions = await contractService.getOpenPositions();

    res.json({
      success: true,
      count: positions.length,
      positions: positions.map(p => ({
        id: p.id.toString(),
        token: p.tokenAddress,
        chain: p.chain,
        entryPrice: p.entryPrice.toString(),
        sizeUSDC: p.sizeUSDC.toString(),
        confidence: p.confidenceScore
      }))
    });
  } catch (error: any) {
    console.error('❌ Positions fetch failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 NEXUS BLOCKCHAIN INTEGRATION SERVICE');
  console.log('='.repeat(60));
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔗 Network: ${process.env.NETWORK || 'arbitrum'}`);
  console.log(`📊 Vault: ${process.env.NEXUS_VAULT_ADDRESS || 'not configured'}`);
  console.log('='.repeat(60) + '\n');
});

export default app;
