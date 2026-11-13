import { NextResponse } from "next/server";
import { Contract, JsonRpcProvider } from "ethers";
import {
  TRUSTRECOVER_FUJI_CHAIN_ID,
  TRUSTRECOVER_REGISTRY_ABI,
  TRUSTRECOVER_REGISTRY_ADDRESS,
} from "@/lib/avalanche/registryContract";

export interface OnChainAnchoredCase {
  caseId: string;
  txHash: string;
  reportHash: string;
  verdict: string;
  reviewer: string;
  anchoredAt: number;
}

export async function GET() {
  try {
    const rpcUrl =
      process.env.AVALANCHE_FUJI_RPC_URL ||
      "https://api.avax-test.network/ext/bc/C/rpc";

    const provider = new JsonRpcProvider(rpcUrl, {
      chainId: TRUSTRECOVER_FUJI_CHAIN_ID,
      name: "avalanche-fuji",
    });

    const contract = new Contract(
      TRUSTRECOVER_REGISTRY_ADDRESS,
      TRUSTRECOVER_REGISTRY_ABI,
      provider
    );

    const totalBigInt: bigint = await contract.getTotalCases();
    const totalCases = Number(totalBigInt);

    const limit = Math.min(totalCases, 10);
    const cases: OnChainAnchoredCase[] = [];

    for (let i = totalCases - 1; i >= totalCases - limit; i--) {
      const caseId: string = await contract.getCaseIdAt(i);
      const record = await contract.getCase(caseId);
      cases.push({
        caseId: record.caseId,
        txHash: record.txHash,
        reportHash: record.reportHash,
        verdict: record.verdict,
        reviewer: record.reviewer,
        anchoredAt: Number(record.anchoredAt),
      });
    }

    return NextResponse.json(
      {
        success: true,
        contractAddress: TRUSTRECOVER_REGISTRY_ADDRESS,
        chainId: TRUSTRECOVER_FUJI_CHAIN_ID,
        totalCases,
        cases,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REGISTRY_READ_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Không thể đọc dữ liệu từ Smart Contract trên Fuji.",
        },
      },
      { status: 500 }
    );
  }
}