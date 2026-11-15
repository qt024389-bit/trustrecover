"use client";

import React, { useState } from "react";
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from "ethers";
import {
  SNOWTRACE_FUJI_URL,
  TRUSTRECOVER_FUJI_CHAIN_ID,
  TRUSTRECOVER_REGISTRY_ABI,
  TRUSTRECOVER_REGISTRY_ADDRESS,
} from "@/lib/avalanche/registryContract";
import type { DisputeCaseAnalysis } from "@/lib/dispute/types";

interface VerifyReportResult {
  matched: boolean;
  caseId: string;
  localHash: string;
  onChainHash: string;
  reviewer: string;
  verdict: string;
  anchoredAt: number;
}

export default function ReportIntegrityVerifier() {
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyReportResult | null>(
    null
  );

  async function handleFileCheck(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setChecking(true);
    setErrorMsg(null);
    setVerifyResult(null);

    try {
      const text = await file.text();
      const analysis = JSON.parse(text) as DisputeCaseAnalysis;

      if (!analysis?.caseId || !analysis?.aiInvestigation?.doubtStamp) {
        throw new Error(
          "Tệp JSON không đúng định dạng báo cáo TRUSTRECOVER."
        );
      }

      const reportPayload = JSON.stringify({
        caseId: analysis.caseId,
        txHash: analysis.userInput.txHash.trim(),
        score: analysis.aiInvestigation.doubtStamp.evidenceSufficiencyScore,
        findings: analysis.aiInvestigation.doubtStamp.findings,
        askPaySummary: analysis.aiInvestigation.askPay.txStatusSummary,
      });
      const localHash = keccak256(toUtf8Bytes(reportPayload));

      const provider = new JsonRpcProvider(
        "https://api.avax-test.network/ext/bc/C/rpc",
        { chainId: TRUSTRECOVER_FUJI_CHAIN_ID, name: "avalanche-fuji" }
      );
      const contract = new Contract(
        TRUSTRECOVER_REGISTRY_ADDRESS,
        TRUSTRECOVER_REGISTRY_ABI,
        provider
      );

      const onChainRecord = await contract.getCase(analysis.caseId);
      const anchoredAt = Number(onChainRecord.anchoredAt);

      if (anchoredAt === 0) {
        throw new Error(
          `Hồ sơ ${analysis.caseId} chưa từng được neo lên Smart Contract v2 trên Avalanche Fuji.`
        );
      }

      const onChainHash: string = onChainRecord.reportHash;
      setVerifyResult({
        matched: localHash.toLowerCase() === onChainHash.toLowerCase(),
        caseId: analysis.caseId,
        localHash,
        onChainHash,
        reviewer: onChainRecord.reviewer,
        verdict: onChainRecord.verdict,
        anchoredAt,
      });
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Không thể đối chiếu tệp báo cáo với Avalanche Fuji."
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-500/25 bg-[#111b2d] p-6 text-xs text-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="inline-block rounded-full bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-cyan-300">
            CRYPTOGRAPHIC TAMPER DETECTION
          </span>
          <h3 className="mt-2 text-base font-bold text-white">
            Kiểm chứng Toàn vẹn Báo cáo Đối chiếu On-Chain
          </h3>
          <p className="mt-1 text-slate-400">
            Tải lên tệp <span className="font-mono text-cyan-300">.json</span> đã xuất để kiểm tra xem nội dung báo cáo có bị chỉnh sửa so với mã băm gốc trên Avalanche Fuji hay không.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="file"
          accept=".json"
          onChange={handleFileCheck}
          disabled={checking}
          className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-cyan-200 hover:file:bg-cyan-500/30"
        />
      </div>

      {checking && (
        <p className="mt-3 font-mono text-cyan-300">
          Đang tính keccak256 và đối chiếu với Smart Contract trên Fuji...
        </p>
      )}

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-rose-200">
          {errorMsg}
        </div>
      )}

      {verifyResult && (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            verifyResult.matched
              ? "border-emerald-500/40 bg-emerald-950/25"
              : "border-rose-500/40 bg-rose-950/35"
          }`}
        >
          <div
            className={`text-sm font-bold ${
              verifyResult.matched ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {verifyResult.matched
              ? "✓ TOÀN VẸN 100% — Báo cáo khớp hoàn toàn với bản gốc trên Avalanche Fuji!"
              : "✕ CẢNH BÁO GIẢ MẠO — Nội dung tệp báo cáo đã bị chỉnh sửa so với Avalanche Fuji!"}
          </div>

          <div className="mt-3 space-y-1.5 break-all font-mono text-[11px] text-slate-300">
            <div>Case ID: {verifyResult.caseId}</div>
            <div>Hash tính từ file: {verifyResult.localHash}</div>
            <div>Hash gốc trên Fuji: {verifyResult.onChainHash}</div>
            <div>
              Reviewer:{" "}
              <a
                href={`${SNOWTRACE_FUJI_URL}/address/${verifyResult.reviewer}`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-300 underline"
              >
                {verifyResult.reviewer} ↗
              </a>
            </div>
            <div>
              Thời điểm neo:{" "}
              {new Date(verifyResult.anchoredAt * 1000).toLocaleString("vi-VN")}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}