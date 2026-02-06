module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer, agent } = await getNamedAccounts();

  console.log("====================================");
  console.log("Deploying SignalOracle...");
  console.log("====================================");

  // Use agent account as publisher
  const publisherAddress = agent || deployer;

  const signalOracle = await deploy("SignalOracle", {
    from: deployer,
    args: [publisherAddress],
    log: true,
    waitConfirmations: 1,
  });

  console.log(`✅ SignalOracle deployed to: ${signalOracle.address}`);
  console.log(`   Publisher address: ${publisherAddress}`);
};

module.exports.tags = ["SignalOracle", "all"];
