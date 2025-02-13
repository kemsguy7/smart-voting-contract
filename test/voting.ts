import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("NaijaElection Deployment", function () {
  async function deployElectionFixture() {
    const [owner, addr1, addr2, addr3] = await ethers.getSigners();
    const ElectionFactory = await ethers.getContractFactory("NaijaElection");
    const election = await ElectionFactory.deploy(); //deploy the contract

    return { election, owner, addr1, addr2, addr3 };
  }

  describe("Deployment Initialization", function () {
    it("Should set the right owner", async function () {
      const { election, owner } = await loadFixture(deployElectionFixture);
      expect(await election.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero candidates", async function () {
      const { election } = await loadFixture(deployElectionFixture);
      expect(await election.candidateCount()).to.equal(0);
    });

    it("Should start with voting status as false", async function () {
      const { election } = await loadFixture(deployElectionFixture);
      expect(await election.votingStatus()).to.equal(false);
    });
  });

  describe("Voting Period Management", function () {
    it("Should set voting period correctly", async function () {
      const { election } = await loadFixture(deployElectionFixture);
      const currentTime = await time.latest();
      const startTime = currentTime + 3600; // Start in 1 hour
      const endTime = startTime + 86400; // End in 24 hours

      await election.setVotingPeriod(startTime, endTime);
      expect(await election.votingStartDate()).to.equal(startTime);
      expect(await election.votingEndDate()).to.equal(endTime);
      expect(await election.votingStatus()).to.equal(true);
    });

    it("Should revert if non-owner tries to set voting period", async function () {
      const { election, addr1 } = await loadFixture(deployElectionFixture);
      const currentTime = await time.latest();
      await expect(
        election.connect(addr1).setVotingPeriod(currentTime + 3600, currentTime + 86400)
      ).to.be.revertedWithCustomError(election, "Unauthorized");
    });

    it("Should revert if start date is in the past", async function () {
      const { election } = await loadFixture(deployElectionFixture);
      const currentTime = await time.latest();
      await expect(
        election.setVotingPeriod(currentTime - 3600, currentTime + 86400)
      ).to.be.revertedWithCustomError(election, "invalidSetVoteStartDate");
    });
  });

  describe("Candidate Management", function () {
    it("Should add candidate correctly", async function () {
      const { election } = await loadFixture(deployElectionFixture);
      await election.addCandidate("Bola Ahmed Tinubu", "Candidate 1", "Party APC");
      
      const candidate = await election.getCandidateById(1);
      expect(candidate[0]).to.equal("Bola Ahmed Tinubu");
      expect(candidate[1]).to.equal("Candidate 1");
      expect(candidate[2]).to.equal("Party APC");
    });

    it("Should revert if non-owner tries to add candidate", async function () {
      const { election, addr1 } = await loadFixture(deployElectionFixture);
      await expect(
        election.connect(addr1).addCandidate("John Doe", "Candidate 1", "Party A")
      ).to.be.revertedWithCustomError(election, "Unauthorized");
    });
  });

  describe("Voting Process", function () {
    async function setupVotingPeriod(election: any) {
      const currentTime = await time.latest();
      const startTime = currentTime + 3600;
      const endTime = startTime + 86400;
      await election.setVotingPeriod(startTime, endTime);
      await election.addCandidate("Bola Ahmed Tinubu", "Candidate 1", "APC");
      await election.addCandidate("Peter Gregory Obi", "Candidate 2", "Labour Party");
      await time.increaseTo(startTime + 1);
    }

    it("Should allow voting during voting period", async function () {
      const { election, addr1 } = await loadFixture(deployElectionFixture);
      await setupVotingPeriod(election);
      
      await election.connect(addr1).vote(1);
      const candidate = await election.candidates(1);
      expect(candidate.voteCount).to.equal(1);
    });

    it("Should prevent double voting", async function () {
      const { election, addr1 } = await loadFixture(deployElectionFixture);
      await setupVotingPeriod(election);
      
      await election.connect(addr1).vote(1);
      await expect(
        election.connect(addr1).vote(1)
      ).to.be.revertedWithCustomError(election, "AlreadyVoted");
    });

    it("Should prevent voting before start time", async function () {
      const { election, addr1 } = await loadFixture(deployElectionFixture);
      const currentTime = await time.latest();
      await election.setVotingPeriod(currentTime + 3600, currentTime + 86400);
      await election.addCandidate("John Doe", "Candidate 1", "Party A");
      
      await expect(
        election.connect(addr1).vote(1)
      ).to.be.revertedWithCustomError(election, "VotingNotStarted");
    });
  });

  describe("Winner Declaration", function () {
    it("Should correctly determine the winner", async function () {
      const { election, addr1, addr2, addr3 } = await loadFixture(deployElectionFixture);
      const currentTime = await time.latest();
      await election.setVotingPeriod(currentTime + 3600, currentTime + 7200);
      
      await election.addCandidate("John Doe", "Candidate 1", "Party A");
      await election.addCandidate("Jane Doe", "Candidate 2", "Party B");
      
      await time.increaseTo(currentTime + 3601);
      
      await election.connect(addr1).vote(1);
      await election.connect(addr2).vote(1);
      await election.connect(addr3).vote(2);
      
      await time.increaseTo(currentTime + 7201);
      
      const winner = await election.getWinner();
      expect(winner[0]).to.equal("John Doe");
      expect(winner[1]).to.equal(2);
    });

    it("Should revert if trying to get winner before voting ends", async function () {
      const { election } = await loadFixture(deployElectionFixture);
      const currentTime = await time.latest();
      await election.setVotingPeriod(currentTime + 3600, currentTime + 7200);
      
      await expect(
        election.getWinner()
      ).to.be.revertedWithCustomError(election, "VotingInProgress");
    });
  });
});