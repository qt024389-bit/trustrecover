import { GoogleGenAI, Type, Schema } from "@google/genai";
import { verifyFujiTransaction } from "@/lib/avalanche/verifyTransaction";
import { resolveAvalancheNetwork } from "@/lib/avalanche/networks";
import { evaluateCrossEngineAndReadiness } from "./consistencyAndScoring";
import type {
  DisputeCaseAnalysis,
  EvidenceFileMeta,
  AuditLogEntry,
} from "./types";

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
        verifiedBlockchainFacts: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        unverifiedOrInsufficientData: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        warnings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
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
                enum: [
                  "VERIFIED",
                  "CONTRADICTED",
                  "INSUFFICIENT",
                  "UNVERIFIABLE",
                ],
              },
              reasoning: { type: Type.STRING },
              dataSource: {
                type: Type.STRING,
                enum: [
                  "AVALANCHE_ONCHAIN_RPC",
                  "USER_EVIDENCE_FILE",
                  "CROSS_CHECK",
                ],
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
        contradictions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        missingEvidence: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
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
              priority: {
                type: Type.STRING,
                enum: ["HIGH", "MEDIUM", "LOW"],
              },
            },
            required: ["step", "category", "title", "description", "priority"],
          },
        },
        missingEvidenceSteps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        platformEscalationGuidance: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        technicalVsLegalDistinction: { type: Type.STRING },
        legalReferencesAndScope: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        mandatoryDisclaimers: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
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

export interface RunDisputePipelineParams {
  txHash: string;
  userClaim: string;
  claimedAmountAvax?: string;
  claimedRecipient?: string;
  evidenceFiles: EvidenceFileMeta[];
  network?: string;
}

export async function runDisputeIntelligencePipeline(
  params: RunDisputePipelineParams
): Promise<DisputeCaseAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "DAN_MA_GEMINI_API_KEY_CUA_BAN_VAO_DAY") {
    throw new Error(
      "GEMINI_API_KEY chưa được cấu hình hợp lệ trong .env.local ở phía server."
    );
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
  const auditHistory: AuditLogEntry[] = [];
  const caseId = `TR-${Date.now().toString(36).toUpperCase()}`;

  // 1. Verify on-chain transaction via Avalanche RPC (dynamic network + eth_chainId)
  const netCfg = resolveAvalancheNetwork(params.network);
  const txResult = await verifyFujiTransaction(params.txHash, params.network);
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

  // 3. Call Gemini API with strict grounding prompt
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
Bạn là hệ thống AI Dispute Intelligence của TRUSTRECOVER đang xác minh trên mạng ${netCfg.name} (Chain ID ${netCfg.chainId}).
Bạn vận hành 3 module nối tiếp trên cùng một hồ sơ tranh chấp:
1. AskPay (Transaction Intelligence):
- Chỉ sử dụng dữ liệu on-chain thực tế được cung cấp trong trường ONCHAIN_VERIFICATION_DATA.
- Tuyệt đối KHÔNG tự bịa đặt bất kỳ số liệu giao dịch nào.
- Nếu giao dịch không tồn tại hoặc lỗi RPC (verified = false), phải cảnh báo rõ ràng trong warnings và txStatusSummary.
- Phân biệt rõ những sự kiện đã được xác minh trên blockchain (verifiedBlockchainFacts) và những thông tin ngoài chuỗi chưa đủ cơ sở (unverifiedOrInsufficientData).

2. DoubtStamp (Evidence Consistency Analysis):
- Đối chiếu từng chi tiết trong lời khai người dùng (USER_CLAIM, claimedAmountAvax, claimedRecipient) và tệp bằng chứng (EVIDENCE_FILES) với dữ liệu thực tế từ ${netCfg.name} (Chain ID ${netCfg.chainId}) trong ONCHAIN_VERIFICATION_DATA.
- PHÂN BIỆT 3 LỚP DỮ KIỆN (BẮT BUỘC):
  1) Dữ kiện blockchain đã xác minh (RPC): Chỉ gồm các trường có thật trong ONCHAIN_VERIFICATION_DATA (txHash, chainId=${netCfg.chainId}, from, to, value, logs, decodedEvents).
  2) Thông tin từ tài liệu / lời khai: Nội dung từ USER_CLAIM hoặc EVIDENCE_FILES (ví dụ báo cáo sự cố Vee Finance ~35M USD, ví tấn công công bố). Không được gán là dữ kiện on-chain nếu TxHash hiện tại chưa thể hiện.
  3) Suy luận AI: Nhận định điều tra, giả thuyết đối chiếu — phải nêu rõ là suy luận.
