import { NextRequest, NextResponse } from "next/server";
import { processUploadedEvidenceFiles } from "@/lib/dispute/evidence";
import { runDisputeIntelligencePipeline } from "@/lib/dispute/geminiPipeline";
import type { EvidenceFileMeta } from "@/lib/dispute/types";
import { checkRateLimit } from "@/lib/security/rateLimit";

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for") || "local";
  const rl = checkRateLimit("dispute:" + clientIp);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: { code: "RATE_LIMIT_EXCEEDED", message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút." } }, { status: 429 });
  }
  try {
    const contentType = request.headers.get("content-type") || "";
    let txHash = "";
    let userClaim = "";
    let claimedAmountAvax = "";
    let claimedRecipient = "";
    let evidenceFiles: EvidenceFileMeta[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      txHash = String(formData.get("txHash") || "").trim();
      userClaim = String(formData.get("userClaim") || "").trim();
      claimedAmountAvax = String(formData.get("claimedAmountAvax") || "").trim();
      claimedRecipient = String(formData.get("claimedRecipient") || "").trim();

      const rawFiles = formData
        .getAll("evidenceFiles")
        .filter((item): item is File => item instanceof File && item.size > 0);

      const { processed, errors } = await processUploadedEvidenceFiles(rawFiles);
      if (errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_EVIDENCE_FILE",
              message: errors.join(" "),
            },
          },
          { status: 400 }
        );
      }
      evidenceFiles = processed;
    } else {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_PAYLOAD",
              message: "Dữ liệu gửi lên không hợp lệ.",
            },
          },
          { status: 400 }
        );
      }
      txHash = String(body.txHash || "").trim();
      userClaim = String(body.userClaim || "").trim();
      claimedAmountAvax = String(body.claimedAmountAvax || "").trim();
      claimedRecipient = String(body.claimedRecipient || "").trim();
    }

    if (!txHash) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "MISSING_TX_HASH",
            message: "Vui lòng nhập Transaction Hash trên Avalanche Fuji Testnet.",
          },
        },
        { status: 400 }
      );
    }

    if (!userClaim || userClaim.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_USER_CLAIM",
            message:
              "Nội dung khiếu nại (User Claim) phải có ít nhất 10 ký tự để AI đối chiếu với dữ liệu on-chain.",
          },
        },
        { status: 400 }
      );
    }

    const analysis = await runDisputeIntelligencePipeline({
      txHash,
      userClaim,
      claimedAmountAvax: claimedAmountAvax || undefined,
      claimedRecipient: claimedRecipient || undefined,
      evidenceFiles,
    });

    return NextResponse.json(
      {
        success: true,
        data: analysis,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Lỗi không xác định trong quá trình phân tích tranh chấp.";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PIPELINE_EXECUTION_ERROR",
          message: message.replace(/AIza[A-Za-z0-9_-]+|AQ[A-Za-z0-9_-]+/g, "[REDACTED_KEY]"),
        },
      },
      { status: 500 }
    );
  }
}