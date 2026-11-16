"use client";
import ArbitrationPanel from "./ArbitrationPanel";

import React, { useEffect, useState } from "react";
import AnchorCaseOnChainButton from "./AnchorCaseOnChainButton";
import type {
  DisputeCaseAnalysis,
  EvidenceVerdict,
} from "@/lib/dispute/types";

const DEMO_FUJI_TX =
  "0x75e0dcfadff069af83e0c15369da717d5cfad1e358f2e56f54296f263492e8df";

function verdictBadgeClass(verdict: EvidenceVerdict): string {
  switch (verdict) {
    case "VERIFIED":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
    case "CONTRADICTED":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
    case "INSUFFICIENT":
      return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
    case "UNVERIFIABLE":
      return "bg-slate-500/20 text-slate-300 ring-1 ring-slate-400/30";
  }
}

export interface WorkspacePrefill {
  nonce: number;
  network?: "fuji" | "dispatch" | "mainnet";
  txHash?: string;
  userClaim?: string;
  claimedAmountAvax?: string;
  claimedAsset?: string;
  claimedRecipient?: string;
  claimedSender?: string;
  evidenceFile?: File;
  loadDemo?: boolean;
}

export default function DisputeIntelligenceWorkspace({
  copilotPrefill,
  externalCase,
  onCaseSaved,
}: {
  copilotPrefill?: WorkspacePrefill | null;
  externalCase?: { nonce: number; data: DisputeCaseAnalysis } | null;
  onCaseSaved?: (cases: DisputeCaseAnalysis[]) => void;
}) {
  const [txHash, setTxHash] = useState("");
  const [network, setNetwork] = useState<"fuji" | "dispatch" | "mainnet">("fuji");
  const [userClaim, setUserClaim] = useState("");
  const [claimedAmountAvax, setClaimedAmountAvax] = useState("");
  const [claimedAsset, setClaimedAsset] = useState("AVAX");
  const [claimedRecipient, setClaimedRecipient] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DisputeCaseAnalysis | null>(null);
  const [savedCases, setSavedCases] = useState<DisputeCaseAnalysis[]>([]);

  useEffect(() => {
    if (!copilotPrefill) return;
    if (copilotPrefill.loadDemo) {
      fillScenario("contradicted");
      return;
    }
    if (copilotPrefill.network) setNetwork(copilotPrefill.network);
    if (copilotPrefill.txHash) setTxHash(copilotPrefill.txHash);
    const claimText = copilotPrefill.userClaim || "";
    const amtMatch = claimText.match(/([0-9][0-9.,]*)\s*(USDT\.e|WETH\.e|WBTC\.e|USDC|AVAX|USD)\b/i);
    const recMatch = claimText.match(/(?:về\s+địa\s+chỉ\s+ví|địa\s+chỉ\s+nhận[^0x]*|tới\s+ví|recipient[^0x]*)(0x[a-fA-F0-9]{40})/i);

    const rawAmt = copilotPrefill.claimedAmountAvax || (amtMatch ? amtMatch[1].replace(/,/g, "") : "");
    if (rawAmt) setClaimedAmountAvax(rawAmt.replace(/,/g, "").replace(/[^0-9.]/g, ""));

    const rawAsset = copilotPrefill.claimedAsset || (amtMatch ? amtMatch[2] : "");
    if (rawAsset) {
      const upper = rawAsset.toUpperCase();
      const normalized =
        upper === "USDT.E" ? "USDT.e" :
        upper === "WETH.E" ? "WETH.e" :
        upper === "WBTC.E" ? "WBTC.e" : upper;
      setClaimedAsset(normalized);
    }

    const rawRec = copilotPrefill.claimedRecipient || (recMatch ? recMatch[1] : "");
    if (rawRec) setClaimedRecipient(rawRec);
    if (copilotPrefill.userClaim) {
      const senderNote =
        copilotPrefill.claimedSender && !copilotPrefill.userClaim.includes(copilotPrefill.claimedSender)
          ? ` (Người gửi/Hợp đồng: ${copilotPrefill.claimedSender})`
          : "";
      setUserClaim(copilotPrefill.userClaim + senderNote);
    }
    if (copilotPrefill.evidenceFile) {
      const f = copilotPrefill.evidenceFile;
      setSelectedFiles((prev) =>
        prev.some((x) => x.name === f.name && x.size === f.size) ? prev : [...prev, f]
      );
    }
    setErrorMsg(null);
  }, [copilotPrefill]);

  useEffect(() => {
    if (externalCase?.data) setAnalysis(externalCase.data);
  }, [externalCase]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("trustrecover_cases_v1");
      if (raw) { const parsed = JSON.parse(raw); setSavedCases(parsed); if (onCaseSaved) onCaseSaved(parsed); }
    } catch {
      // ignore storage errors
    }
  }, []);

  function saveCaseLocally(item: DisputeCaseAnalysis) {
    setSavedCases((prev) => {
      const next = [item, ...prev.filter((x) => x.caseId !== item.caseId)].slice(0, 6);
      try {
        localStorage.setItem("trustrecover_cases_v1", JSON.stringify(next));
      } catch {
        // ignore
      }
      if (onCaseSaved) onCaseSaved(next); return next;
    });
  }

  function fillScenario(type: "contradicted" | "verified" | "notfound") {
    setErrorMsg(null);
    if (type === "contradicted") {
      setTxHash(DEMO_FUJI_TX);
      setClaimedAmountAvax("25.5");
    setClaimedAsset("AVAX");
      setClaimedRecipient("0x13f452C47AfeFC53A36F30afb8105F53C89f838E");
      setUserClaim(
        "Tôi đã chuyển 25.5 AVAX trực tiếp vào hợp đồng 0x13f452C47AfeFC53A36F30afb8105F53C89f838E để tham gia pool thanh khoản, nhưng bên đối tác báo chưa nhận được tiền và từ chối hoàn trả."
      );
    } else if (type === "verified") {
      setTxHash(DEMO_FUJI_TX);
      setClaimedAmountAvax("0");
    setClaimedAsset("AVAX");
      setClaimedRecipient("0x13f452C47AfeFC53A36F30afb8105F53C89f83BE");
      setUserClaim(
        "Tôi đã gửi lệnh tương tác hợp đồng thông minh (0 AVAX native) tới địa chỉ 0x13f452C47AfeFC53A36F30afb8105F53C89f83BE trên Avalanche Fuji Testnet, giao dịch đã xác nhận thành công."
      );
    } else {
      setTxHash("0x" + "0".repeat(64));
      setClaimedAmountAvax("10");
    setClaimedAsset("AVAX");
      setClaimedRecipient("0x13f452C47AfeFC53A36F30afb8105F53C89f83BE");
      setUserClaim(
        "Đối tác gửi cho tôi mã giao dịch này và khẳng định đã hoàn trả 10 AVAX thành công trên Avalanche Fuji."
      );
    }
  }

  function exportReportJson() {
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TRUSTRECOVER-${analysis.caseId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("txHash", txHash);
      formData.append("network", network);
      formData.append("userClaim", userClaim);
      if (claimedAmountAvax) {
        formData.append("claimedAmountAvax", claimedAsset === "AVAX" ? claimedAmountAvax : `${claimedAmountAvax} ${claimedAsset}`);
      }
      if (claimedRecipient) {
        formData.append("claimedRecipient", claimedRecipient);
      }
      for (const file of selectedFiles) {
        formData.append("evidenceFiles", file);
      }

      const res = await fetch("/api/dispute/analyze", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(
          json?.error?.message || "Không thể thực hiện phân tích hồ sơ tranh chấp."
        );
      } else {
        const resultData = json.data as DisputeCaseAnalysis;
        setAnalysis(resultData);
        saveCaseLocally(resultData);
      }
    } catch {
      setErrorMsg("Lỗi kết nối đến máy chủ phân tích AI Dispute Pipeline.");
    } finally {
      setLoading(false);
    }
  }

  function handleHumanReviewAction(
    newStatus: "APPROVED_BY_REVIEWER" | "FLAGGED_FOR_ESCALATION"
  ) {
    if (!analysis) return;
    const actionNote =
      newStatus === "APPROVED_BY_REVIEWER"
        ? "Human Reviewer đã kiểm tra đối chiếu và phê duyệt kết luận điều tra."
        : "Human Reviewer đã đánh dấu hồ sơ cần điều tra chuyên sâu bổ sung.";

    setAnalysis({
      ...analysis,
      humanReviewStatus: newStatus,
      auditHistory: [
        ...analysis.auditHistory,
        {
          timestamp: new Date().toISOString(),
          actor: "HUMAN_REVIEWER",
          action: newStatus,
          detail: actionNote,
        },
      ],
    });
  }

  return (
    <div className="mt-4 min-w-0 w-full max-w-full overflow-hidden rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-5 text-slate-100 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/30">
              LUỒNG ĐIỀU TRA TRANH CHẤP AI HỢP NHẤT
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
              AskPay • DoubtStamp • LEGALMIND
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
            Không gian Phân tích Bằng chứng & Hỗ trợ Xử lý Tranh chấp
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            AI điều tra • Xác minh dữ liệu đa mạng Avalanche (43114 • 43113 • 779672) • Con người xác nhận kết quả
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fillScenario("contradicted")}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-200 hover:bg-rose-500/20"
          >
            Mẫu 1: Khai sai (Mâu thuẫn)
          </button>
          <button
            type="button"
            onClick={() => fillScenario("verified")}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
          >
            Mẫu 2: Khớp On-Chain
          </button>
          <button
            type="button"
            onClick={() => fillScenario("notfound")}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Mẫu 3: Tx không tồn tại
          </button>
        </div>
      </div>

      {/* Form: Transaction + User Claim + Evidence Upload */}
      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Mạng lưới Avalanche:</span>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as "fuji" | "dispatch" | "mainnet")}
              className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="fuji">Avalanche Fuji C-Chain (43113)</option>
              <option value="dispatch">Dispatch L1 Testnet — ICM (779672)</option>
              <option value="mainnet">Avalanche C-Chain Mainnet (43114)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300">
              1. Mã giao dịch Avalanche (Transaction Hash - Bắt buộc)
            </label>
            <input
              type="text"
              value={txHash}
              onChange={(e) => setTxHash(e.target.value)}
              placeholder="0x..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Số lượng tài sản khiếu nại
              </label>
              <div className="flex gap-2">
                  <input
                type="text"
                value={claimedAmountAvax}
                onChange={(e) => setClaimedAmountAvax(e.target.value)}
                placeholder="Ví dụ: 25.5"
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
                  <select
                    value={claimedAsset}
                    onChange={(e) => setClaimedAsset(e.target.value)}
                    className="w-28 shrink-0 rounded-xl border border-slate-700 bg-slate-950/90 px-2.5 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  >
                    <option value="AVAX">AVAX</option>
                    <option value="WETH.e">WETH.e</option>
                    <option value="USDC">USDC</option>
                    <option value="WBTC.e">WBTC.e</option>
                    <option value="USDT.e">USDT.e</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Địa chỉ nhận theo lời khai (0x...)
              </label>
              <input
                type="text"
                value={claimedRecipient}
                onChange={(e) => setClaimedRecipient(e.target.value)}
                placeholder="0x..."
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300">
              2. Nội dung khiếu nại chi tiết của người dùng
            </label>
            <textarea
              rows={3}
              value={userClaim}
              onChange={(e) => setUserClaim(e.target.value)}
              placeholder="Mô tả chi tiết sự việc, số tiền, thỏa thuận với đối tác và vấn đề phát sinh..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Evidence Upload Box */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div>
            <label className="block text-xs font-semibold text-cyan-300">
              3. Tải lên tệp bằng chứng
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              Hỗ trợ TXT, JSON, CSV, MD, LOG, PDF, PNG, JPG (Tối đa 5 tệp, mỗi tệp &le; 5MB). Hệ thống tự động băm SHA-256 để cố định tính toàn vẹn phiên bản.
            </p>
            <input
              type="file"
              multiple
              accept=".txt,.json,.csv,.md,.log,.pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) =>
                setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])
              }
              className="mt-3 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-500/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-cyan-200 hover:file:bg-cyan-500/30"
            />

            {selectedFiles.length > 0 && (
              <ul className="mt-3 space-y-1 text-[11px] text-slate-300">
                {selectedFiles.map((f, idx) => (
                  <li key={idx} className="truncate font-mono">
                    • {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-cyan-400 px-4 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {loading
              ? "Đang chạy AskPay → DoubtStamp → LEGALMIND..."
              : "Chạy Điều Tra Tranh Chấp Toàn Diện"}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-200">
          <strong className="text-rose-400">Lỗi xử lý: </strong>
          {errorMsg}
        </div>
      )}

      {/* Results Display */}
      {analysis && (
        <div className="mt-8 space-y-6 border-t border-white/10 pt-6">
          {/* Top Case Status & Sufficiency Score */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">
                Mã Hồ Sơ & Trạng Thái
              </span>
              <div className="mt-1 font-mono text-sm font-bold text-cyan-300">
                {analysis.caseId}
              </div>
              <div className="mt-2 inline-block rounded-md bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                {analysis.humanReviewStatus}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">
                Xác Minh Blockchain ({analysis.onChainVerification.networkName} • {analysis.onChainVerification.chainId})
              </span>
              <div className="mt-1 text-sm font-bold">
                {analysis.onChainVerification.verified ? (
                  <span className="text-emerald-400">
                    ✓ ĐÃ XÁC MINH ON-CHAIN (CONFIRMED)
                  </span>
                ) : (
                  <span className="text-rose-400">
                    ✕ KHÔNG XÁC MINH ĐƯỢC ON-CHAIN
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Nguồn: {analysis.onChainVerification.networkName} RPC (eth_chainId: {analysis.onChainVerification.chainId}) — Tách biệt hoàn toàn với suy luận AI
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  Điểm đầy đủ bằng chứng
                </span>
                <span className="font-mono text-lg font-bold text-cyan-300">
                  {analysis.aiInvestigation.doubtStamp.evidenceSufficiencyScore}/100
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-cyan-400"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        analysis.aiInvestigation.doubtStamp.evidenceSufficiencyScore
                      )
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-300">
                {analysis.aiInvestigation.doubtStamp.sufficiencyExplanation}
              </p>
            </div>
          </div>

          {/* 1. VERIFIED DỮ LIỆU GỐCS vs AI INVESTIGATION (AskPay) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-5">
              <div className="flex flex-col items-start gap-1.5">
                <h3 className="text-sm font-bold text-emerald-300">
                  Dữ liệu xác thực trên Blockchain ({analysis.onChainVerification.networkName} • {analysis.onChainVerification.chainId})
                </h3>
                <span className="inline-block whitespace-nowrap rounded-md bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  DỮ LIỆU GỐC
                </span>
              </div>
              {analysis.onChainVerification.txData ? (
                <div className="mt-3 space-y-2 font-mono text-xs text-slate-200">
                  <div>
                    <span className="text-slate-400">TxHash: </span>
                    <span className="break-all">
                      {analysis.onChainVerification.txData.transaction.hash}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Status: </span>
                    <span className="uppercase text-emerald-400">
                      {analysis.onChainVerification.txData.receipt.status} (Code:{" "}
                      {analysis.onChainVerification.txData.receipt.statusCode})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Block Number: </span>
                    {analysis.onChainVerification.txData.transaction.blockNumber}
                  </div>
                  <div>
                    <span className="text-slate-400">From (Sender): </span>
                    <span className="break-all">
                      {analysis.onChainVerification.txData.transaction.from}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">To (Recipient/Contract): </span>
                    <span className="break-all">
                      {analysis.onChainVerification.txData.transaction.to ??
                        "Contract Creation"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Value: </span>
                    {analysis.onChainVerification.txData.transaction.valueAvax} AVAX (
                    {analysis.onChainVerification.txData.transaction.valueWei} Wei)
                  </div>
                  <div>
                    <span className="text-slate-400">Gas Used / Logs: </span>
                    {analysis.onChainVerification.txData.receipt.gasUsed} gas •{" "}
                    {analysis.onChainVerification.txData.receipt.logsCount} event logs
                  </div>
                  {analysis.onChainVerification.txData.recipientProfile && (
                    <div className="mt-2 rounded-lg border border-white/10 bg-slate-950/60 p-2.5 text-[11px]">
                      <span className="text-slate-400">Phân loại đích (Address Profiling): </span>
                      <span className="font-semibold text-cyan-300">
                        {analysis.onChainVerification.txData.recipientProfile.isContract
                          ? "Smart Contract (Hợp đồng thông minh)"
                          : "EOA (Ví người dùng thông thường)"}
                      </span>
                      <span className="text-slate-400">
                        {" "}• Số dư hiện tại: {Number(analysis.onChainVerification.txData.recipientProfile.balanceAvax).toFixed(4)} AVAX
                      </span>
                    </div>
                  )}

                  {analysis.onChainVerification.txData.receipt.logs.some((l) => l.decodedEvent) && (
                    <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2.5 text-[11px]">
                      <div className="font-semibold text-cyan-300">Sự kiện ERC-20 đã giải mã:</div>
                      {analysis.onChainVerification.txData.receipt.logs
                        .filter((l) => l.decodedEvent)
                        .map((l, idx) => (
                          <div key={idx} className="mt-1 break-all text-slate-300">
                            • {l.decodedEvent?.name}: {JSON.stringify(l.decodedEvent?.args)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-rose-300">
                  {analysis.onChainVerification.verificationError ||
                    "Không có dữ liệu giao dịch trên mạng đã chọn."}
                </p>
              )}

              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="text-xs font-semibold text-emerald-300">
                  Sự kiện xác minh trực tiếp (AskPay Verified Facts):
                </div>
                <ul className="mt-1.5 list-disc space-y-1 [overflow-wrap:anywhere] pl-4 text-xs text-slate-200">
                  {analysis.aiInvestigation.askPay.verifiedBlockchainFacts.map(
                    (fact, i) => (
                      <li key={i}>{fact}</li>
                    )
                  )}
                </ul>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5">
              <div className="flex flex-col items-start gap-1.5">
                <h3 className="text-sm font-bold text-cyan-300">
                  AskPay – Phân tích Giao dịch On-Chain
                </h3>
                <span className="inline-block whitespace-nowrap rounded-md bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                  PHÂN TÍCH AI ({analysis.aiInvestigation.modelUsed})
                </span>
              </div>
              <div className="mt-3 space-y-2.5 break-words text-xs leading-relaxed text-slate-200">
                <p>
                  <strong className="text-white">Tóm tắt trạng thái: </strong>
                  {analysis.aiInvestigation.askPay.txStatusSummary}
                </p>
                <p>
                  <strong className="text-white">Ví gửi (Sender): </strong>
                  {analysis.aiInvestigation.askPay.senderExplanation}
                </p>
                <p>
                  <strong className="text-white">Ví nhận / Contract: </strong>
                  {analysis.aiInvestigation.askPay.recipientExplanation}
                </p>
                <p>
                  <strong className="text-white">Giá trị & Phí Gas: </strong>
                  {analysis.aiInvestigation.askPay.valueAndGasExplanation}
                </p>
                <p>
                  <strong className="text-white">Block & Event Logs: </strong>
                  {analysis.aiInvestigation.askPay.blockAndLogsExplanation}
                </p>
              </div>

              {analysis.aiInvestigation.askPay.unverifiedOrInsufficientData
                .length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-3">
                  <div className="text-xs font-semibold text-amber-300">
                    Thông tin chưa đủ cơ sở xác minh on-chain:
                  </div>
                  <ul className="mt-1 list-disc space-y-1 break-words pl-4 text-xs text-slate-300">
                    {analysis.aiInvestigation.askPay.unverifiedOrInsufficientData.map(
                      (item, i) => (
                        <li key={i}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 2. DOUBTSTAMP: Evidence Consistency, Contradictions & Missing Evidence */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-cyan-300">
                DoubtStamp – Đối chiếu Lời khai & Phát hiện Mâu thuẫn
              </h3>
              <span className="text-xs text-slate-400">
                Phân loại: VERIFIED • CONTRADICTED • INSUFFICIENT • UNVERIFIABLE
              </span>
            </div>

            <p className="mt-2 [overflow-wrap:anywhere] text-xs text-slate-300">
              {analysis.aiInvestigation.doubtStamp.overallConsistencySummary}
            </p>

            {/* Uploaded Evidence Commitment Hashes */}
            {analysis.userInput.evidenceFiles.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <div className="text-xs font-semibold text-slate-200">
                  Cam kết toàn vẹn tệp bằng chứng (SHA-256 Commitment):
                </div>
                <div className="mt-2 space-y-2">
                  {analysis.userInput.evidenceFiles.map((f, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-white/5 bg-slate-900 p-2.5 text-xs"
                    >
                      <div className="font-mono font-semibold text-cyan-300">
                        {f.fileName} ({(f.sizeBytes / 1024).toFixed(1)} KB)
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-slate-300">
                        SHA-256: {f.sha256CommitmentHash}
                      </div>
                      <div className="mt-1 text-[11px] italic text-amber-300/90">
                        Lưu ý: {f.integrityNote}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Findings Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2 pr-3">Khía cạnh đối chiếu</th>
                    <th className="py-2 pr-3">Lời khai người dùng</th>
                    <th className="py-2 pr-3">Dữ liệu On-Chain / Bằng chứng</th>
                    <th className="py-2 pr-3">Kết luận</th>
                    <th className="py-2 pr-3">Lý do & Nguồn dữ liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {analysis.aiInvestigation.doubtStamp.findings.map((item, idx) => (
                    <tr key={idx} className="align-top">
                      <td className="py-3 pr-3 font-medium text-white">
                        {item.claimAspect}
                      </td>
                      <td className="py-3 pr-3 [overflow-wrap:anywhere] text-slate-300">
                        {item.userStatement}
                      </td>
                      <td className="py-3 pr-3 font-mono text-[11px] [overflow-wrap:anywhere] text-slate-300">
                        {item.onChainOrEvidenceReference}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-md px-2.5 py-0.5 font-mono text-[11px] font-bold ${verdictBadgeClass(
                            item.verdict
                          )}`}
                        >
                          {item.verdict}
                        </span>
                      </td>
                      <td className="py-3 pr-3 [overflow-wrap:anywhere] text-slate-300">
                        <div>{item.reasoning}</div>
                        <span className="mt-1 inline-block font-mono text-[10px] text-cyan-400">
                          Nguồn: {item.dataSource}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Contradictions & Missing Evidence */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 overflow-hidden rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                <h4 className="text-xs font-bold text-rose-300">
                  Điểm mâu thuẫn phát hiện
                </h4>
                {analysis.aiInvestigation.doubtStamp.contradictions.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-rose-200">
                    {analysis.aiInvestigation.doubtStamp.contradictions.map(
                      (c, i) => (
                        <li key={i}>{c}</li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Không phát hiện mâu thuẫn trực tiếp với dữ liệu on-chain.
                  </p>
                )}
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
                <h4 className="text-xs font-bold text-amber-300">
                  Bằng chứng còn thiếu
                </h4>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-100">
                  {analysis.aiInvestigation.doubtStamp.missingEvidence.map(
                    (m, i) => (
                      <li key={i}>{m}</li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* 3. LEGALMIND: Recovery Recommendations */}
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5">
            <h3 className="text-sm font-bold text-cyan-300">
              LEGALMIND – Đề xuất Hướng xử lý & Danh sách kiểm tra
            </h3>
            <p className="mt-2 [overflow-wrap:anywhere] text-xs text-slate-300">
              {analysis.aiInvestigation.legalMind.executiveSummary}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {analysis.aiInvestigation.legalMind.disputeChecklist.map((step) => (
                <div
                  key={step.step}
                  className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/70 p-3.5 text-xs"
                >
                  <div className="flex flex-col items-start gap-1.5">
                    <span className="inline-block whitespace-nowrap rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/25">
                      {step.category} • {step.priority}
                    </span>
                    <span className="font-bold text-white">
                      Bước {step.step}: {step.title}
                    </span>
                  </div>
                  <p className="mt-1.5 [overflow-wrap:anywhere] text-slate-300">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-3.5 text-xs">
                <div className="font-semibold text-white">
                  Phân biệt Hướng dẫn Kỹ thuật & Thông tin Pháp lý:
                </div>
                <p className="mt-1 text-slate-300">
                  {analysis.aiInvestigation.legalMind.technicalVsLegalDistinction}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-3.5 text-xs">
                <div className="font-semibold text-white">
                  Tham chiếu quy định & Phạm vi áp dụng:
                </div>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-slate-300">
                  {analysis.aiInvestigation.legalMind.legalReferencesAndScope.map(
                    (ref, i) => (
                      <li key={i}>{ref}</li>
                    )
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-950/15 p-3 text-[11px] text-amber-200/90">
              <strong>Tuyên bố giới hạn trách nhiệm bắt buộc:</strong>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {analysis.aiInvestigation.legalMind.mandatoryDisclaimers.map(
                  (d, i) => (
                    <li key={i}>{d}</li>
                  )
                )}
              </ul>
            </div>
          </div>

                    {(analysis.crossEngineCheck || analysis.recoveryReadiness) && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {analysis.crossEngineCheck && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Kiểm tra chéo 3 Engine (Cross-Engine Check)
                    </h4>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${analysis.crossEngineCheck.consistent ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                      {analysis.crossEngineCheck.consistent ? "ĐỒNG NHẤT" : "PHÁT HIỆN MÂU THUẪN"}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-200">
                    {analysis.crossEngineCheck.finalTransparentConclusion}
                  </p>
                  {analysis.crossEngineCheck.requiresHumanReview && (
                    <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-200">
                      Yêu cầu Human Reviewer kiểm duyệt trước khi neo kết quả.
                    </div>
                  )}
                  {analysis.crossEngineCheck.conflictsDetected.length > 0 && (
                    <ul className="mt-2.5 list-disc space-y-1 pl-4 text-[11px] text-rose-200">
                      {analysis.crossEngineCheck.conflictsDetected.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {analysis.recoveryReadiness && (
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Phân rã Điểm Sẵn sàng (Recovery Readiness)
                    </h4>
                    <span className="whitespace-nowrap rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                      {analysis.recoveryReadiness.score}/100 • {analysis.recoveryReadiness.level}
                    </span>
                  </div>
                  {analysis.recoveryReadiness.capApplied && (
                    <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-[11px] text-rose-200">
                      Giới hạn trần điểm: {analysis.recoveryReadiness.capApplied}
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    {analysis.recoveryReadiness.factors.map((f, idx) => (
                      <div key={idx} className="rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-200">{f.factor}</span>
                          <span className={`whitespace-nowrap font-mono text-[11px] font-bold ${f.status === "PASS" ? "text-emerald-300" : f.status === "PARTIAL" ? "text-amber-300" : "text-rose-300"}`}>
                            {f.points}/{f.maxPoints} ({f.status})
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">{f.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <ArbitrationPanel caseId={analysis.caseId} reportPayload={analysis} />

          {/* 4. AUDIT HISTORY & HUMAN REVIEWER VALIDATION */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 lg:col-span-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Nhật ký kiểm toán hồ sơ (Audit History)
              </h4>
              <div className="mt-3 space-y-2.5">
                {analysis.auditHistory.map((log, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 border-l-2 border-cyan-400/50 pl-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-cyan-300">
                      <span>{log.timestamp}</span>
                      <span>•</span>
                      <span>{log.actor}</span>
                      <span>•</span>
                      <span className="font-bold">{log.action}</span>
                    </div>
                    <p className="break-words text-slate-300">{log.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/70 p-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Kiểm duyệt viên xác nhận
                </h4>
                <p className="mt-2 text-xs text-slate-400">
                  Theo nguyên tắc cốt lõi của TRUSTRECOVER, AI không tự đưa ra phán quyết cuối cùng. Kiểm duyệt viên con người xác nhận kết quả sau khi đối chiếu bằng chứng:
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleHumanReviewAction("APPROVED_BY_REVIEWER")}
                  className="w-full rounded-xl bg-emerald-500/20 px-3 py-2.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
                >
                  ✓ Phê duyệt báo cáo điều tra (Human Approved)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleHumanReviewAction("FLAGGED_FOR_ESCALATION")
                  }
                  className="w-full rounded-xl bg-amber-500/20 px-3 py-2.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
                >
                  ⚑ Đánh dấu cần điều tra chuyên sâu (Escalate)
                </button>
                <button
                  type="button"
                  onClick={exportReportJson}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  ⤓ Xuất Báo cáo Kiểm toán (.json)
                </button>
                <AnchorCaseOnChainButton
                  analysis={analysis}
                  onAnchored={(anchorTxHash, reviewerAddress) => {
                    setAnalysis((prev) =>
                      prev
                        ? {
                            ...prev,
                            humanReviewStatus: "APPROVED_BY_REVIEWER",
                            auditHistory: [
                              ...prev.auditHistory,
                              {
                                timestamp: new Date().toISOString(),
                                actor: "HUMAN_REVIEWER",
                                action: "ANCHORED_ON_AVALANCHE_FUJI",
                                detail: `Reviewer ${reviewerAddress} đã neo hồ sơ lên Avalanche Fuji Testnet (Tx: ${anchorTxHash}).`,
                              },
                            ],
                          }
                        : prev
                    );
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}