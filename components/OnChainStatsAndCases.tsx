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
      index: "01",
      label: "ON-CHAIN ANCHORED CASES",
      value: loading ? "--" : String(totalCases ?? 0).padStart(2, "0"),
      note: "TrustRecoverRegistry v2 • Fuji",
    },
    {
      index: "02",
      label: "AVALANCHE NETWORK",
      value: "43113",
      note: "Fuji C-Chain • Live RPC",
    },
    {
      index: "03",
      label: "AI DISPUTE ENGINE",
      value: "3-STAGE",
      note: "AskPay • DoubtStamp • LEGALMIND",
    },
    {
      index: "04",
      label: "REGISTRY CONTRACT",
      value: `${TRUSTRECOVER_REGISTRY_ADDRESS.slice(0, 6)}..${TRUSTRECOVER_REGISTRY_ADDRESS.slice(-4)}`,
      note: "onlyReviewer • Immutable",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Broadcast Telemetry Strip */}
      <div className="grid grid-cols-3 divide-x divide-cyan-400/20 overflow-hidden rounded-xl border border-cyan-400/25 bg-[#0b1324]">
        <div className="px-4 py-2.5">
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
            STAGE 01
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-white">
            AskPay • RPC Verify
          </span>
        </div>
        <div className="px-4 py-2.5">
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
            STAGE 02
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-white">
            DoubtStamp • Cross-Check
          </span>
        </div>
        <div className="px-4 py-2.5">
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400">
            STAGE 03
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-white">
            LEGALMIND • Fuji Anchor
          </span>
        </div>
      </div>

      {/* Architectural Hairline-Grid Stats */}
      <div className="grid grid-cols-1 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/15 bg-[#0c1527] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {liveStats.map((stat) => (
          <div
            key={stat.label}
            className="group relative flex flex-col justify-between p-5 transition hover:bg-cyan-500/[0.04]"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {stat.label}
              </span>
              <span className="font-mono text-[10px] font-bold text-cyan-500/60">
                #{stat.index}
              </span>
            </div>
            <p className="mt-4 font-mono text-3xl font-black tracking-tight tabular-nums text-cyan-300">
              {stat.value}
            </p>
            <p className="mt-2 border-t border-white/5 pt-2 text-[11px] font-medium text-slate-400">
              {stat.note}
            </p>
          </div>
        ))}
      </div>

      {/* Live On-Chain Anchored Cases Table */}
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0c1527]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-white">
                ON-CHAIN ANCHORED REGISTRY (AVALANCHE FUJI)
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Smart Contract:{" "}
              <a
                href={`${SNOWTRACE_FUJI_URL}/address/${TRUSTRECOVER_REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-cyan-300 underline hover:text-cyan-200"
              >
                {TRUSTRECOVER_REGISTRY_ADDRESS}
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={loadOnChainRegistry}
            className="rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-400/20"
          >
            ↻ Sync Fuji
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <p className="font-mono text-xs text-slate-400">
              Đang đồng bộ dữ liệu từ Avalanche Fuji Testnet...
            </p>
          ) : cases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-400">
              Chưa có hồ sơ nào trên Contract v2. Hãy chạy phân tích bên dưới và ký neo bằng MetaMask để ghi nhận bản ghi đầu tiên.
            </div>
          ) : (
            <div className="divide-y divide-white/10 rounded-xl border border-white/10 bg-slate-950/60">
              {cases.map((item) => (
                <div key={item.caseId} className="p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm font-black tracking-wide text-cyan-300">
                      {item.caseId}
                    </span>
                    <span className="rounded-md bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/30">
                      {item.verdict}
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-1 gap-1.5 font-mono text-[11px] text-slate-400 sm:grid-cols-2">
                    <div className="truncate">TX: {item.txHash}</div>
                    <div className="truncate">REVIEWER: {item.reviewer}</div>
                    <div className="truncate">REPORT: {item.reportHash}</div>
                    <div>
                      ANCHORED:{" "}
                      {new Date(item.anchoredAt * 1000).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}