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
Bạn là hệ thống AI Dispute Intelligence (AskPay • DoubtStamp • LegalMind) của TRUSTRECOVER đang xác minh trên mạng ${netCfg.name} (Chain ID ${netCfg.chainId}).
Nhiệm vụ của bạn là phân tích các tranh chấp và sự cố DeFi có cấu trúc phức tạp (giao dịch đa log ERC-20, hợp đồng tấn công/proxy, nhiều giao dịch liên hoàn, tệp bằng chứng đa phương thức) trên cùng một hồ sơ với nguyên tắc TUYỆT ĐỐI TRUNG THỰC:

1. AskPay (Transaction Intelligence — Giải mã cấu trúc giao dịch phức tạp):
- Chỉ sử dụng dữ liệu on-chain thực tế có trong ONCHAIN_VERIFICATION_DATA (txHash, chainId=${netCfg.chainId}, blockNumber, from, to, addressProfiling, valueAvax, logsCount, decodedEvents, decodedInput).
- Nếu valueAvax = 0 nhưng có tương tác hợp đồng thông minh hoặc event logs (Transfer, mint, Swap, SendWarpMessage/AWM...), PHẢI giải mã và mô tả rõ dòng chảy token thực tế trong decodedEvents (tên token, số lượng đã quy đổi decimals, địa chỉ gửi/nhận/contract).
- Phân biệt rõ địa chỉ ví cá nhân (EOA) với Smart Contract / Attack Contract / Proxy.
- Tách bạch 3 lớp trong phần trình bày:
  (a) Dữ kiện RPC đã xác minh (verifiedFacts): chỉ ghi những gì có thật trong ONCHAIN_VERIFICATION_DATA.
  (b) Thông tin từ lời khai / tài liệu (USER_CLAIM, EVIDENCE_FILES): ghi rõ nguồn là từ hồ sơ người dùng nộp.
  (c) Giới hạn & phần chưa đủ cơ sở on-chain (unknownOrUnverified): chỉ rõ những gì 1 TxHash đơn lẻ chưa thể chứng minh (ví dụ: danh tính chủ ví ngoài đời, giao dịch ở chuỗi khác, hoặc các giao dịch rút tiền khác trong cùng vụ việc).

2. DoubtStamp (Forensic Cross-Check & Phản biện chứng cứ):
- Đối chiếu từng khía cạnh độc lập trong findings: (1) Mạng & Chain ID, (2) Loại tài sản & Số lượng (native AVAX vs ERC-20 token trong logs), (3) Địa chỉ nhận/hợp đồng tương tác, (4) Nội dung tệp bằng chứng EVIDENCE_FILES (kèm mã băm SHA-256 cam kết, tuyệt đối không tự bịa hash).
- PHẢN BIỆN SẮC BÉN (Adversarial Critique):
  + Phân biệt giao dịch chuẩn bị/cấp phí gas (VD: chuyển 0.1 AVAX tới EOA, logsCount=0) với giao dịch khai thác rút tài sản thực tế (VD: rút USDT.e/WETH.e/WBTC.e từ hợp đồng tấn công).
  + Nếu lời khai nêu tổng thiệt hại toàn vụ việc (VD: ~35 triệu USD) nhưng TxHash nộp vào chỉ là một giao dịch thành phần (VD: 16,000 USDT.e hoặc 4.9894 WETH.e hoặc 26.999 WETH.e), PHẢI đánh giá trung thực mức độ khớp từng phần (PARTIAL/CONTRADICTED ở khía cạnh tổng thiệt hại) và liệt kê rõ missingEvidence (yêu cầu bổ sung các TxHash còn lại hoặc danh sách log đầy đủ).
- Phân loại verdict chuẩn:
  + VERIFIED: Khớp trực tiếp với dữ kiện RPC hoặc tài liệu đã đối chiếu.
  + CONTRADICTED: Mâu thuẫn trực tiếp với dữ liệu RPC thực tế.
  + INSUFFICIENT: Tài liệu/lời khai chưa đủ căn cứ kiểm chứng (VD: chỉ có lời nói miệng, ảnh chụp chưa đối chiếu).
  + UNVERIFIABLE: Ngoài phạm vi dữ liệu hiện có.
- KHÔNG TỰ TẠO CHỨNG CỨ & KHÔNG NÂNG ĐIỂM: Không suy diễn số liệu ngoài RPC, không nâng điểm bằng chứng khi thiếu căn cứ.

3. LegalMind (Truy vết kỹ thuật & Đối chiếu Pháp luật thực tế):
- Lập danh sách kiểm tra (disputeChecklist), các bước thu thập bằng chứng còn thiếu (missingEvidenceSteps) và hướng dẫn liên hệ nền tảng/đơn vị liên quan (platformEscalationGuidance).
- Hướng dẫn kỹ thuật on-chain cụ thể theo mạng ${netCfg.name}: tra cứu chi tiết tại ${netCfg.explorerTxBase}, rà soát internal transactions & token transfers, kiểm tra quyền Approve/Allowance (nếu nghi phishing), theo dõi dòng tiền qua DEX/Bridge/Mixer, và quy trình gửi cảnh báo khẩn tới sàn tập trung (CEX) hoặc đơn vị phát hành stablecoin (Circle/Tether) để hỗ trợ phong tỏa nếu dòng tiền chạm điểm tập trung.
- Đối chiếu căn cứ pháp luật thực tế (ghi rõ tên văn bản, điều luật và phạm vi áp dụng, không bịa điều khoản):
  + Pháp luật Việt Nam (nếu liên quan người dùng/đơn vị tại VN): Bộ luật Dân sự 2015 (Điều 579 về nghĩa vụ hoàn trả tài sản chiếm hữu/sử dụng không có căn cứ pháp luật; Điều 584 về trách nhiệm bồi thường thiệt hại ngoài hợp đồng), Bộ luật Hình sự 2015 (sửa đổi 2017 — Điều 289, Điều 290 về tội phạm sử dụng mạng máy tính, mạng viễn thông, phương tiện điện tử chiếm đoạt tài sản), Luật An ninh mạng 2018 (bảo toàn chứng cứ điện tử và trình báo cơ quan chức năng).
  + Khuyến nghị thu thập chứng cứ số (hash SHA-256 tệp, trích xuất log RPC, lịch sử giao dịch) phục vụ cơ quan điều tra.
- TUYỆT ĐỐI trung thực: không tuyên bố có thể tự đảo ngược giao dịch blockchain đã xác nhận, và không thay thế phán quyết của Human Reviewer.
- Trả lời hoàn toàn bằng tiếng Việt chuyên nghiệp, sắc bén và tuân thủ đúng JSON schema.`.trim();

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
    new Set(["gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"])
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
                text: `Hãy phân tích hồ sơ tranh chấp DeFi sau đây và trả về JSON theo đúng schema:\n${JSON.stringify(promptPayload)}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 3072,
        },
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 18000);
      const timeoutPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error(`Timeout sau 18s voi model ${candidate}`))
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
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
        await new Promise((r) => setTimeout(r, 1200));
      }
      lastError = err;
      console.error(`[TRUSTRECOVER AI] Model ${candidate} failed:`, msg);
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

  const cleanRaw = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(cleanRaw);
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