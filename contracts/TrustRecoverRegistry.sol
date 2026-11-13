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

    mapping(string => AnchoredCase) private casesById;
    string[] private caseIds;

    event CaseAnchored(
        string indexed caseIdIndexed,
        string caseId,
        bytes32 indexed txHash,
        bytes32 reportHash,
        string verdict,
        address indexed reviewer,
        uint256 anchoredAt
    );

    function anchorCase(
        string calldata caseId,
        bytes32 txHash,
        bytes32 reportHash,
        string calldata verdict
    ) external {
        require(bytes(caseId).length > 0, "Case ID cannot be empty");
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