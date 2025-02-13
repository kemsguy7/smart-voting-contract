import { ethers, network } from "hardhat";
import hre from "hardhat";
import fs from "fs";

async function verifyContract(address: string, constructorArguments: any[] = []) {
  if (network.name === "hardhat" || network.name === "localhost") return;

  console.log("Waiting for block confirmations...");
  await new Promise(resolve => setTimeout(resolve, 30000));

  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments,
    });
    console.log(`Contract verified at ${address}`);
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Contract already verified!");
    } else {
      console.error("Error verifying contract:", error);
    }
  }
}

async function main() {
  try {
    // Pre-deployment checks
    if (network.name === "base_sepolia") {
      console.log("\nDeploying to Base Sepolia...");
      console.log(`ChainId: ${network.config.chainId}`);
    }

    const [deployer] = await ethers.getSigners();
    console.log(`Deploying with account: ${deployer.address}`);
    
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

    // Deploy NaijaElection
    console.log("Deploying NaijaElection contract...");
    const ElectionFactory = await ethers.getContractFactory("NaijaElection");
    const election = await ElectionFactory.deploy();
    await election.waitForDeployment();
    
    const electionAddress = await election.getAddress();
    console.log(`NaijaElection deployed to: ${electionAddress}`);

    // Log deployment summary
    console.log("\nDeployment Summary:");
    console.log("-------------------");
    console.log(`Network: ${network.name}`);
    console.log(`Election Contract: ${electionAddress}`);
    console.log(`Block Number: ${await ethers.provider.getBlockNumber()}`);
  //  console.log(`Gas Price: ${ethers.formatUnits(await ethers.provider.getGasPrice(), 'gwei')} gwei`);

    // Save deployment addresses
    const deployments = {
      network: network.name,
      chainId: network.config.chainId,
      election: electionAddress,
      timestamp: new Date().toISOString()
    };

    const deploymentsDir = "./deployments";
    if (!fs.existsSync(deploymentsDir)){
      fs.mkdirSync(deploymentsDir);
    }

    fs.writeFileSync(
      `${deploymentsDir}/${network.name}.json`,
      JSON.stringify(deployments, null, 2)
    );

    // Verify contract
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\nStarting contract verification...");
      await verifyContract(electionAddress, []);
    }

    console.log("\nDeployment completed successfully! 🎉");

  } catch (error) {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
  }
}

// Execute deployment
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}