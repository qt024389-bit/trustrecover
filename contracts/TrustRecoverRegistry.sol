// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TrustRecoverRegistry {
    struct AnchoredCase {
        string caseId;
        bytes32 txHash;
        bytes32 reportHash;
        string verdict;
        address reviewer;
        uint256 anchoredAt;
    }

    address public owner;
    mapping(address => bool) public authorizedReviewers;
    mapping(string => AnchoredCase) private casesById;
    string[] private caseIds;

    event ReviewerUpdated(address indexed reviewer, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event CaseAnchored(
        string indexed caseIdIndexed,
        string caseId,
        bytes32 indexed txHash,
        bytes32 reportHash,
        string verdict,
        address indexed reviewer,
        uint256 anchoredAt
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyReviewer() {
        require(authorizedReviewers[msg.sender], "Caller is not an authorized reviewer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedReviewers[msg.sender] = true;
        emit ReviewerUpdated(msg.sender, true);
    }

    function setReviewer(address reviewer, bool allowed) external onlyOwner {
        require(reviewer != address(0), "Invalid reviewer address");
        authorizedReviewers[reviewer] = allowed;
        emit ReviewerUpdated(reviewer, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function anchorCase(
        string calldata caseId,
        bytes32 txHash,
        bytes32 reportHash,
        string calldata verdict
    ) external onlyReviewer {
        require(bytes(caseId).length > 0 && bytes(caseId).length <= 64, "Invalid caseId length");
        require(txHash != bytes32(0), "Invalid txHash");
        require(reportHash != bytes32(0), "Invalid reportHash");
        require(bytes(verdict).length > 0 && bytes(verdict).length <= 64, "Invalid verdict length");
        require(casesById[caseId].anchoredAt == 0, "Case already anchored");

        casesById[caseId] = AnchoredCase({
            caseId: caseId,
            txHash: txHash,
            reportHash: reportHash,
            verdict: verdict,
            reviewer: msg.sender,
            anchoredAt: block.timestamp
        });

        caseIds.push(caseId);

        emit CaseAnchored(
            caseId,
            caseId,
            txHash,
            reportHash,
            verdict,
            msg.sender,
            block.timestamp
        );
    }

    function getCase(string calldata caseId) external view returns (AnchoredCase memory) {
        return casesById[caseId];
    }

    function getTotalCases() external view returns (uint256) {
        return caseIds.length;
    }

    function getCaseIdAt(uint256 index) external view returns (string memory) {
        require(index < caseIds.length, "Index out of bounds");
        return caseIds[index];
    }
}