- NHẬN DIỆN GIAO DỊCH CHUẨN BỊ VS GIAO DỊCH KHAI THÁC: Nếu TxHash chỉ là giao dịch cấp phí gas/chuẩn bị (ví dụ 0.1 AVAX tới ví EOA) trong khi lời khai/báo cáo (như Vee Finance) nhắc tới thiệt hại lớn hoặc rút token (WETH.e/WBTC.e), PHẢI chỉ rõ đây mới là giao dịch chuẩn bị/liên quan ví chứ KHÔNG PHẢI giao dịch khai thác thực tế, và đề nghị cung cấp TxHash khai thác chính.
- KHÔNG TỰ TẠO CHỨNG CỨ & KHÔNG NÂNG ĐIỂM: Không bịa đặt số liệu/log ngoài RPC, không tự nâng điểm bằng chứng khi TxHash hiện tại chưa khớp với giao dịch khai thác chính.
- Phân loại từng điểm đối chiếu vào đúng 1 trong 4 nhãn:
  + VERIFIED: Khớp trực tiếp với dữ liệu on-chain đã xác minh.
  + CONTRADICTED: Mâu thuẫn trực tiếp với dữ liệu on-chain (ví dụ: khai chuyển 10 AVAX nhưng on-chain là 0 AVAX, hoặc khai sai địa chỉ ví nhận, sai trạng thái giao dịch).
  + INSUFFICIENT: Chưa đủ dữ liệu để kết luận (ví dụ: thỏa thuận miệng, ảnh chụp màn hình chưa có đối chiếu).
  + UNVERIFIABLE: Không thể xác minh bằng dữ liệu hiện có.
- QUY TẮC BẮT BUỘC VỀ HASH TỆP: Không bao giờ tuyên bố một tệp bằng chứng là sự thật chỉ vì đã tạo được mã băm SHA-256 của tệp đó. Phải nêu rõ SHA-256 chỉ chứng minh tính nhất quán toàn vẹn của tệp so với phiên bản đã nộp.

