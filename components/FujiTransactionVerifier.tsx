"use client";

import React, { useEffect, useState } from "react";
import type { VerifyTransactionResult } from "@/lib/avalanche/types";

const SAMPLE_REAL_FUJI_HASH =
  "0x75e0dcfadff069af83e0c15369da717d5cfad1e358f2e56f54296f263492e8df";

export default function FujiTransactionVerifier({
  prefillTxHash,
}: {
  prefillTxHash?: { nonce: number; txHash: string } | null;
}) {
  const [txHash, setTxHash] = useState("");
  const [network, setNetwork] = useState<"fuji" | "dispatch" | "mainnet">("fuji");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyTransactionResult | null>(null);

  useEffect(() => {
    if (prefillTxHash?.txHash) {
      setTxHash(prefillTxHash.txHash);
    }
  }, [prefillTxHash]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/verify-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash, network }),
      });
      const data: VerifyTransactionResult = await response.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        verifiedOnChain: false,
        error: {
          code: "RPC_ERROR",
          message: "Không thể kết nối tới máy chủ xác minh giao dịch.",
        },
        queriedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-slate-100 shadow-xl backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
            Avalanche Fuji Testnet • Chain ID 43113
          </span>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Avalanche Transaction Verification Engine
          </h2>
          <p className="text-xs text-slate-400">
            Xác minh trực tiếp giao dịch thực tế trên Fuji RPC qua Server API (ethers.js)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTxHash(SAMPLE_REAL_FUJI_HASH)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
        >
          Dùng TxHash Fuji mẫu
        </button>
      </div>

      <form onSubmit={handleVerify} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <select
          value={network}
          onChange={(e) => setNetwork(e.target.value as "fuji" | "dispatch" | "mainnet")}
          className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
        >
          <option value="fuji">Fuji C-Chain (43113)</option>
          <option value="dispatch">Dispatch L1 (779672)</option>
          <option value="mainnet">Avalanche Mainnet (43114)</option>
        </select>
        <input
          type="text"
          value={txHash}
          onChange={(e) => setTxHash(e.target.value)}
          placeholder="Nhập Transaction Hash (0x + 64 ký tự hex)..."
          className="flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-2.5 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {loading ? "Đang truy vấn Fuji RPC..." : "Xác minh On-Chain"}
        </button>
      </form>

      {result && !result.success && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-4 text-xs text-rose-200">
          <div className="font-semibold text-rose-400">
            Xác minh thất bại — Mã lỗi: {result.error.code}
          </div>
          <p className="mt-1">{result.error.message}</p>
          <p className="mt-1 text-[11px] text-rose-300/70">
            verifiedOnChain: false • Thời gian: {result.queriedAt}
          </p>
        </div>
      )}

      {result && result.success && (
        <div className="mt-4 space-y-4 rounded-xl border border-emerald-500/30 bg-slate-950/70 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <span className="font-semibold text-emerald-400">
              ✓ Đã xác minh trên {result.data.network.name} (Chain ID: {result.data.network.chainId})
            </span>
            <span className="rounded-md bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[11px] uppercase text-emerald-300">
              Status: {result.data.receipt.status} ({result.data.receipt.statusCode})
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="text-slate-400">Block Number:</span>
              <div className="font-mono text-slate-100">{result.data.transaction.blockNumber}</div>
            </div>
            <div>
              <span className="text-slate-400">Giá trị (Value):</span>
              <div className="font-mono text-slate-100">
                {result.data.transaction.valueAvax} AVAX ({result.data.transaction.valueWei} Wei)
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400">Người gửi (From):</span>
              <div className="break-all font-mono text-slate-200">{result.data.transaction.from}</div>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400">Người nhận / Contract (To):</span>
              <div className="break-all font-mono text-slate-200">
                {result.data.transaction.to ?? "Contract Creation"}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Gas Used:</span>
              <div className="font-mono text-slate-200">{result.data.receipt.gasUsed}</div>
            </div>
            <div>
              <span className="text-slate-400">Số lượng Logs:</span>
              <div className="font-mono text-slate-200">{result.data.receipt.logsCount} event logs</div>
            </div>
          </div>

          <details className="rounded-lg border border-white/10 bg-slate-900/80 p-3">
            <summary className="cursor-pointer font-medium text-slate-300">
              Xem chi tiết JSON chuẩn trả về từ Backend API (bao gồm Receipt & Logs)
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto font-mono text-[11px] text-emerald-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}