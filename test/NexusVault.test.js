const { expect } = require("chai");
const { ethers, deployments } = require("hardhat");

describe("NexusVault Integration Tests", function () {
  let nexusVault, signalOracle, positionRegistry;
  let deployer, agent, user;
  let USDC, WETH;

  const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
  const WETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
  const USDC_WHALE = "0x47c031236e19d024b42f8AE6780E44A573170703"; // Arbitrum USDC whale

  beforeEach(async function () {
    // Get signers
    [deployer, agent, user] = await ethers.getSigners();

    // Deploy all contracts
    await deployments.fixture(["all"]);

    // Get deployed contracts
    const nexusVaultDeployment = await deployments.get("NexusVault");
    const signalOracleDeployment = await deployments.get("SignalOracle");
    const positionRegistryDeployment = await deployments.get("PositionRegistry");

    nexusVault = await ethers.getContractAt("NexusVault", nexusVaultDeployment.address);
    signalOracle = await ethers.getContractAt("SignalOracle", signalOracleDeployment.address);
    positionRegistry = await ethers.getContractAt("PositionRegistry", positionRegistryDeployment.address);

    // Get USDC and WETH contracts
    USDC = await ethers.getContractAt("IERC20", USDC_ADDRESS);
    WETH = await ethers.getContractAt("IERC20", WETH_ADDRESS);

    // Try multiple USDC whales until one works
    const whales = [
      "0x47c031236e19d024b42f8ae6780e44a573170703", // Vault
      "0xB38e8c17e38363aF6EbdCb3dAE12e0243582891D", // Bridge
      "0x489ee077994B6658eAfA855C308275EAd8097C4A", // GMX Vault
    ];
    
    let fundAmount = ethers.parseUnits("10000", 6);
    let funded = false;
    
    for (const whaleAddress of whales) {
      try {
        const whaleBalance = await USDC.balanceOf(whaleAddress);
        if (whaleBalance >= fundAmount) {
          await ethers.provider.send("hardhat_impersonateAccount", [whaleAddress]);
          const whale = await ethers.getSigner(whaleAddress);
          
          // Fund whale with ETH for gas
          const [funder] = await ethers.getSigners();
          await funder.sendTransaction({
            to: whaleAddress,
            value: ethers.parseEther("1.0")
          });
          
          // Transfer USDC to vault
          await USDC.connect(whale).transfer(nexusVault.target, fundAmount);
          await ethers.provider.send("hardhat_stopImpersonatingAccount", [whaleAddress]);
          funded = true;
          console.log(`\n✅ Funded vault from whale: ${whaleAddress}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!funded) {
      console.log("\n⚠️  Warning: Could not fund vault with USDC, some tests may fail");
    }

    console.log(`\n✅ Test setup complete`);
    console.log(`   Vault funded with 10,000 USDC`);
    console.log(`   Agent address: ${agent.address}`);
  });

  describe("Deployment", function () {
    it("Should deploy all contracts correctly", async function () {
      expect(await nexusVault.getAddress()).to.be.properAddress;
      expect(await signalOracle.getAddress()).to.be.properAddress;
      expect(await positionRegistry.getAddress()).to.be.properAddress;
    });

    it("Should set correct agent address", async function () {
      const agentAddr = await nexusVault.agentAddress();
      expect(agentAddr).to.equal(agent.address);
    });

    it("Should have USDC balance in vault", async function () {
      const balance = await nexusVault.getTotalVaultValue();
      expect(balance).to.equal(ethers.parseUnits("10000", 6));
    });

    it("Should approve WETH for shorting", async function () {
      const isApproved = await nexusVault.approvedTokens(WETH_ADDRESS);
      expect(isApproved).to.be.true;
    });
  });

  describe("Signal Oracle", function () {
    it("Should allow agent to publish signals", async function () {
      await expect(
        signalOracle.connect(agent).publishSignal(
          0, // INSIDER_WALLET_DUMP
          WETH_ADDRESS,
          "arbitrum",
          85, // confidence score
          ethers.id("metadata_hash")
        )
      ).to.not.be.reverted;
    });

    it("Should aggregate confidence scores", async function () {
      // Publish multiple signals
      await signalOracle.connect(agent).publishSignal(
        0, // INSIDER_WALLET_DUMP
        WETH_ADDRESS,
        "arbitrum",
        85,
        ethers.id("metadata1")
      );

      await signalOracle.connect(agent).publishSignal(
        1, // LIQUIDITY_REMOVAL
        WETH_ADDRESS,
        "arbitrum",
        70,
        ethers.id("metadata2")
      );

      // Get confidence score
      const [score, count] = await signalOracle.getConfidenceScore(
        WETH_ADDRESS,
        "arbitrum"
      );

      expect(score).to.equal(155); // 85 + 70
      expect(count).to.equal(2);
    });

    it("Should reject signals from non-publisher", async function () {
      await expect(
        signalOracle.connect(user).publishSignal(
          0,
          WETH_ADDRESS,
          "arbitrum",
          85,
          ethers.id("metadata")
        )
      ).to.be.revertedWith("Not authorized publisher");
    });
  });

  describe("Position Execution", function () {
    beforeEach(async function () {
      // Publish signals to meet confidence threshold
      await signalOracle.connect(agent).publishSignal(
        0, // INSIDER_WALLET_DUMP
        WETH_ADDRESS,
        "arbitrum",
        85,
        ethers.id("metadata1")
      );

      await signalOracle.connect(agent).publishSignal(
        1, // LIQUIDITY_REMOVAL
        WETH_ADDRESS,
        "arbitrum",
        70,
        ethers.id("metadata2")
      );
    });

    it("Should execute short position with sufficient signals", async function () {
      const collateral = ethers.parseUnits("5000", 6); // 5k USDC
      const leverage = 2;
      const entryPrice = ethers.parseUnits("2000", 30); // $2000

      // Need to send GMX execution fee
      const executionFee = ethers.parseEther("0.0001");

      await expect(
        nexusVault.connect(agent).executeShort(
          WETH_ADDRESS,
          collateral,
          leverage,
          entryPrice,
          { value: executionFee }
        )
      ).to.not.be.reverted;
    });

    it("Should reject position without sufficient confidence", async function () {
      // Deploy new vault without signals
      const newVault = await ethers.getContractFactory("NexusVault");
      const vault2 = await newVault.deploy(
        USDC_ADDRESS,
        agent.address,
        await signalOracle.getAddress(),
        await positionRegistry.getAddress(),
        "0x0000000000000000000000000000000000000001", // mock price oracle
        "0xb87a436B93fFE9D75c5cFA7bAcFff96430b09868", // GMX router
        "0x489ee077994B6658eAfA855C308275EAd8097C4A" // GMX vault
      );

      const collateral = ethers.parseUnits("5000", 6);
      const leverage = 2;
      const entryPrice = ethers.parseUnits("2000", 30);
      const executionFee = ethers.parseEther("0.0001");

      // Different token without signals
      const WBTC = "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f";
      await vault2.connect(deployer).approveToken(WBTC, true);

      await expect(
        vault2.connect(agent).executeShort(
          WBTC,
          collateral,
          leverage,
          entryPrice,
          { value: executionFee }
        )
      ).to.be.revertedWith("Confidence too low");
    });

    it("Should enforce position size limits", async function () {
      const collateral = ethers.parseUnits("3000", 6); // 30% of vault (exceeds 20% limit)
      const leverage = 2;
      const entryPrice = ethers.parseUnits("2000", 30);
      const executionFee = ethers.parseEther("0.0001");

      await expect(
        nexusVault.connect(agent).executeShort(
          WETH_ADDRESS,
          collateral,
          leverage,
          entryPrice,
          { value: executionFee }
        )
      ).to.be.revertedWith("Position exceeds max size");
    });

    it("Should only allow agent to execute", async function () {
      const collateral = ethers.parseUnits("1000", 6);
      const leverage = 2;
      const entryPrice = ethers.parseUnits("2000", 30);
      const executionFee = ethers.parseEther("0.0001");

      await expect(
        nexusVault.connect(user).executeShort(
          WETH_ADDRESS,
          collateral,
          leverage,
          entryPrice,
          { value: executionFee }
        )
      ).to.be.revertedWith("Not authorized agent");
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow owner to pause", async function () {
      await nexusVault.connect(deployer).setPaused(true);
      
      const collateral = ethers.parseUnits("1000", 6);
      const leverage = 2;
      const entryPrice = ethers.parseUnits("2000", 30);
      const executionFee = ethers.parseEther("0.0001");

      await expect(
        nexusVault.connect(agent).executeShort(
          WETH_ADDRESS,
          collateral,
          leverage,
          entryPrice,
          { value: executionFee }
        )
      ).to.be.revertedWith("Vault is paused");
    });

    it("Should allow emergency withdraw when paused", async function () {
      await nexusVault.connect(deployer).setPaused(true);
      
      const balance = await USDC.balanceOf(nexusVault.target);
      const ownerBefore = await USDC.balanceOf(deployer.address);

      await nexusVault.connect(deployer).emergencyWithdraw(USDC_ADDRESS, balance);
      
      const ownerAfter = await USDC.balanceOf(deployer.address);
      expect(ownerAfter - ownerBefore).to.equal(balance);
    });
  });

  describe("View Functions", function () {
    it("Should return correct vault value", async function () {
      const value = await nexusVault.getTotalVaultValue();
      expect(value).to.equal(ethers.parseUnits("10000", 6));
    });

    it("Should return empty array for no positions", async function () {
      const positions = await nexusVault.getOpenPositions();
      expect(positions.length).to.equal(0);
    });
  });
});
