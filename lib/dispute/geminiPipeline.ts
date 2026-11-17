import { GoogleGenAI, Type, Schema } from "@google/genai";
import { z } from "zod";
import { verifyFujiTransaction } from "@/lib/avalanche/verifyTransaction";
import { resolveAvalancheNetwork } from "@/lib/avalanche/networks";
import { evaluateCrossEngineAndReadiness } from "./consistencyAndScoring";
import type {
  DisputeCaseAnalysis,
  EvidenceFileMeta,
  AuditLogEntry,
} from "./types";

const OVERALL_AI_DEADLINE_MS = 48_000;
const PER_ATTEMPT_CAP_MS = 13_000;
const MIN_REMAINING_FOR_FALLBACK_MS = 3_500;

export interface AiAttemptLog {
  model: string;
  errorStatus: number;
  errorCode: string;
  retryCount: number;
  durationMs: number;
}

export class AiServiceUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly errorCode = "AI_SERVICE_UNAVAILABLE";
  public readonly attempts: AiAttemptLog[];
  public readonly onChainVerification: DisputeCaseAnalysis["onChainVerification"];
  public readonly auditHistory: AuditLogEntry[];

  constructor(params: {
    message: string;
    attempts: AiAttemptLog[];
    onChainVerification: DisputeCaseAnalysis["onChainVerification"];
    auditHistory: AuditLogEntry[];
  }) {
    super(params.message);
    this.name = "AiServiceUnavailableError";
    this.attempts = params.attempts;
    this.onChainVerification = params.onChainVerification;
    this.auditHistory = params.auditHistory;
  }
}

const AI_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    askPay: {
      type: Type.OBJECT,
      properties: {
        txStatusSummary: { type: Type.STRING },
        senderExplanation: { type: Type.STRING },
        recipientExplanation: { type: Type.STRING },
        valueAndGasExplanation: { type: Type.STRING },
        blockAndLogsExplanation: { type: Type.STRING },
        verifiedBlockchainFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        unverifiedOrInsufficientData: { type: Type.ARRAY, items: { type: Type.STRING } },
        warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        "txStatusSummary",
        "senderExplanation",
        "recipientExplanation",
        "valueAndGasExplanation",
        "blockAndLogsExplanation",
        "verifiedBlockchainFacts",
        "unverifiedOrInsufficientData",
        "warnings",
      ],
    },
    doubtStamp: {
      type: Type.OBJECT,
      properties: {
        overallConsistencySummary: { type: Type.STRING },
        findings: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              claimAspect: { type: Type.STRING },
              userStatement: { type: Type.STRING },
              onChainOrEvidenceReference: { type: Type.STRING },
              verdict: {
                type: Type.STRING,
                enum: ["VERIFIED", "CONTRADICTED", "INSUFFICIENT", "UNVERIFIABLE"],
              },
              reasoning: { type: Type.STRING },
              dataSource: {
                type: Type.STRING,
                enum: ["AVALANCHE_ONCHAIN_RPC", "USER_EVIDENCE_FILE", "CROSS_CHECK"],
              },
            },
            required: [
              "claimAspect",
              "userStatement",
              "onChainOrEvidenceReference",
              "verdict",
              "reasoning",
              "dataSource",
            ],
          },
        },
        contradictions: { type: Type.ARRAY, items: { type: Type.STRING } },
        missingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
        evidenceSufficiencyScore: { type: Type.NUMBER },
        sufficiencyExplanation: { type: Type.STRING },
      },
      required: [
        "overallConsistencySummary",
        "findings",
        "contradictions",
        "missingEvidence",
        "evidenceSufficiencyScore",
        "sufficiencyExplanation",
      ],
    },
    legalMind: {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { type: Type.STRING },
        disputeChecklist: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              step: { type: Type.NUMBER },
              category: {
                type: Type.STRING,
                enum: [
                  "TECHNICAL_ACTION",
                  "EVIDENCE_COLLECTION",
                  "PLATFORM_CONTACT",
                  "LEGAL_INFORMATION",
                ],
              },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
            },
            required: ["step", "category", "title", "description", "priority"],
          },
        },
        missingEvidenceSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
        platformEscalationGuidance: { type: Type.ARRAY, items: { type: Type.STRING } },
        technicalVsLegalDistinction: { type: Type.STRING },
        legalReferencesAndScope: { type: Type.ARRAY, items: { type: Type.STRING } },
        mandatoryDisclaimers: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        "executiveSummary",
        "disputeChecklist",
        "missingEvidenceSteps",
        "platformEscalationGuidance",
        "technicalVsLegalDistinction",
        "legalReferencesAndScope",
        "mandatoryDisclaimers",
      ],
    },
  },
  required: ["askPay", "doubtStamp", "legalMind"],
};

