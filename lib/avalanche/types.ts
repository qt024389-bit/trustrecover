export type VerificationErrorCode =
  | "INVALID_HASH"
  | "TX_NOT_FOUND"
  | "RPC_ERROR"
  | "CHAIN_MISMATCH"
  | "INTERNAL_ERROR";

export interface TransactionLogItem {
  logIndex: number;
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  decodedEvent?: { name: string; args: Record<string, string> };
}

export interface VerifiedTransactionData {
  verifiedOnChain: true;
  network: {
    name: string;
    chainId: number;
  };
  transaction: {
    hash: string;
    from: string;
    to: string | null;
    valueWei: string;
    valueAvax: string;
    nonce: number;
    gasLimit: string;
    blockNumber: number | null;
    blockHash: string | null;
  };
  receipt: {
    status: "confirmed" | "failed" | "pending";
    statusCode: number | null;
    blockNumber: number | null;
    gasUsed: string | null;
    effectiveGasPrice: string | null;
    contractAddress: string | null;
    logsCount: number;
    logs: TransactionLogItem[];
  };
  recipientProfile?: {
    address: string;
    isContract: boolean;
    balanceAvax: string;
  } | null;
  queriedAt: string;
}

export interface VerificationErrorResponse {
  success: false;
  verifiedOnChain: false;
  error: {
    code: VerificationErrorCode;
    message: string;
  };
  recipientProfile?: {
    address: string;
    isContract: boolean;
    balanceAvax: string;
  } | null;
  queriedAt: string;
}

export interface VerificationSuccessResponse {
  success: true;
  data: VerifiedTransactionData;
}

export type VerifyTransactionResult =
  | VerificationSuccessResponse
  | VerificationErrorResponse;
