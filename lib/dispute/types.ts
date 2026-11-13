import type { VerifiedTransactionData } from "@/lib/avalanche/types";

export type EvidenceVerdict =
  | "VERIFIED"
  | "CONTRADICTED"
  | "INSUFFICIENT"
  | "UNVERIFIABLE";

export interface EvidenceFileMeta {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256CommitmentHash: string;
  integrityNote: string;
  extractedTextPreview?: string;
  inlineDataBase64?: string;
}

export interface AskPayReport {
  txStatusSummary: string;
  senderExplanation: string;
  recipientExplanation: string;
  valueAndGasExplanation: string;
  blockAndLogsExplanation: string;
  verifiedBlockchainFacts: string[];
  unverifiedOrInsufficientData: string[];
  warnings: string[];
}

export interface DoubtStampFinding {
  claimAspect: string;
  userStatement: string;
  onChainOrEvidenceReference: string;
  verdict: EvidenceVerdict;
  reasoning: string;
  dataSource: "AVALANCHE_FUJI_ONCHAIN" | "USER_EVIDENCE_FILE" | "CROSS_CHECK";
}

export interface DoubtStampReport {
  overallConsistencySummary: string;
  findings: DoubtStampFinding[];
  contradictions: string[];
  missingEvidence: string[];
  evidenceSufficiencyScore: number;
  sufficiencyExplanation: string;
}

export interface LegalMindActionItem {
  step: number;
  category: "TECHNICAL_ACTION" | "EVIDENCE_COLLECTION" | "PLATFORM_CONTACT" | "LEGAL_INFORMATION";
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface LegalMindReport {
  executiveSummary: string;
  disputeChecklist: LegalMindActionItem[];
  missingEvidenceSteps: string[];
  platformEscalationGuidance: string[];
  technicalVsLegalDistinction: string;
  legalReferencesAndScope: string[];
  mandatoryDisclaimers: string[];
}

export interface AuditLogEntry {
  timestamp: string;
  actor: "SYSTEM_AVALANCHE_RPC" | "EVIDENCE_HASHER" | "GEMINI_AI_PIPELINE" | "HUMAN_REVIEWER";
  action: string;
  detail: string;
}

export interface DisputeCaseAnalysis {
  caseId: string;
  createdAt: string;
  humanReviewStatus: "PENDING_HUMAN_REVIEW" | "APPROVED_BY_REVIEWER" | "FLAGGED_FOR_ESCALATION";
  userInput: {
    txHash: string;
    userClaim: string;
    claimedAmountAvax?: string;
    claimedRecipient?: string;
    evidenceFiles: EvidenceFileMeta[];
  };
  onChainVerification: {
    verified: boolean;
    networkName: string;
    chainId: number;
    txData: VerifiedTransactionData | null;
    verificationError?: string;
  };
  aiInvestigation: {
    modelUsed: string;
    askPay: AskPayReport;
    doubtStamp: DoubtStampReport;
    legalMind: LegalMindReport;
  };
  auditHistory: AuditLogEntry[];
}