export const ARBITRATION_CONTRACT_ADDRESS =
  "0xCc8E3699Bb55265f849bBC7120353ADbEed74EC1";

export const ARBITRATION_ABI = [
  "function owner() view returns (address)",
  "function minStakeWei() view returns (uint256)",
  "function requiredVotes() view returns (uint256)",
  "function authorizedReviewers(address) view returns (bool)",
  "function totalCases() view returns (uint256)",
  "function submitDisputeWithStake(string caseId, bytes32 reportHash) payable",
  "function voteResolution(string caseId, bool approveClaim)",
  "function releaseStake(string caseId)",
  "function getCase(string caseId) view returns (tuple(string caseId, bytes32 reportHash, address submitter, uint256 stakeAmount, uint256 approveVotes, uint256 rejectVotes, uint8 state, bool stakeClaimed, uint256 createdAt))",
] as const;