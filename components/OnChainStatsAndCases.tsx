"use client";

import React, { useEffect, useState } from "react";
import {
  SNOWTRACE_FUJI_URL,
  TRUSTRECOVER_REGISTRY_ADDRESS,
} from "@/lib/avalanche/registryContract";

interface AnchoredCaseItem {
  caseId: string;
  txHash: string;
  reportHash: string;
  verdict: string;
  reviewer: string;
  anchoredAt: number;
}

export default function OnChainStatsAndCases() {
  const [totalCases, setTotalCases] = useState<number | null>(null);
  const [cases, setCases] = useState<AnchoredCaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadOnChainRegistry() {
    setLoading(true);
    try {
      const res = await fetch("/api/registry/cases");
      const json = await res.json();
      if (json.success) {
        setTotalCases(json.totalCases);
        setCases(json.cases || []);
      }
    } catch {
      // keep silent fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOnChainRegistry();
  }, []);

  const liveStats = [
    {
      label: "On-chain Anchored Cases",
      value: loading ? "..." : String(totalCases ?? 0).padStart(2, "0"),
      note: "Verified on TrustRecoverRegistry (Fuji)",
    },
    {
      label: "Avalanche Network",
      value: "43113",
      note: "Fuji C-Chain Testnet (Live RPC)",
    },
    {
      label: "AI Dispute Engine",
      value: "3-Stage",
      note: "AskPay • DoubtStamp • LEGALMIND",
    },
    {
      label: "Registry Contract",
      value: `${TRUSTRECOVER_REGISTRY_ADDRESS.slice(0, 6)}...${TRUSTRECOVER_REGISTRY_ADDRESS.slice(-4)}`,
      note: "Auditable immutable storage",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Live On-Chain Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {liveStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold text-cyan-300">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>

      {/* Live On-Chain Anchored Cases */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Recent On-Chain Anchored Cases (Avalanche Fuji)
            </h3>
            <p className="text-xs text-slate-400">
              Dữ liệu đọc trực tiếp từ Smart Contract{" "}
              <a
                href={`${SNOWTRACE_FUJI_URL}/address/${TRUSTRECOVER_REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-cyan-300 underline"
              >
                {TRUSTRECOVER_REGISTRY_ADDRESS}
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={loadOnChainRegistry}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20"
          >
            Làm mới từ Fuji
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400">
            Đang đọc dữ liệu từ Avalanche Fuji Testnet...
          </p>
        ) : cases.length === 0 ? (
          <p className="text-xs text-slate-400">
            Chưa có hồ sơ nào được neo on-chain. Hãy chạy phân tích bên dưới và bấm Ký & Neo Hồ Sơ.
          </p>
        ) : (
          <div className="space-y-3">
            {cases.map((item) => (
              <div
                key={item.caseId}
                className="rounded-xl border border-white/5 bg-slate-950/60 p-4 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-cyan-300">
                    {item.caseId}
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                    {item.verdict}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-1 font-mono text-[11px] text-slate-400 sm:grid-cols-2">
                  <div className="truncate">TxHash: {item.txHash}</div>
                  <div className="truncate">Reviewer: {item.reviewer}</div>
                  <div className="truncate">ReportHash: {item.reportHash}</div>
                  <div>
                    Anchored:{" "}
                    {new Date(item.anchoredAt * 1000).toLocaleString("vi-VN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}