import type { VerifyTransactionResult } from "@/lib/avalanche/types";
import type {
  AskPayReport,
  CrossEngineConsistencyReport,
  DoubtStampReport,
  EvidenceFileMeta,
  LegalMindReport,
  RecoveryReadinessFactor,
  RecoveryReadinessReport,
} from "./types";

export function evaluateCrossEngineAndReadiness(params: {
  txResult: VerifyTransactionResult;
  evidenceFiles: EvidenceFileMeta[];
  askPay: AskPayReport;
  doubtStamp: DoubtStampReport;
  legalMind: LegalMindReport;
}): {
  crossEngineCheck: CrossEngineConsistencyReport;
  recoveryReadiness: RecoveryReadinessReport;
} {
  const { txResult, evidenceFiles, askPay, doubtStamp, legalMind } = params;
  const conflicts: string[] = [];

  const hasVerifiedOnChain = txResult.success;
  const isConfirmedOnChain =
    txResult.success && txResult.data.receipt.status === "confirmed";

  const verifiedFindingsCount = doubtStamp.findings.filter(
    (f) => f.verdict === "VERIFIED"
  ).length;
  const contradictedFindingsCount = doubtStamp.findings.filter(
    (f) => f.verdict === "CONTRADICTED"
  ).length;

  // 1. Kiem tra cheo: Khong co Tx on-chain nhung DoubtStamp lai ket luan VERIFIED
  if (!hasVerifiedOnChain && verifiedFindingsCount > 0) {
    conflicts.push(
      "Mâu thuẫn giữa AskPay và DoubtStamp: Blockchain RPC không xác minh được giao dịch on-chain nhưng DoubtStamp lại gắn nhãn VERIFIED."
    );
  }

  // 2. Kiem tra cheo: Co mau thuan ro rang nhung LEGALMIND khong nhac toi hoac diem AI cao bat thuong
  if (contradictedFindingsCount > 0 && doubtStamp.evidenceSufficiencyScore > 60) {
    conflicts.push(
      `Mâu thuẫn điểm số: DoubtStamp phát hiện ${contradictedFindingsCount} điểm CONTRADICTED nhưng điểm ước lượng ban đầu vẫn cao (${doubtStamp.evidenceSufficiencyScore}/100).`
    );
  }

  // 3. Kiem tra cheo: AskPay co canh bao nhung LEGALMIND bo qua checklist
  if (askPay.warnings.length > 0 && legalMind.disputeChecklist.length === 0) {
    conflicts.push(
      "Mâu thuẫn giữa AskPay và LEGALMIND: AskPay ghi nhận cảnh báo nhưng LEGALMIND chưa sinh bước xử lý."
    );
  }

  const consistent = conflicts.length === 0;
  const requiresHumanReview =
    !consistent || !isConfirmedOnChain || contradictedFindingsCount > 0 || evidenceFiles.length === 0;

  let finalTransparentConclusion = "";
  if (!hasVerifiedOnChain) {
    finalTransparentConclusion =
      "Chưa đủ cơ sở xác minh giao dịch trên mạng Avalanche đã chọn. Cần kiểm tra lại Transaction Hash trước khi tiến hành bước tiếp theo (Bắt buộc Human Review).";
  } else if (contradictedFindingsCount > 0) {
    finalTransparentConclusion = `Giao dịch đã xác nhận trên blockchain nhưng phát hiện ${contradictedFindingsCount} điểm mâu thuẫn trực tiếp giữa lời khai và dữ liệu on-chain. Cần Human Reviewer đối chiếu bổ sung.`;
  } else if (evidenceFiles.length === 0) {
    finalTransparentConclusion =
      "Dữ liệu giao dịch on-chain khớp với lời khai kỹ thuật, nhưng vẫn thiếu tệp bằng chứng ngoài chuỗi để kết luận toàn diện tranh chấp.";
  } else {
    finalTransparentConclusion =
      "Cả 3 tầng AskPay, DoubtStamp và LEGALMIND đồng nhất: dữ liệu on-chain và bằng chứng đính kèm đủ cơ sở để Human Reviewer xem xét neo lên Avalanche.";
  }

  // 4. Tinh diem Recovery Readiness Score minh bach theo tung yeu to
  const factors: RecoveryReadinessFactor[] = [];

  const txPoints = isConfirmedOnChain ? 30 : hasVerifiedOnChain ? 10 : 0;
  factors.push({
    factor: "Xác minh giao dịch On-Chain (Blockchain RPC)",
    points: txPoints,
    maxPoints: 30,
    status: txPoints === 30 ? "PASS" : txPoints > 0 ? "PARTIAL" : "MISSING",
    explanation: isConfirmedOnChain
      ? "Giao dịch tồn tại và đã xác nhận (CONFIRMED) trên mạng Avalanche đã chọn."
      : hasVerifiedOnChain
      ? "Giao dịch tồn tại nhưng chưa xác nhận thành công (pending/failed)."
      : "Không tìm thấy hoặc không đọc được giao dịch trên Blockchain RPC.",
  });

  const claimPoints =
    contradictedFindingsCount > 0 ? 0 : verifiedFindingsCount > 0 ? 25 : 10;
  factors.push({
    factor: "Độ nhất quán Lời khai vs On-Chain",
    points: claimPoints,
    maxPoints: 25,
    status: claimPoints === 25 ? "PASS" : claimPoints > 0 ? "PARTIAL" : "MISSING",
    explanation:
      contradictedFindingsCount > 0
        ? `Phát hiện ${contradictedFindingsCount} điểm mâu thuẫn trực tiếp (CONTRADICTED).`
        : verifiedFindingsCount > 0
        ? `Có ${verifiedFindingsCount} luận điểm khớp trực tiếp với dữ liệu blockchain.`
        : "Chưa đủ điểm đối chiếu khớp trực tiếp.",
  });

  const evidencePoints = evidenceFiles.length > 0 ? 20 : 0;
  factors.push({
    factor: "Tệp bằng chứng ngoài chuỗi đính kèm",
    points: evidencePoints,
    maxPoints: 20,
    status: evidencePoints === 20 ? "PASS" : "MISSING",
    explanation:
      evidenceFiles.length > 0
        ? `Đã nộp ${evidenceFiles.length} tệp kèm mã băm toàn vẹn SHA-256.`
        : "Chưa có tệp bằng chứng đính kèm (hợp đồng, ảnh chụp, biên nhận).",
  });

  const hasRichOnChain =
    txResult.success &&
    (txResult.data.receipt.logsCount > 0 || Boolean(txResult.data.recipientProfile));
  const contextPoints = hasRichOnChain ? 15 : 0;
  factors.push({
    factor: "Dữ liệu Logs & Hồ sơ Ví/Contract đích",
    points: contextPoints,
    maxPoints: 15,
    status: contextPoints === 15 ? "PASS" : "MISSING",
    explanation: hasRichOnChain
      ? "Đã trích xuất được Event Logs / Address Profiling của địa chỉ nhận."
      : "Không có dữ liệu logs hoặc hồ sơ hợp đồng đích.",
  });

  const consistencyPoints = consistent ? 10 : 0;
  factors.push({
    factor: "Kiểm tra chéo 3 AI Engines",
    points: consistencyPoints,
    maxPoints: 10,
    status: consistencyPoints === 10 ? "PASS" : "MISSING",
    explanation: consistent
      ? "AskPay, DoubtStamp và LEGALMIND không có kết luận xung đột."
      : `Phát hiện ${conflicts.length} xung đột giữa các engine.`,
  });

  let rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  let capApplied: string | undefined = undefined;

  if (!hasVerifiedOnChain && rawScore > 25) {
    rawScore = 25;
    capApplied = "Giới hạn trần 25/100 vì thiếu bằng chứng giao dịch xác thực trên mạng Avalanche đã chọn.";
  } else if (contradictedFindingsCount > 0 && rawScore > 40) {
    rawScore = 40;
    capApplied = "Giới hạn trần 40/100 vì lời khai có điểm mâu thuẫn trực tiếp với dữ liệu on-chain.";
  }

  const level =
    rawScore >= 75
      ? "HIGH"
      : rawScore >= 50
      ? "MODERATE"
      : rawScore >= 26
      ? "LOW"
      : "CRITICAL_GAP";

  return {
    crossEngineCheck: {
      consistent,
      requiresHumanReview,
      conflictsDetected: conflicts,
      finalTransparentConclusion,
    },
    recoveryReadiness: {
      score: rawScore,
      level,
      capApplied,
      factors,
      summary: `Điểm sẵn sàng xử lý tranh chấp: ${rawScore}/100 (${level}).`,
    },
  };
}