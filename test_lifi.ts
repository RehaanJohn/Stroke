
import { LiFiService } from './blockchain/src/services/lifi.service.ts';
import * as dotenv from 'dotenv';
import { formatUnits } from 'viem';

dotenv.config();

async function testLiFi() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 NEXUS LI.FI INTEGRATION TEST');
    console.log('='.repeat(60));

    const lifi = new LiFiService();

    // Test 0: Fetch route Base → Optimism (Mainnet Baseline)
    console.log('\n🔵 TEST 0: Bridging Base → Optimism (Mainnet Baseline)');
    const mainnetParams = {
        fromChain: 'base',
        toChain: 'optimism',
        tokenAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        amountUSDC: '1000000'
    };

    try {
        console.log(`📡 Requesting route: ${mainnetParams.amountUSDC} USDC from ${mainnetParams.fromChain}...`);
        const route = await lifi.getShortRoute(mainnetParams);
        console.log('✅ Mainnet Route found!');
        console.log(`   Bridge: ${route.steps[0]?.toolDetails?.name || 'unknown'}`);
    } catch (error: any) {
        console.error('❌ Test 0 Failed:', error.message);
    }

    // Test 1: Fetch route to Arbitrum-Sepolia (Open Position)
    console.log('\n➡️ TEST 1: Bridging Base → Arbitrum Sepolia (Open)');
    const openParams = {
        fromChain: 'base',
        toChain: 'arbitrum-sepolia',
        tokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH (for shorting)
        amountUSDC: '1000000' // 1 USDC
    };

    try {
        console.log(`📡 Requesting route: ${openParams.amountUSDC} USDC from ${openParams.fromChain}...`);
        const route = await lifi.getShortRoute(openParams);

        console.log('✅ Route found!');
        console.log(`   Bridge: ${route.steps[0]?.toolDetails?.name || 'unknown'}`);
        console.log(`   Est. Arrival: ${route.steps[0]?.estimate?.executionDuration || 0}s`);
        console.log(`   Destination Receiver: ${route.transactionRequest?.to ? 'NexusVault (Check)' : 'missing'}`);

    } catch (error: any) {
        console.error('❌ Test 1 Failed:', error.message);
    }

    // Test 2: Fetch route from Arbitrum-Sepolia (Close Position)
    console.log('\n⬅️ TEST 2: Bridging Arbitrum Sepolia → Optimism (Close)');
    const closeParams = {
        fromChain: 'arbitrum-sepolia',
        toChain: 'optimism',
        tokenAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        sizeTokens: '1000000' // 1 USDC profit
    };

    try {
        console.log(`📡 Requesting route: ${closeParams.sizeTokens} USDC to ${closeParams.toChain}...`);
        const route = await lifi.getCloseRoute(closeParams);

        console.log('✅ Route found!');
        console.log(`   Bridge: ${route.steps[0]?.toolDetails?.name || 'unknown'}`);
        console.log(`   Recipient: ${route.transactionRequest?.to ? 'Agent/Treasury (Check)' : 'missing'}`);

    } catch (error: any) {
        console.error('❌ Test 2 Failed:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 TEST COMPLETE');
    console.log('='.repeat(60) + '\n');
}

testLiFi();
