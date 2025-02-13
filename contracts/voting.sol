// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract NaijaElection {
    // Custom Errors
    error Unauthorized();
    error VotingNotStarted();
    error VotingEnded();
    error AlreadyVoted();
    error InvalidCandidate();
    error InvalidAddress();
    error VotingPeriodNotSet();
    error VotingInProgress();
    error invalidSetVoteStartDate();
    error invalidSetVoteEndDate();
    

    // Events
    event CandidateAdded(uint256 indexed candidateId, string name, string politicalParty);
    event VoteCast(address indexed voter, uint256 indexed candidateId);
    event VotingPeriodSet(uint256 startDate, uint256 endDate);
    event WinnerDeclared(string winnerName, uint256 totalVotes);

    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public hasVoted;
    uint256 public candidateCount;
    address public immutable owner;
    bool public votingStatus;
    uint256 public votingStartDate;
    uint256 public votingEndDate;
    

    struct Candidate {
        string name;
        string description;
        uint256 voteCount;
        string politicalParty;
    }

    constructor() {
        candidateCount = 0;
        owner = msg.sender;
        votingStatus = false;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier votingPeriodMustBeSet() {
        if (votingStartDate == 0 || votingEndDate == 0) revert VotingPeriodNotSet();
        _;
    }

    modifier duringVotingPeriod() {
        if (block.timestamp < votingStartDate) revert VotingNotStarted();
        if (block.timestamp > votingEndDate) revert VotingEnded();
        _;
    }

    function setVotingPeriod(uint256 _startDate, uint256 _endDate) external onlyOwner {
        if (votingStatus) revert VotingInProgress();
        if(_startDate < block.timestamp) revert invalidSetVoteStartDate();
        if(_endDate < block.timestamp) revert invalidSetVoteEndDate();
        
        // require(_startDate > block.timestamp, "Start date must be in the future");
        // require(_endDate > _startDate, "End date must be after start date");
        
        votingStartDate = _startDate;
        votingEndDate = _endDate;
        votingStatus = true;
        
        emit VotingPeriodSet(_startDate, _endDate);
    }

    function addCandidate(
        string memory _name,
        string memory _description,
        string memory _politicalParty
    ) external onlyOwner {
        candidateCount++;
        candidates[candidateCount] = Candidate({
            name: _name,
            description: _description,
            voteCount: 0,
            politicalParty: _politicalParty
        });

        emit CandidateAdded(candidateCount, _name, _politicalParty);
    }

    function vote(uint256 _candidateId) external duringVotingPeriod votingPeriodMustBeSet {
        if (hasVoted[msg.sender]) revert AlreadyVoted();
        if (_candidateId == 0 || _candidateId > candidateCount) revert InvalidCandidate();

        candidates[_candidateId].voteCount++;
        hasVoted[msg.sender] = true;

        emit VoteCast(msg.sender, _candidateId);
    }

    function getCandidateById(uint256 _id) external view returns (
        string memory name,
        string memory description,
        string memory politicalParty
    ) {
        if (_id == 0 || _id > candidateCount) revert InvalidCandidate();
        
        Candidate memory candidate = candidates[_id];
        return (candidate.name, candidate.description, candidate.politicalParty);
    }

    function getWinner() external view returns (string memory winnerName, uint256 totalVotes) {
        if (block.timestamp <= votingEndDate) revert VotingInProgress();
        
        uint256 winningVoteCount = 0;
        uint256 winningCandidateId = 0;
        
        for (uint256 i = 1; i <= candidateCount; i++) {
            if (candidates[i].voteCount > winningVoteCount) {
                winningVoteCount = candidates[i].voteCount;
                winningCandidateId = i;
            }
        }
        
        return (candidates[winningCandidateId].name, winningVoteCount);
    }

    // View function to check if voting is active
    function isVotingActive() external view returns (bool) {
        return block.timestamp >= votingStartDate && 
               block.timestamp <= votingEndDate && 
               votingStatus;
    }
}