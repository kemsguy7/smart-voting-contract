import { ethers } from "hardhat";
import fs from "fs";

// Utility function to get deployed addresses
async function getDeployedAddresses() {
  const network = process.env.HARDHAT_NETWORK || "hardhat";
  const deploymentPath = `./deployments/${network}.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`No deployment found for network ${network}`);
  }
  
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

// Get current timestamp and add seconds
async function getTimestamp(additionalSeconds: number = 0) {
  const currentBlockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(currentBlockNumber);
  if (!block) throw new Error("Could not get current block");
  return Number(block.timestamp) + additionalSeconds;
}

// Format duration for display
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (remainingSeconds > 0) parts.push(`${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`);
  
  return parts.join(' and ');
}

// Setup voting period
async function setupVotingPeriod(election: any) {
  const currentTimestamp = await getTimestamp();
  
  // Start in 2 seconds, end in 15 seconds
  const startTime = currentTimestamp + 5; // 2 seconds


  //const endTime = startTime + (24 * 60 * 60); // 24 hours
  //const endTime = startTime + 15; // 15 seconds 
  const endTime = startTime + (15 * 1000); // 15 seconds

  console.log("\nSetting up voting period...");
  const tx = await election.setVotingPeriod(startTime, endTime);
  await tx.wait(); 
  
  console.log("\nVoting Period Details:");
  console.log("----------------------");
  console.log(`Start Time: ${new Date(startTime * 1000).toLocaleString()}`);
  console.log(`End Time: ${new Date(endTime * 1000).toLocaleString()}`);
  console.log(`Duration: ${formatDuration(endTime - startTime)}`);
  console.log(`Setup Wait Time: ${formatDuration(startTime - currentTimestamp)}`);
  
  return { startTime, endTime };
}

// Add candidates
async function addCandidates(election: any) {
  const candidates = [
    { name: "Peter Obi", description: "Labour Party Candidate", party: "LP" },
    { name: "Bola Tinubu", description: "APC Candidate", party: "APC" },
    { name: "Atiku Abubakar", description: "PDP Candidate", party: "PDP" }
  ];

  console.log("\nAdding candidates...");
  for (const candidate of candidates) {
    const tx = await election.addCandidate(candidate.name, candidate.description, candidate.party);
    await tx.wait();
    console.log(`Added candidate: ${candidate.name} (${candidate.party})`);
  }
}

// Cast votes
async function castVotes(election: any, signers: any[]) {
  console.log("\nPreparing to cast votes...");
  
  // Check voting status
  const votingStartDate = await election.votingStartDate();
  const votingEndDate = await election.votingEndDate();
  const currentBlock = await ethers.provider.getBlock('latest');
  
  if (currentBlock) {
    const currentTime = Number(currentBlock.timestamp);
    const startTime = Number(votingStartDate);
    const endTime = Number(votingEndDate);
    
    console.log("\nVoting Status Check:");
    console.log("-------------------");
    console.log(`Current Time: ${new Date(currentTime * 1000).toLocaleString()}`);
    
    if (currentTime < startTime) {
      const waitTime = startTime - currentTime;
      console.log(`Voting hasn't started yet. Please wait ${formatDuration(waitTime)}`);
      console.log(`Voting will start at: ${new Date(startTime * 1000).toLocaleString()}`);
      return;
    }
    
    if (currentTime > endTime) {
      console.log("Voting period has ended.");
      return;
    }
    
    console.log("Voting is currently active!");
  }

  const votes = [1, 2, 1, 3]; // Voting pattern for the 4 signers
  console.log("\nCasting votes...");
  
  for (let i = 0; i < signers.length; i++) {
    try {
      const tx = await election.connect(signers[i]).vote(votes[i]);
      await tx.wait();
      console.log(`Voter ${i + 1} (${signers[i].address}) voted for candidate ${votes[i]}`);
    } catch (error: any) {
      console.error(`Error: Voter ${i + 1} failed to vote:`, error.message);
    }
  }
}

// Get winner
async function getWinner(election: any) {
  try {
    console.log("\nChecking winner status...");
    const votingEndDate = await election.votingEndDate();
    const currentBlock = await ethers.provider.getBlock('latest');
    
    if (currentBlock && Number(currentBlock.timestamp) <= Number(votingEndDate)) {
      const timeRemaining = Number(votingEndDate) - Number(currentBlock.timestamp);
      console.log(`Voting is still in progress. ${formatDuration(timeRemaining)} remaining.`);
      return;
    }

    const [winnerName, totalVotes] = await election.getWinner();
    console.log("\nElection Results:");
    console.log("----------------");
    console.log(`Winner: ${winnerName}`);
    console.log(`Total votes received: ${totalVotes.toString()}`);
  } catch (error: any) {
    console.log("Could not determine winner yet.");
    console.log("Error:", error.message);
  }
}

// Main function to run the election process
async function main() {
  try {
    // Get contract instance
    const { election: electionAddress } = await getDeployedAddresses();
    const election = await ethers.getContractAt("NaijaElection", electionAddress);
    
    // Get signers
    const signers = await ethers.getSigners();
    const [owner, ...voters] = signers;
    
    console.log("Election Automation Starting...");
    console.log(`Contract Address: ${electionAddress}`);
    console.log(`Owner Address: ${owner.address}`);

    // Check if voting is already set up
    const isVotingActive = await election.isVotingActive();
    if (!isVotingActive) {
      await setupVotingPeriod(election);
      await addCandidates(election);
    } else {
      console.log("\nVoting is already active, skipping setup...");
    }

    // Cast votes and check winner
    await castVotes(election, voters.slice(0, 4));
    await getWinner(election);

    console.log("\nScript execution completed!");

  } catch (error) {
    console.error("Error:", error);
    process.exitCode = 1;
  }
}

// Execute if running this script directly
if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  setupVotingPeriod,
  addCandidates,
  castVotes,
  getWinner
};