3. LEGALMIND (Recovery Intelligence):
- Dựa trên kết quả của AskPay và DoubtStamp để lập danh sách kiểm tra (disputeChecklist), các bước thu thập bằng chứng còn thiếu (missingEvidenceSteps) và hướng dẫn liên hệ nền tảng/đơn vị liên quan (platformEscalationGuidance).
- Phân biệt rõ hướng dẫn kỹ thuật (tra cứu ${netCfg.explorerTxBase}, kiểm tra quyền approve token, trích xuất log hợp đồng) với thông tin tham khảo pháp lý.
- Nếu đề cập quy định pháp luật tại Việt Nam (ví dụ Bộ luật Dân sự 2015 về giao dịch dân sự/nghĩa vụ hoàn trả tài sản không có căn cứ pháp luật hoặc quy định tố giác tội phạm mạng), phải ghi rõ nguồn văn bản và phạm vi áp dụng.
- TUYỆT ĐỐI KHÔNG cam kết lấy lại được tiền, KHÔNG tuyên bố có thể đảo ngược giao dịch đã xác nhận trên blockchain, và KHÔNG tự phán quyết cuối cùng thay cho Human Reviewer.
- Trả lời hoàn toàn bằng tiếng Việt chuyên nghiệp, rõ ràng, súc tích.
`.trim();

  const promptPayload = {
    CASE_ID: caseId,
    USER_CLAIM: {
      narrative: params.userClaim,
      claimedAmountAvax: params.claimedAmountAvax || null,
      claimedRecipient: params.claimedRecipient || null,
    },
    ONCHAIN_VERIFICATION_DATA: txResult.success
      ? txResult.data
      : {
          verifiedOnChain: false,
          error: txResult.error,
        },
    EVIDENCE_FILES: params.evidenceFiles.map(({ inlineDataBase64, ...rest }) => rest),
  };

  const candidateModels = Array.from(
    new Set(["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-3.7-flash"])
  );

  let response: Awaited<ReturnType<typeof ai.models.generateContent>> | null = null;
  let usedModel = modelName;
  let lastError: unknown = null;

  for (const candidate of candidateModels) {
    try {
      usedModel = candidate;
      console.log(`[TRUSTRECOVER AI] Calling model: ${candidate}...`);
      const apiPromise = ai.models.generateContent({
        model: candidate,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Hãy phân tích hồ sơ tranh chấp DeFi sau đây và trả về JSON theo đúng schema:\n${JSON.stringify(
                  promptPayload,
                  null,
                  2
                )}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 40000);
      const timeoutPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error(`Timeout sau 40s voi model ${candidate}`))
        );
      });
      try {
        response = await Promise.race([apiPromise, timeoutPromise]);
      } finally {
        clearTimeout(timer);
      }
      console.log(`[TRUSTRECOVER AI] Success with model: ${candidate}`);
      break;
    } catch (err) {
      lastError = err;
      console.error(`[TRUSTRECOVER AI] Model ${candidate} failed:`, err instanceof Error ? err.message : err);
    }
  }

  if (!response) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Các model Gemini hiện đang quá tải tạm thời (503).");
  }

  const rawText = response.text;
  if (!rawText) {
    throw new Error("Gemini API không trả về nội dung phân tích.");
  }

  const parsed = JSON.parse(rawText);
  const cleanEvidence = params.evidenceFiles.map(({ inlineDataBase64, ...rest }) => rest);

  const { crossEngineCheck, recoveryReadiness } = evaluateCrossEngineAndReadiness({
    txResult,
    evidenceFiles: cleanEvidence,
    askPay: parsed.askPay,
    doubtStamp: parsed.doubtStamp,
    legalMind: parsed.legalMind,
  });

  // Dong bo diem so chuan xac va ghi Audit Log kiem tra cheo
  parsed.doubtStamp.evidenceSufficiencyScore = recoveryReadiness.score;
  auditHistory.push({
    timestamp: new Date().toISOString(),
    actor: "GEMINI_AI_PIPELINE",
    action: "CROSS_ENGINE_CONSISTENCY_CHECK",
    detail: `Kiểm tra chéo 3 engine: ${crossEngineCheck.consistent ? "Đồng nhất" : "Phát hiện " + crossEngineCheck.conflictsDetected.length + " xung đột"}. Điểm Recovery Readiness: ${recoveryReadiness.score}/100.`,
  });

  auditHistory.push({
    timestamp: new Date().toISOString(),
    actor: "GEMINI_AI_PIPELINE",
    action: "COMPLETED_TRIPLE_ENGINE_ANALYSIS",
    detail: `Đã hoàn tất phân tích AskPay, DoubtStamp (${parsed.doubtStamp.findings.length} điểm đối chiếu, điểm đủ bằng chứng: ${parsed.doubtStamp.evidenceSufficiencyScore}/100) và LEGALMIND bằng mô hình ${modelName}.`,
  });

  auditHistory.push({
    timestamp: new Date().toISOString(),
    actor: "HUMAN_REVIEWER",
    action: "QUEUED_FOR_HUMAN_VALIDATION",
    detail:
      "Hồ sơ đã được chuyển sang trạng thái chờ kiểm duyệt viên con người (Human Reviewer) xác nhận kết quả cuối cùng.",
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
      evidenceFiles: params.evidenceFiles.map(({ inlineDataBase64, ...rest }) => rest),
    },
    onChainVerification: {
      verified: txResult.success,
      networkName: netCfg.name,
      chainId: netCfg.chainId,
      txData: txResult.success ? txResult.data : null,
      verificationError: txResult.success ? undefined : txResult.error.message,
    },
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