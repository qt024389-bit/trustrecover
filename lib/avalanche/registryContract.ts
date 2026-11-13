export const TRUSTRECOVER_REGISTRY_ADDRESS =
  "0x703c3A588265262B93C0a6b83B814a393f446CBc";

export const TRUSTRECOVER_FUJI_CHAIN_ID = 43113;
export const TRUSTRECOVER_FUJI_CHAIN_HEX = "0xa869";
export const SNOWTRACE_FUJI_URL = "https://testnet.snowtrace.io";

export const TRUSTRECOVER_REGISTRY_ABI = [
  "function anchorCase(string caseId, bytes32 txHash, bytes32 reportHash, string verdict) external",
  "function getCase(string caseId) external view returns (tuple(string caseId, bytes32 txHash, bytes32 reportHash, string verdict, address reviewer, uint256 anchoredAt))",
  "function getTotalCases() external view returns (uint256)",
  "function getCaseIdAt(uint256 index) external view returns (string)",
  "event CaseAnchored(string indexed caseIdIndexed, string caseId, bytes32 indexed txHash, bytes32 reportHash, string verdict, address indexed reviewer, uint256 anchoredAt)"
] as const;