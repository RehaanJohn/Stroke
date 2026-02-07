module.exports = async ({ getNamedAccounts, deployments, network }) => {
  const { deploy, get } = deployments;
  const { deployer, agent } = await getNamedAccounts();

  console.log("====================================");
  console.log("Deploying NexusVault...");
  console.log("====================================");

  // Get previously deployed contracts
  const positionRegistry = await get("PositionRegistry");
  const signalOracle = await get("SignalOracle");

  // Arbitrum addresses
  let USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Arbitrum One
  let GMX_POSITION_ROUTER = "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868";
  let GMX_VAULT = "0x489ee077994B6658eAfA855C308275EAd8097C4A";

  if (network.name === "arbitrumSepolia") {
    USDC = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"; // Arbitrum Sepolia
    console.log("Deploying MockGMX for Testnet...");
    const mockGMX = await deploy("MockGMX", {
      from: deployer,
      args: [],
      log: true,
    });
    GMX_POSITION_ROUTER = mockGMX.address;
    GMX_VAULT = mockGMX.address;
    console.log(`✅ MockGMX deployed to: ${mockGMX.address}`);
  }

  // For testnet/localhost, we'll use mock addresses
  const isMainnet = network.name === "arbitrum";
  const agentAddress = agent || deployer;

  // Deploy a simple price oracle (for demo - in production use Chainlink)
  const priceOracle = await deploy("MockPriceOracle", {
    from: deployer,
    args: [],
    log: true,
    contract: {
      abi: [
        "function getPrice(address tokenAddress, string calldata chain) external view returns (uint256)",
      ],
      bytecode: "0x608060405234801561001057600080fd5b5061014d806100206000396000f3fe608060405234801561001057600080fd5b506004361061002b5760003560e01c8063b3596f0714610030575b600080fd5b61004361003e366004610091565b610055565b60405190815260200160405180910390f35b60006b033b2e3c9fd0803ce800000092915050565b634e487b7160e01b600052604160045260246000fd5b60008060006060848603121561009b57600080fd5b833573ffffffffffffffffffffffffffffffffffffffff811681146100bf57600080fd5b9250602084013567ffffffffffffffff8111156100db57600080fd5b8401601f810186136100ec57600080fd5b803567ffffffffffffffff81111561010657610106610069565b604051601f8201601f19908116603f0116810167ffffffffffffffff8111828210171561013557610135610069565b60405281815282820160200188101561014d57600080fd5b9695505050505050565b56fea2646970667358221220",
    },
  });

  const nexusVault = await deploy("NexusVault", {
    from: deployer,
    args: [
      USDC,
      agentAddress,
      signalOracle.address,
      positionRegistry.address,
      priceOracle.address,
      GMX_POSITION_ROUTER,
      GMX_VAULT,
    ],
    log: true,
    waitConfirmations: 1,
  });

  console.log(`✅ NexusVault deployed to: ${nexusVault.address}`);
  console.log(`   Agent address: ${agentAddress}`);
  console.log(`   SignalOracle: ${signalOracle.address}`);
  console.log(`   PositionRegistry: ${positionRegistry.address}`);

  // Update PositionRegistry with vault address
  console.log("\nUpdating PositionRegistry with vault address...");
  const PositionRegistry = await ethers.getContractAt(
    "PositionRegistry",
    positionRegistry.address
  );
  const setVaultTx = await PositionRegistry.setNexusVault(nexusVault.address);
  await setVaultTx.wait();
  console.log("✅ PositionRegistry updated");

  // Update SignalOracle with vault address
  console.log("\nUpdating SignalOracle with vault address...");
  const SignalOracle = await ethers.getContractAt(
    "SignalOracle",
    signalOracle.address
  );
  const setVaultTx2 = await SignalOracle.setNexusVault(nexusVault.address);
  await setVaultTx2.wait();
  console.log("✅ SignalOracle updated");

  // Approve tokens for shorting
  console.log("\nApproving tokens for shorting...");
  const Vault = await ethers.getContractAt("NexusVault", nexusVault.address);

  const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";

  await (await Vault.approveToken(WETH, true)).wait();
  console.log(`✅ WETH approved for shorting`);

  await (await Vault.approveToken(WBTC, true)).wait();
  console.log(`✅ WBTC approved for shorting`);

  console.log("\n====================================");
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("====================================");
  console.log(`NexusVault: ${nexusVault.address}`);
  console.log(`SignalOracle: ${signalOracle.address}`);
  console.log(`PositionRegistry: ${positionRegistry.address}`);
  console.log("\nAdd these to your .env file:");
  console.log(`NEXUS_VAULT_ADDRESS=${nexusVault.address}`);
  console.log(`SIGNAL_ORACLE_ADDRESS=${signalOracle.address}`);
  console.log(`POSITION_REGISTRY_ADDRESS=${positionRegistry.address}`);
};

module.exports.tags = ["NexusVault", "all"];
module.exports.dependencies = ["PositionRegistry", "SignalOracle"];