const AiInvestigationZodSchema = z.object({
  askPay: z.object({
    txStatusSummary: z.string().min(1),
    senderExplanation: z.string().min(1),
    recipientExplanation: z.string().min(1),
    valueAndGasExplanation: z.string().min(1),
    blockAndLogsExplanation: z.string().min(1),
    verifiedBlockchainFacts: z.array(z.string()),
    unverifiedOrInsufficientData: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
  doubtStamp: z.object({
    overallConsistencySummary: z.string().min(1),
    findings: z
      .array(
        z.object({
          claimAspect: z.string().min(1),
          userStatement: z.string(),
          onChainOrEvidenceReference: z.string(),
          verdict: z.enum(["VERIFIED", "CONTRADICTED", "INSUFFICIENT", "UNVERIFIABLE"]),
          reasoning: z.string(),
          dataSource: z.enum(["AVALANCHE_ONCHAIN_RPC", "USER_EVIDENCE_FILE", "CROSS_CHECK"]),
        })
      )
      .max(12),
    contradictions: z.array(z.string()),
    missingEvidence: z.array(z.string()),
    evidenceSufficiencyScore: z.number(),
    sufficiencyExplanation: z.string(),
  }),
  legalMind: z.object({
    executiveSummary: z.string().min(1),
    disputeChecklist: z
      .array(
        z.object({
          step: z.number(),
          category: z.enum([
            "TECHNICAL_ACTION",
            "EVIDENCE_COLLECTION",
            "PLATFORM_CONTACT",
            "LEGAL_INFORMATION",
          ]),
          title: z.string().min(1),
          description: z.string().min(1),
          priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
        })
      )
      .max(12),
    missingEvidenceSteps: z.array(z.string()),
    platformEscalationGuidance: z.array(z.string()),
    technicalVsLegalDistinction: z.string(),
    legalReferencesAndScope: z.array(z.string()),
    mandatoryDisclaimers: z.array(z.string()),
  }),
});

export interface RunDisputePipelineParams {
  txHash: string;
  userClaim: string;
  claimedAmountAvax?: string;
  claimedAsset?: string;
  claimedRecipient?: string;
  evidenceFiles: EvidenceFileMeta[];
  network?: string;
}

function parseClaimedAmountAndAsset(rawAmount?: string, rawAsset?: string): {
  claimedAmount: string | null;
  claimedAsset: string;
} {
  const amtStr = (rawAmount || "").trim();
  const explicitAsset = (rawAsset || "").trim();
  if (!amtStr) {
    return { claimedAmount: null, claimedAsset: explicitAsset || "AVAX" };
  }
  const m = amtStr.match(/^([0-9][0-9.,]*)\s*([A-Za-z0-9._-]+)?$/);
  if (m) {
    return {
      claimedAmount: m[1].replace(/,/g, ""),
      claimedAsset: explicitAsset || m[2] || "AVAX",
    };
  }
  return { claimedAmount: amtStr, claimedAsset: explicitAsset || "AVAX" };
}

function logPipelineStage(data: {
  stage: string;
  durationMs: number;
  status: "OK" | "ERROR";
  model?: string;
  errorStatus?: number;
  errorCode?: string;
  retryCount?: number;
  mimeType?: string;
  sizeBytes?: number;
}) {
  console.log(JSON.stringify({ service: "TRUSTRECOVER_PIPELINE", ...data }));
}

function classifyAiError(err: unknown): {
  transient: boolean;
  errorStatus: number;
  errorCode: string;
  retryAfterMs?: number;
} {
  const msg = err instanceof Error ? err.message : String(err);

  let retryAfterMs: number | undefined;
  const delayMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i) || msg.match(/retry in\s+([0-9.]+)s/i);
  if (delayMatch) {
    retryAfterMs = Math.ceil(Number(delayMatch[1]) * 1000);
  }

  if ((err instanceof Error && err.name === "AbortError") || msg.includes("ABORT_TIMEOUT") || msg.includes("Timeout")) {
    return { transient: true, errorStatus: 408, errorCode: "ABORT_TIMEOUT" };
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return { transient: true, errorStatus: 429, errorCode: "HTTP_429", retryAfterMs };
  }
  if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
    return { transient: true, errorStatus: 503, errorCode: "HTTP_503", retryAfterMs };
  }
  if (msg.includes("400") || msg.includes("INVALID_ARGUMENT")) {
    return { transient: false, errorStatus: 400, errorCode: "HTTP_400" };
  }
  if (msg.includes("404") || msg.includes("not found")) {
    return { transient: false, errorStatus: 404, errorCode: "HTTP_404" };
  }
  if (msg.includes("INVALID_AI_JSON_STRUCTURE")) {
    return { transient: true, errorStatus: 502, errorCode: "INVALID_AI_JSON_STRUCTURE" };
  }
  return { transient: false, errorStatus: 500, errorCode: "AI_ERROR" };
}

