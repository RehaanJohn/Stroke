module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("====================================");
  console.log("Deploying PositionRegistry...");
  console.log("====================================");

  const positionRegistry = await deploy("PositionRegistry", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: 1,
  });

  console.log(`✅ PositionRegistry deployed to: ${positionRegistry.address}`);
};

module.exports.tags = ["PositionRegistry", "all"];
