#!/usr/bin/env node

/**
 * Quick Deploy Script for NEXUS Contracts
 * 
 * Deploys contracts to Arbitrum and updates .env with addresses
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🚀 NEXUS Contract Deployment');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // Check for .env
  if (!fs.existsSync('.env')) {
    console.error('❌ Error: .env file not found');
    process.exit(1);
  }

  // Load .env
  require('dotenv').config();

  // Check for private key
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    console.error('❌ Error: DEPLOYER_PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  RPC: ${process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc'}`);
  console.log(`  Deployer: 0x${process.env.DEPLOYER_PRIVATE_KEY.slice(0, 8)}...`);
  console.log('');

  // Check if already deployed
  if (process.env.NEXUS_VAULT_ADDRESS) {
    console.log('⚠️  Contracts already deployed:');
    console.log(`  NexusVault: ${process.env.NEXUS_VAULT_ADDRESS}`);
    console.log('');
    const answer = await question('Deploy again? This will create new contracts. (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      console.log('Deployment cancelled.');
      rl.close();
      return;
    }
  }

  // Choose network
  console.log('Select network:');
  console.log('  1. Arbitrum Mainnet (real funds)');
  console.log('  2. Arbitrum Sepolia (testnet)');
  console.log('  3. Local Hardhat (fork)');
  console.log('');

  const network = await question('Enter choice (1-3): ');
  console.log('');

  let networkName;
  if (network === '1') {
    networkName = 'arbitrum';
    console.log('⚠️  WARNING: Deploying to MAINNET with REAL FUNDS!');
    const confirm = await question('Are you sure? Type "yes" to continue: ');
    if (confirm !== 'yes') {
      console.log('Deployment cancelled.');
      rl.close();
      return;
    }
  } else if (network === '2') {
    networkName = 'arbitrumSepolia';
  } else {
    networkName = 'hardhat';
  }

  console.log('');
  console.log(`📡 Deploying to ${networkName}...`);
  console.log('');

  // Run deployment
  return new Promise((resolve, reject) => {
    const deployProcess = exec(`npx hardhat deploy --network ${networkName}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Deployment failed: ${error.message}`);
        reject(error);
        return;
      }

      console.log(stdout);

      // Extract addresses from output
      const vaultMatch = stdout.match(/NEXUS_VAULT_ADDRESS=([0-9a-fx]+)/i);
      const oracleMatch = stdout.match(/SIGNAL_ORACLE_ADDRESS=([0-9a-fx]+)/i);
      const registryMatch = stdout.match(/POSITION_REGISTRY_ADDRESS=([0-9a-fx]+)/i);

      if (vaultMatch && oracleMatch && registryMatch) {
        const addresses = {
          NEXUS_VAULT_ADDRESS: vaultMatch[1],
          SIGNAL_ORACLE_ADDRESS: oracleMatch[1],
          POSITION_REGISTRY_ADDRESS: registryMatch[1],
        };

        console.log('');
        console.log('✅ Deployment successful!');
        console.log('');
        console.log('Contract Addresses:');
        console.log(`  NexusVault: ${addresses.NEXUS_VAULT_ADDRESS}`);
        console.log(`  SignalOracle: ${addresses.SIGNAL_ORACLE_ADDRESS}`);
        console.log(`  PositionRegistry: ${addresses.POSITION_REGISTRY_ADDRESS}`);
        console.log('');

        // Update .env
        updateEnvFile(addresses);

        console.log('✅ .env file updated with contract addresses');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Fund the vault with USDC');
        console.log(`     Vault address: ${addresses.NEXUS_VAULT_ADDRESS}`);
        console.log('  2. Start the AI agent: python3 run_nexus.py');
        console.log('  3. Start the web app: npm run dev');
        console.log('');
      }

      rl.close();
      resolve();
    });

    // Show deployment progress
    deployProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    deployProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

function updateEnvFile(addresses) {
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Update or add addresses
  for (const [key, value] of Object.entries(addresses)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    const publicKey = `NEXT_PUBLIC_${key}`;
    const publicRegex = new RegExp(`^${publicKey}=.*$`, 'm');

    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }

    // Also update NEXT_PUBLIC_ versions
    if (publicRegex.test(envContent)) {
      envContent = envContent.replace(publicRegex, `${publicKey}=${value}`);
    } else {
      envContent += `\n${publicKey}=${value}`;
    }
  }

  fs.writeFileSync(envPath, envContent);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