export async function runDisputeIntelligencePipeline(
  params: RunDisputePipelineParams
): Promise<DisputeCaseAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "DAN_MA_GEMINI_API_KEY_CUA_BAN_VAO_DAY") {
    throw new Error("GEMINI_API_KEY chưa được cấu hình hợp lệ ở phía server.");
  }

  const auditHistory: AuditLogEntry[] = [];
  const caseId = `TR-${Date.now().toString(36).toUpperCase()}`;

  // 1. Verify on-chain transaction via Avalanche RPC (giữ nguyên 100%)
  const rpcStart = Date.now();
  const netCfg = resolveAvalancheNetwork(params.network);
  const txResult = await verifyFujiTransaction(params.txHash, params.network);
  logPipelineStage({
    stage: "AVALANCHE_RPC_VERIFY",
    durationMs: Date.now() - rpcStart,
    status: txResult.success ? "OK" : "ERROR",
    errorCode: txResult.success ? undefined : txResult.error.code,
  });

  auditHistory.push({
    timestamp: new Date().toISOString(),
    actor: "SYSTEM_AVALANCHE_RPC",
    action: txResult.success
      ? "VERIFIED_ONCHAIN_TRANSACTION"
      : "FAILED_ONCHAIN_TRANSACTION_VERIFICATION",
    detail: txResult.success
      ? `Xác minh thành công giao dịch ${txResult.data.transaction.hash} tại block ${txResult.data.transaction.blockNumber} trên ${netCfg.name} (Chain ID ${netCfg.chainId}).`
      : `Không xác minh được giao dịch (${txResult.error.code}): ${txResult.error.message}`,
  });

  const onChainVerification: DisputeCaseAnalysis["onChainVerification"] = {
    verified: txResult.success,
    networkName: netCfg.name,
    chainId: netCfg.chainId,
    txData: txResult.success ? txResult.data : null,
    verificationError: txResult.success ? undefined : txResult.error.message,
  };

  // 2. Record evidence SHA-256 commitments
  if (params.evidenceFiles.length > 0) {
    auditHistory.push({
      timestamp: new Date().toISOString(),
      actor: "EVIDENCE_HASHER",
      action: "COMPUTED_EVIDENCE_SHA256",
      detail: `Đã tạo mã băm cam kết SHA-256 cho ${params.evidenceFiles.length} tệp bằng chứng: ${params.evidenceFiles
        .map((f) => `${f.fileName} (${f.sha256CommitmentHash.slice(0, 14)}...)`)
        .join(", ")}.`,
    });
  }

  // 3. Build compact payload + multimodal parts
  const ai = new GoogleGenAI({ apiKey });
  const { claimedAmount, claimedAsset } = parseClaimedAmountAndAsset(
    params.claimedAmountAvax,
    params.claimedAsset
  );

  const systemInstruction = `
Bạn là hệ thống AI Dispute Intelligence (AskPay • DoubtStamp • LegalMind) của TRUSTRECOVER trên mạng ${netCfg.name} (Chain ID ${netCfg.chainId}).
Nguyên tắc TUYỆT ĐỐI TRUNG THỰC:
1. AskPay: Chỉ dùng dữ kiện thật trong ONCHAIN_VERIFICATION_DATA. Nếu claimedAsset khác AVAX (VD: USDT.e, WETH.e, USDC), phải đối chiếu claimedAmount với decodedEvents ERC-20, tuyệt đối KHÔNG hiểu nhầm hoặc quy đổi thành AVAX. Phân biệt EOA với Smart Contract. Tách rõ: (a) Dữ kiện RPC, (b) Lời khai/Tài liệu, (c) Giới hạn chưa đủ cơ sở on-chain.
2. DoubtStamp: Đối chiếu tối đa 6 khía cạnh cốt lõi (Mạng/Chain ID, Tài sản/Đơn vị & Số lượng, Ví nhận/Contract, Tài liệu bằng chứng). Phân biệt giao dịch cấp phí gas với giao dịch rút tài sản; nếu lời khai nêu tổng thiệt hại toàn vụ nhưng TxHash chỉ là 1 giao dịch thành phần, ghi rõ PARTIAL/CONTRADICTED ở quy mô và nêu missingEvidence. Không tự bịa hash hay nâng điểm. Verdict: VERIFIED | CONTRADICTED | INSUFFICIENT | UNVERIFIABLE.
3. LegalMind: Lập tối đa 5 bước disputeChecklist, missingEvidenceSteps, platformEscalationGuidance. Hướng dẫn tra cứu tại ${netCfg.explorerTxBase}. Đối chiếu pháp luật thực tế (VD Việt Nam: BLDS 2015 Điều 579, 584; BLHS 2015 sửa đổi 2017 Điều 289, 290; Luật An ninh mạng 2018). Không tuyên bố đảo ngược giao dịch blockchain; không thay thế Human Reviewer.
Trả lời bằng tiếng Việt súc tích, đúng JSON schema.`.trim();

  const promptPayload = {
    USER_CLAIM: params.userClaim,
    claimedAmount,
    claimedAsset,
    claimedRecipient: params.claimedRecipient ?? null,
    ONCHAIN_VERIFICATION_DATA: txResult.success ? txResult.data : { verified: false, error: txResult.error },
    EVIDENCE_FILES: params.evidenceFiles.map(({ inlineDataBase64, ...meta }) => ({
      ...meta,
      attachedAsMultimodal: Boolean(inlineDataBase64),
    })),
  };

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    {
      text: `Phân tích hồ sơ tranh chấp DeFi sau và trả về JSON đúng schema:\n${JSON.stringify(promptPayload)}`,
    },
  ];

  for (const f of params.evidenceFiles) {
    if (f.inlineDataBase64) {
      parts.push({
        inlineData: {
          mimeType: f.mimeType,
          data: f.inlineDataBase64,
        },
      });
    }
  }

  const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.5-flash"];
  const deadlineAt = Date.now() + OVERALL_AI_DEADLINE_MS;
  const attempts: AiAttemptLog[] = [];

  let usedModel = candidateModels[0];
  let parsed: z.infer<typeof AiInvestigationZodSchema> | null = null;
  let lastError: unknown = null;
  let allTransient = true;

  for (let idx = 0; idx < candidateModels.length; idx++) {
    const candidate = candidateModels[idx];
    const remainingMs = deadlineAt - Date.now();
    if (remainingMs < MIN_REMAINING_FOR_FALLBACK_MS) {
      lastError = new Error("Đã hết thời gian ngân sách tổng thể (48s) cho pipeline AI.");
      break;
    }

    const attemptTimeoutMs = Math.min(remainingMs, PER_ATTEMPT_CAP_MS);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attemptTimeoutMs);
    const attemptStart = Date.now();
    usedModel = candidate;

    try {
      const res = await ai.models.generateContent({
        model: candidate,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 4096,
          abortSignal: controller.signal,
        },
      });

      const rawText = (res.text || "").replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      if (!rawText) {
        throw new Error("INVALID_AI_JSON_STRUCTURE: Phản hồi AI rỗng.");
      }

      const firstBrace = rawText.indexOf("{");
        const lastBrace = rawText.lastIndexOf("}");
        const jsonCandidate = firstBrace !== -1 && lastBrace > firstBrace ? rawText.slice(firstBrace, lastBrace + 1) : rawText;
        let rawJson: unknown;
        try {
          rawJson = JSON.parse(jsonCandidate);
      } catch {
        throw new Error("INVALID_AI_JSON_STRUCTURE: Đầu ra AI không phải JSON hợp lệ.");
      }

      const validated = AiInvestigationZodSchema.safeParse(rawJson);
      if (!validated.success) {
        throw new Error(
          `INVALID_AI_JSON_STRUCTURE: JSON sai schema (${validated.error.issues[0]?.path.join(".") || "root"}).`
        );
      }

      parsed = validated.data;
      logPipelineStage({
        stage: "AI_ANALYSIS",
        durationMs: Date.now() - attemptStart,
        status: "OK",
        model: candidate,
        retryCount: idx,
        mimeType: params.evidenceFiles[0]?.mimeType,
        sizeBytes: params.evidenceFiles.reduce((acc, f) => acc + f.sizeBytes, 0),
      });
      break;
    } catch (err) {
      const durationMs = Date.now() - attemptStart;
      const { transient, errorStatus, errorCode, retryAfterMs } = classifyAiError(err);
      attempts.push({ model: candidate, errorStatus, errorCode, retryCount: idx, durationMs });

      logPipelineStage({
        stage: "AI_ANALYSIS",
        durationMs,
        status: "ERROR",
        model: candidate,
        errorStatus,
        errorCode,
        retryCount: idx,
        mimeType: params.evidenceFiles[0]?.mimeType,
        sizeBytes: params.evidenceFiles.reduce((acc, f) => acc + f.sizeBytes, 0),
      });

      lastError = err;
      if (!transient) {
        allTransient = false;
        break;
      }

      const timeLeft = deadlineAt - Date.now();
      const backoffMs =
        retryAfterMs !== undefined
          ? retryAfterMs <= 4_000 && timeLeft - retryAfterMs >= MIN_REMAINING_FOR_FALLBACK_MS
            ? retryAfterMs
            : 0
          : errorCode === "HTTP_503" && timeLeft >= MIN_REMAINING_FOR_FALLBACK_MS + 800
          ? 700 * (idx + 1)
          : 0;

      if (backoffMs > 0 && idx < candidateModels.length - 1) {
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  if (!parsed) {
    if (allTransient) {
      throw new AiServiceUnavailableError({
        message: "Các mô hình Gemini hiện đang quá tải hoặc chạm giới hạn tạm thời (503/429/Timeout). Đã bảo toàn kết quả xác minh Avalanche RPC.",
        attempts,
        onChainVerification,
        auditHistory,
      });
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Không thể hoàn tất phân tích AI.");
  }

  const cleanEvidence = params.evidenceFiles.map(({ inlineDataBase64, ...rest }) => rest);

  const { crossEngineCheck, recoveryReadiness } = evaluateCrossEngineAndReadiness({
    txResult,
    evidenceFiles: cleanEvidence,
    askPay: parsed.askPay,
    doubtStamp: parsed.doubtStamp,
    legalMind: parsed.legalMind,
  });

  parsed.doubtStamp.evidenceSufficiencyScore = recoveryReadiness.score;
  auditHistory.push({
    timestamp: new Date().toISOString(),
    actor: "GEMINI_AI_PIPELINE",
    action: "CROSS_ENGINE_CONSISTENCY_CHECK",
    detail: `Kiểm tra chéo 3 engine: ${crossEngineCheck.consistent ? "Đồng nhất" : "Phát hiện " + crossEngineCheck.conflictsDetected.length + " xung đột"}. Đã hoàn tất phân tích AskPay, DoubtStamp (${parsed.doubtStamp.findings.length} điểm đối chiếu, điểm đủ bằng chứng: ${parsed.doubtStamp.evidenceSufficiencyScore}/100) và LEGALMIND bằng mô hình ${usedModel}.`,
  });

  return {
    caseId,
    createdAt: new Date().toISOString(),
    humanReviewStatus: "PENDING_HUMAN_REVIEW",
    userInput: {
      txHash: params.txHash,
      userClaim: params.userClaim,
      claimedAmountAvax: params.claimedAmountAvax,
      claimedRecipient: params.claimedRecipient,
      evidenceFiles: cleanEvidence,
    },
    onChainVerification,
    aiInvestigation: {
      modelUsed: usedModel,
      askPay: parsed.askPay,
      doubtStamp: parsed.doubtStamp,
      legalMind: parsed.legalMind,
    },
    crossEngineCheck,
    recoveryReadiness,
    auditHistory,
  };
}