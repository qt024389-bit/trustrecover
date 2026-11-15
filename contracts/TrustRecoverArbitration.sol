// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TrustRecoverArbitration {
    address public owner;
    uint256 public minStakeWei;
    uint256 public requiredVotes;

    enum ResolutionState {
        NONE,
        OPEN,
        APPROVED,
        REJECTED
    }

    struct ArbitrationCase {
        string caseId;
        bytes32 reportHash;
        address submitter;
        uint256 stakeAmount;
        uint256 approveVotes;
        uint256 rejectVotes;
        ResolutionState state;
        bool stakeClaimed;
        uint256 createdAt;
    }

    mapping(address => bool) public authorizedReviewers;
    mapping(bytes32 => ArbitrationCase) private cases;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;
    bytes32[] private caseKeys;

    event ReviewerUpdated(address indexed reviewer, bool allowed);
    event DisputeSubmitted(string caseId, bytes32 indexed reportHash, address indexed submitter, uint256 stakeAmount);
    event VoteCast(string caseId, address indexed reviewer, bool approve, uint256 approveVotes, uint256 rejectVotes);
    event CaseFinalized(string caseId, ResolutionState finalState);
    event StakeReleased(string caseId, address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyReviewer() {
        require(authorizedReviewers[msg.sender], "Only authorized reviewer");
        _;
    }

    constructor(uint256 _minStakeWei, uint256 _requiredVotes) {
        require(_requiredVotes >= 1, "Required votes >= 1");
        owner = msg.sender;
        authorizedReviewers[msg.sender] = true;
        minStakeWei = _minStakeWei;
        requiredVotes = _requiredVotes;
        emit ReviewerUpdated(msg.sender, true);
    }

    function setReviewer(address reviewer, bool allowed) external onlyOwner {
        require(reviewer != address(0), "Invalid reviewer");
        authorizedReviewers[reviewer] = allowed;
        emit ReviewerUpdated(reviewer, allowed);
    }

    function setConfig(uint256 _minStakeWei, uint256 _requiredVotes) external onlyOwner {
        require(_requiredVotes >= 1, "Required votes >= 1");
        minStakeWei = _minStakeWei;
        requiredVotes = _requiredVotes;
    }

    function submitDisputeWithStake(string calldata caseId, bytes32 reportHash) external payable {
        require(bytes(caseId).length > 0 && bytes(caseId).length <= 64, "Invalid caseId");
        require(reportHash != bytes32(0), "Invalid reportHash");
        require(msg.value >= minStakeWei, "Insufficient AVAX stake");

        bytes32 key = keccak256(bytes(caseId));
        require(cases[key].state == ResolutionState.NONE, "Case already exists");

        cases[key] = ArbitrationCase({
            caseId: caseId,
            reportHash: reportHash,
            submitter: msg.sender,
            stakeAmount: msg.value,
            approveVotes: 0,
            rejectVotes: 0,
            state: ResolutionState.OPEN,
            stakeClaimed: false,
            createdAt: block.timestamp
        });
        caseKeys.push(key);

        emit DisputeSubmitted(caseId, reportHash, msg.sender, msg.value);
    }

    function voteResolution(string calldata caseId, bool approveClaim) external onlyReviewer {
        bytes32 key = keccak256(bytes(caseId));
        ArbitrationCase storage c = cases[key];
        require(c.state == ResolutionState.OPEN, "Case not open");
        require(!hasVoted[key][msg.sender], "Already voted");

        hasVoted[key][msg.sender] = true;
        if (approveClaim) {
            c.approveVotes += 1;
        } else {
            c.rejectVotes += 1;
        }

        emit VoteCast(caseId, msg.sender, approveClaim, c.approveVotes, c.rejectVotes);

        if (c.approveVotes >= requiredVotes) {
            c.state = ResolutionState.APPROVED;
            emit CaseFinalized(caseId, ResolutionState.APPROVED);
        } else if (c.rejectVotes >= requiredVotes) {
            c.state = ResolutionState.REJECTED;
            emit CaseFinalized(caseId, ResolutionState.REJECTED);
        }
    }

    function releaseStake(string calldata caseId) external {
        bytes32 key = keccak256(bytes(caseId));
        ArbitrationCase storage c = cases[key];
        require(c.state == ResolutionState.APPROVED || c.state == ResolutionState.REJECTED, "Case not finalized");
        require(!c.stakeClaimed, "Stake already claimed");
        require(msg.sender == c.submitter || msg.sender == owner, "Not authorized");

        c.stakeClaimed = true;
        uint256 amount = c.stakeAmount;
        address recipient = c.state == ResolutionState.APPROVED ? c.submitter : owner;

        (bool ok, ) = payable(recipient).call{value: amount}("");
        require(ok, "Transfer failed");

        emit StakeReleased(caseId, recipient, amount);
    }

    function getCase(string calldata caseId) external view returns (ArbitrationCase memory) {
        return cases[keccak256(bytes(caseId))];
    }

    function totalCases() external view returns (uint256) {
        return caseKeys.length;
    }
}