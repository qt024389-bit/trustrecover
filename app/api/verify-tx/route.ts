import { NextRequest, NextResponse } from "next/server";
import { verifyFujiTransaction } from "@/lib/avalanche/verifyTransaction";
import { VerificationErrorCode } from "@/lib/avalanche/types";

function mapErrorToStatus(code: VerificationErrorCode): number {
  switch (code) {
    case "INVALID_HASH":
      return 400;
    case "TX_NOT_FOUND":
      return 404;
    case "CHAIN_MISMATCH":
    case "RPC_ERROR":
      return 502;
    default:
      return 500;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || !("txHash" in body)) {
      return NextResponse.json(
        {
          success: false,
          verifiedOnChain: false,
          error: {
            code: "INVALID_HASH",
            message: "Body JSON phải chứa trường 'txHash'.",
          },
          queriedAt: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const result = await verifyFujiTransaction(
      (body as { txHash?: unknown }).txHash
    );

    if (!result.success) {
      return NextResponse.json(result, {
        status: mapErrorToStatus(result.error.code),
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        verifiedOnChain: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Lỗi hệ thống khi xử lý yêu cầu xác minh giao dịch.",
        },
        queriedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const txHash = request.nextUrl.searchParams.get("txHash");
  const result = await verifyFujiTransaction(txHash);

  if (!result.success) {
    return NextResponse.json(result, {
      status: mapErrorToStatus(result.error.code),
    });
  }

  return NextResponse.json(result, { status: 200 });
}