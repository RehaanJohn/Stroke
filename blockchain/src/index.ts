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

import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '../.env') });

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
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'nexus-blockchain-integration' });
});

/**
 * Publish signals to SignalOracle
 * Called by Python agent when new signals detected
 */
app.post('/api/signals/publish', async (req: Request, res: Response) => {
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
app.post('/api/shorts/execute', async (req: Request, res: Response) => {
  try {
    const {
      indexToken,
      tokenAddress,
      chain,
      collateralUSDC,
      amountUSDC,
      leverage,
      sourceChain,
      fromChain = 'arbitrum'
    } = req.body;

    // Support both agent and frontend param names
    const finalTokenAddress = tokenAddress || indexToken;
    const finalChain = chain || 'arbitrum';
    const finalAmount = amountUSDC || collateralUSDC;
    const finalFromChain = fromChain || sourceChain || 'arbitrum';

    console.log(`\n🎯 EXECUTING SHORT`);
    console.log(`Token: ${finalTokenAddress}`);
    console.log(`Chain: ${finalChain}`);
    console.log(`Amount: ${finalAmount / 1e6} USDC`);
    console.log(`Leverage: ${leverage}x`);

    // Step 1: Get route from LI.FI
    console.log('🔄 Fetching route from LI.FI...');
    const route = await lifiService.getShortRoute({
      fromChain: finalFromChain,
      toChain: finalChain,
      tokenAddress: finalTokenAddress,
      amountUSDC: finalAmount
    });

    console.log(`✅ Route found: ${route.steps.length} steps`);
    console.log(`Estimated gas: ${route.gasCostUSD || 'unknown'}`);

    // Step 2: Execute via NexusVault
    console.log('📝 Executing via NexusVault...');
    const tx = await contractService.executeShort({
      tokenAddress: finalTokenAddress,
      chain: finalChain,
      amountUSDC: finalAmount,
      lifiCalldata: route.steps[0]?.transactionRequest?.data || '',
      lifiDiamond: route.steps[0]?.transactionRequest?.to || ''
    });

    console.log(`✅ Short executed! TX: ${tx.hash}`);
    console.log(`Position ID: ${tx.positionId}`);

    res.json({
      success: true,
      txHash: tx.hash,
      positionId: tx.positionId,
      route: {
        steps: route.steps.length,
        estimatedGas: route.gasCostUSD
      }
    });
  } catch (error: any) {
    console.error('❌ Short execution failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute dip buy
 */
app.post('/api/dip-buys/execute', async (req: Request, res: Response) => {
  try {
    const {
      token,
      chain,
      amountUSDC,
      minTokensOut,
      takeProfitPrice,
      stopLossPrice
    } = req.body;

    console.log(`\n🎯 EXECUTING DIP BUY`);
    console.log(`Token: ${token}`);
    console.log(`Chain: ${chain}`);
    console.log(`Amount: ${amountUSDC / 1e6} USDC`);

    const result = await contractService.executeDipBuy({
      tokenAddress: token,
      chain,
      amountUSDC,
      minTokensOut,
      takeProfitPrice,
      stopLossPrice
    });

    res.json({
      success: true,
      txHash: result.hash,
      positionId: result.positionId
    });
  } catch (error: any) {
    console.error('❌ Dip buy failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Close short position
 * Called by Python agent when take-profit/stop-loss hit
 */
app.post('/api/shorts/close', async (req: Request, res: Response) => {
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
      lifiCalldata: route.steps[0]?.transactionRequest?.data || '',
      lifiDiamond: route.steps[0]?.transactionRequest?.to || ''
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
        gasCostUSD: route.gasCostUSD || '0',
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
app.get('/api/metrics', async (req: Request, res: Response) => {
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
app.get('/api/positions/open', async (req: Request, res: Response) => {
  try {
    const positions = await contractService.getOpenPositions();

    res.json({
      success: true,
      count: positions.length,
      positions: positions.map((p: any) => ({
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
