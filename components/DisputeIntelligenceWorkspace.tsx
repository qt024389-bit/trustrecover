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
    const recMatch = claimText.match(/(?:vá»\s+(?:Ä‘á»‹a\s+chá»‰\s+)?vÃ­|vá»\s+Ä‘á»‹a\s+chá»‰|Ä‘á»‹a\s+chá»‰\s+nháº­n[^0x]*|tá»›i\s+(?:Ä‘á»‹a\s+chá»‰\s+)?vÃ­|tá»›i\s+Ä‘á»‹a\s+chá»‰|Ä‘áº¿n\s+(?:Ä‘á»‹a\s+chá»‰\s+)?vÃ­|recipient[^0x]*)(0x[a-fA-F0-9]{40})/i);

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

    const allAddrs = (claimText.match(/0x[a-fA-F0-9]{40}/g) || []).filter((a) => a.toLowerCase() !== (copilotPrefill.claimedSender || "").toLowerCase());
    const rawRec = copilotPrefill.claimedRecipient || (recMatch ? recMatch[1] : "") || (allAddrs.length > 0 ? allAddrs[allAddrs.length - 1] : "");
    if (rawRec) setClaimedRecipient(rawRec);
    if (copilotPrefill.userClaim) {
      const senderNote =
        copilotPrefill.claimedSender && !copilotPrefill.userClaim.includes(copilotPrefill.claimedSender)
          ? ` (NgÆ°á»i gá»­i/Há»£p Ä‘á»“ng: ${copilotPrefill.claimedSender})`
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
        "TÃ´i Ä‘Ã£ chuyá»ƒn 25.5 AVAX trá»±c tiáº¿p vÃ o há»£p Ä‘á»“ng 0x13f452C47AfeFC53A36F30afb8105F53C89f838E Ä‘á»ƒ tham gia pool thanh khoáº£n, nhÆ°ng bÃªn Ä‘á»‘i tÃ¡c bÃ¡o chÆ°a nháº­n Ä‘Æ°á»£c tiá»n vÃ  tá»« chá»‘i hoÃ n tráº£."
      );
    } else if (type === "verified") {
      setTxHash(DEMO_FUJI_TX);
      setClaimedAmountAvax("0");
    setClaimedAsset("AVAX");
      setClaimedRecipient("0x13f452C47AfeFC53A36F30afb8105F53C89f83BE");
      setUserClaim(
        "TÃ´i Ä‘Ã£ gá»­i lá»‡nh tÆ°Æ¡ng tÃ¡c há»£p Ä‘á»“ng thÃ´ng minh (0 AVAX native) tá»›i Ä‘á»‹a chá»‰ 0x13f452C47AfeFC53A36F30afb8105F53C89f83BE trÃªn Avalanche Fuji Testnet, giao dá»‹ch Ä‘Ã£ xÃ¡c nháº­n thÃ nh cÃ´ng."
      );
    } else {
      setTxHash("0x" + "0".repeat(64));
      setClaimedAmountAvax("10");
    setClaimedAsset("AVAX");
      setClaimedRecipient("0x13f452C47AfeFC53A36F30afb8105F53C89f83BE");
      setUserClaim(
        "Äá»‘i tÃ¡c gá»­i cho tÃ´i mÃ£ giao dá»‹ch nÃ y vÃ  kháº³ng Ä‘á»‹nh Ä‘Ã£ hoÃ n tráº£ 10 AVAX thÃ nh cÃ´ng trÃªn Avalanche Fuji."
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
          json?.error?.message || "KhÃ´ng thá»ƒ thá»±c hiá»‡n phÃ¢n tÃ­ch há»“ sÆ¡ tranh cháº¥p."
        );
      } else {
        const resultData = json.data as DisputeCaseAnalysis;
        setAnalysis(resultData);
        saveCaseLocally(resultData);
      }
    } catch {
      setErrorMsg("Lá»—i káº¿t ná»‘i Ä‘áº¿n mÃ¡y chá»§ phÃ¢n tÃ­ch AI Dispute Pipeline.");
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
        ? "Human Reviewer Ä‘Ã£ kiá»ƒm tra Ä‘á»‘i chiáº¿u vÃ  phÃª duyá»‡t káº¿t luáº­n Ä‘iá»u tra."
        : "Human Reviewer Ä‘Ã£ Ä‘Ã¡nh dáº¥u há»“ sÆ¡ cáº§n Ä‘iá»u tra chuyÃªn sÃ¢u bá»• sung.";

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
              LUá»’NG ÄIá»€U TRA TRANH CHáº¤P AI Há»¢P NHáº¤T
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-white/10">
              AskPay â€¢ DoubtStamp â€¢ LEGALMIND
            </span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
            KhÃ´ng gian PhÃ¢n tÃ­ch Báº±ng chá»©ng & Há»— trá»£ Xá»­ lÃ½ Tranh cháº¥p
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            AI Ä‘iá»u tra â€¢ XÃ¡c minh dá»¯ liá»‡u Ä‘a máº¡ng Avalanche (43114 â€¢ 43113 â€¢ 779672) â€¢ Con ngÆ°á»i xÃ¡c nháº­n káº¿t quáº£
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fillScenario("contradicted")}
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-medium text-rose-200 hover:bg-rose-500/20"
          >
            Máº«u 1: Khai sai (MÃ¢u thuáº«n)
          </button>
          <button
            type="button"
            onClick={() => fillScenario("verified")}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20"
          >
            Máº«u 2: Khá»›p On-Chain
          </button>
          <button
            type="button"
            onClick={() => fillScenario("notfound")}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Máº«u 3: Tx khÃ´ng tá»“n táº¡i
          </button>
        </div>
      </div>

      {/* Form: Transaction + User Claim + Evidence Upload */}
      <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Máº¡ng lÆ°á»›i Avalanche:</span>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as "fuji" | "dispatch" | "mainnet")}
              className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="fuji">Avalanche Fuji C-Chain (43113)</option>
              <option value="dispatch">Dispatch L1 Testnet â€” ICM (779672)</option>
              <option value="mainnet">Avalanche C-Chain Mainnet (43114)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300">
              1. MÃ£ giao dá»‹ch Avalanche (Transaction Hash - Báº¯t buá»™c)
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
                Sá»‘ lÆ°á»£ng tÃ i sáº£n khiáº¿u náº¡i
              </label>
              <div className="flex gap-2">
                  <input
                type="text"
                value={claimedAmountAvax}
                onChange={(e) => setClaimedAmountAvax(e.target.value)}
                placeholder="VÃ­ dá»¥: 25.5"
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
                Äá»‹a chá»‰ nháº­n theo lá»i khai (0x...)
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
              2. Ná»™i dung khiáº¿u náº¡i chi tiáº¿t cá»§a ngÆ°á»i dÃ¹ng
            </label>
            <textarea
              rows={3}
              value={userClaim}
              onChange={(e) => setUserClaim(e.target.value)}
              placeholder="MÃ´ táº£ chi tiáº¿t sá»± viá»‡c, sá»‘ tiá»n, thá»a thuáº­n vá»›i Ä‘á»‘i tÃ¡c vÃ  váº¥n Ä‘á» phÃ¡t sinh..."
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900/90 p-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Evidence Upload Box */}
        <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div>
            <label className="block text-xs font-semibold text-cyan-300">
              3. Táº£i lÃªn tá»‡p báº±ng chá»©ng
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              Há»— trá»£ TXT, JSON, CSV, MD, LOG, PDF, PNG, JPG (Tá»‘i Ä‘a 5 tá»‡p, má»—i tá»‡p &le; 5MB). Há»‡ thá»‘ng tá»± Ä‘á»™ng bÄƒm SHA-256 Ä‘á»ƒ cá»‘ Ä‘á»‹nh tÃ­nh toÃ n váº¹n phiÃªn báº£n.
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
                    â€¢ {f.name} ({(f.size / 1024).toFixed(1)} KB)
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
              ? "Äang cháº¡y AskPay â†’ DoubtStamp â†’ LEGALMIND..."
              : "Cháº¡y Äiá»u Tra Tranh Cháº¥p ToÃ n Diá»‡n"}
          </button>
        </div>
      </form>

      {errorMsg && (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/40 p-4 text-xs text-rose-200">
          <strong className="text-rose-400">Lá»—i xá»­ lÃ½: </strong>
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
                MÃ£ Há»“ SÆ¡ & Tráº¡ng ThÃ¡i
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
                XÃ¡c Minh Blockchain ({analysis.onChainVerification.networkName} â€¢ {analysis.onChainVerification.chainId})
              </span>
              <div className="mt-1 text-sm font-bold">
                {analysis.onChainVerification.verified ? (
                  <span className="text-emerald-400">
                    âœ“ ÄÃƒ XÃC MINH ON-CHAIN (CONFIRMED)
                  </span>
                ) : (
                  <span className="text-rose-400">
                    âœ• KHÃ”NG XÃC MINH ÄÆ¯á»¢C ON-CHAIN
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Nguá»“n: {analysis.onChainVerification.networkName} RPC (eth_chainId: {analysis.onChainVerification.chainId}) â€” TÃ¡ch biá»‡t hoÃ n toÃ n vá»›i suy luáº­n AI
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  Äiá»ƒm Ä‘áº§y Ä‘á»§ báº±ng chá»©ng
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

          {/* 1. VERIFIED Dá»® LIá»†U Gá»CS vs AI INVESTIGATION (AskPay) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-5">
              <div className="flex flex-col items-start gap-1.5">
                <h3 className="text-sm font-bold text-emerald-300">
                  Dá»¯ liá»‡u xÃ¡c thá»±c trÃªn Blockchain ({analysis.onChainVerification.networkName} â€¢ {analysis.onChainVerification.chainId})
                </h3>
                <span className="inline-block whitespace-nowrap rounded-md bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  Dá»® LIá»†U Gá»C
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
                    {analysis.onChainVerification.txData.receipt.gasUsed} gas â€¢{" "}
                    {analysis.onChainVerification.txData.receipt.logsCount} event logs
                  </div>
                  {analysis.onChainVerification.txData.recipientProfile && (
                    <div className="mt-2 rounded-lg border border-white/10 bg-slate-950/60 p-2.5 text-[11px]">
                      <span className="text-slate-400">PhÃ¢n loáº¡i Ä‘Ã­ch (Address Profiling): </span>
                      <span className="font-semibold text-cyan-300">
                        {analysis.onChainVerification.txData.recipientProfile.isContract
                          ? "Smart Contract (Há»£p Ä‘á»“ng thÃ´ng minh)"
                          : "EOA (VÃ­ ngÆ°á»i dÃ¹ng thÃ´ng thÆ°á»ng)"}
                      </span>
                      <span className="text-slate-400">
                        {" "}â€¢ Sá»‘ dÆ° hiá»‡n táº¡i: {Number(analysis.onChainVerification.txData.recipientProfile.balanceAvax).toFixed(4)} AVAX
                      </span>
                    </div>
                  )}

                  {analysis.onChainVerification.txData.receipt.logs.some((l) => l.decodedEvent) && (
                    <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2.5 text-[11px]">
                      <div className="font-semibold text-cyan-300">Sá»± kiá»‡n ERC-20 Ä‘Ã£ giáº£i mÃ£:</div>
                      {analysis.onChainVerification.txData.receipt.logs
                        .filter((l) => l.decodedEvent)
                        .map((l, idx) => (
                          <div key={idx} className="mt-1 break-all text-slate-300">
                            â€¢ {l.decodedEvent?.name}: {JSON.stringify(l.decodedEvent?.args)}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs text-rose-300">
                  {analysis.onChainVerification.verificationError ||
                    "KhÃ´ng cÃ³ dá»¯ liá»‡u giao dá»‹ch trÃªn máº¡ng Ä‘Ã£ chá»n."}
                </p>
              )}

              <div className="mt-4 border-t border-white/10 pt-3">
                <div className="text-xs font-semibold text-emerald-300">
                  Sá»± kiá»‡n xÃ¡c minh trá»±c tiáº¿p (AskPay Verified Facts):
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
                  AskPay â€“ PhÃ¢n tÃ­ch Giao dá»‹ch On-Chain
                </h3>
                <span className="inline-block whitespace-nowrap rounded-md bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                  PHÃ‚N TÃCH AI ({analysis.aiInvestigation.modelUsed})
                </span>
              </div>
              <div className="mt-3 space-y-2.5 break-words text-xs leading-relaxed text-slate-200">
                <p>
                  <strong className="text-white">TÃ³m táº¯t tráº¡ng thÃ¡i: </strong>
                  {analysis.aiInvestigation.askPay.txStatusSummary}
                </p>
                <p>
                  <strong className="text-white">VÃ­ gá»­i (Sender): </strong>
                  {analysis.aiInvestigation.askPay.senderExplanation}
                </p>
                <p>
                  <strong className="text-white">VÃ­ nháº­n / Contract: </strong>
                  {analysis.aiInvestigation.askPay.recipientExplanation}
                </p>
                <p>
                  <strong className="text-white">GiÃ¡ trá»‹ & PhÃ­ Gas: </strong>
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
                    ThÃ´ng tin chÆ°a Ä‘á»§ cÆ¡ sá»Ÿ xÃ¡c minh on-chain:
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
                DoubtStamp â€“ Äá»‘i chiáº¿u Lá»i khai & PhÃ¡t hiá»‡n MÃ¢u thuáº«n
              </h3>
              <span className="text-xs text-slate-400">
                PhÃ¢n loáº¡i: VERIFIED â€¢ CONTRADICTED â€¢ INSUFFICIENT â€¢ UNVERIFIABLE
              </span>
            </div>

            <p className="mt-2 [overflow-wrap:anywhere] text-xs text-slate-300">
              {analysis.aiInvestigation.doubtStamp.overallConsistencySummary}
            </p>

            {/* Uploaded Evidence Commitment Hashes */}
            {analysis.userInput.evidenceFiles.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <div className="text-xs font-semibold text-slate-200">
                  Cam káº¿t toÃ n váº¹n tá»‡p báº±ng chá»©ng (SHA-256 Commitment):
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
                        LÆ°u Ã½: {f.integrityNote}
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
                    <th className="py-2 pr-3">KhÃ­a cáº¡nh Ä‘á»‘i chiáº¿u</th>
                    <th className="py-2 pr-3">Lá»i khai ngÆ°á»i dÃ¹ng</th>
                    <th className="py-2 pr-3">Dá»¯ liá»‡u On-Chain / Báº±ng chá»©ng</th>
                    <th className="py-2 pr-3">Káº¿t luáº­n</th>
                    <th className="py-2 pr-3">LÃ½ do & Nguá»“n dá»¯ liá»‡u</th>
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
                          Nguá»“n: {item.dataSource}
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
                  Äiá»ƒm mÃ¢u thuáº«n phÃ¡t hiá»‡n
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
                    KhÃ´ng phÃ¡t hiá»‡n mÃ¢u thuáº«n trá»±c tiáº¿p vá»›i dá»¯ liá»‡u on-chain.
                  </p>
                )}
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
                <h4 className="text-xs font-bold text-amber-300">
                  Báº±ng chá»©ng cÃ²n thiáº¿u
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
              LEGALMIND â€“ Äá» xuáº¥t HÆ°á»›ng xá»­ lÃ½ & Danh sÃ¡ch kiá»ƒm tra
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
                      {step.category} â€¢ {step.priority}
                    </span>
                    <span className="font-bold text-white">
                      BÆ°á»›c {step.step}: {step.title}
                    </span>
                  </div>
                  <p className="mt-1.5 [overflow-wrap:anywhere] text-slate-300">{step.description}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-3.5 text-xs">
                <div className="font-semibold text-white">
                  PhÃ¢n biá»‡t HÆ°á»›ng dáº«n Ká»¹ thuáº­t & ThÃ´ng tin PhÃ¡p lÃ½:
                </div>
                <p className="mt-1 text-slate-300">
                  {analysis.aiInvestigation.legalMind.technicalVsLegalDistinction}
                </p>
              </div>
              <div className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/50 p-3.5 text-xs">
                <div className="font-semibold text-white">
                  Tham chiáº¿u quy Ä‘á»‹nh & Pháº¡m vi Ã¡p dá»¥ng:
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
              <strong>TuyÃªn bá»‘ giá»›i háº¡n trÃ¡ch nhiá»‡m báº¯t buá»™c:</strong>
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
                      Kiá»ƒm tra chÃ©o 3 Engine (Cross-Engine Check)
                    </h4>
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${analysis.crossEngineCheck.consistent ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                      {analysis.crossEngineCheck.consistent ? "Äá»’NG NHáº¤T" : "PHÃT HIá»†N MÃ‚U THUáºªN"}
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-200">
                    {analysis.crossEngineCheck.finalTransparentConclusion}
                  </p>
                  {analysis.crossEngineCheck.requiresHumanReview && (
                    <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-200">
                      YÃªu cáº§u Human Reviewer kiá»ƒm duyá»‡t trÆ°á»›c khi neo káº¿t quáº£.
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
                      PhÃ¢n rÃ£ Äiá»ƒm Sáºµn sÃ ng (Recovery Readiness)
                    </h4>
                    <span className="whitespace-nowrap rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[11px] font-bold text-cyan-200">
                      {analysis.recoveryReadiness.score}/100 â€¢ {analysis.recoveryReadiness.level}
                    </span>
                  </div>
                  {analysis.recoveryReadiness.capApplied && (
                    <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-1.5 text-[11px] text-rose-200">
                      Giá»›i háº¡n tráº§n Ä‘iá»ƒm: {analysis.recoveryReadiness.capApplied}
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
                Nháº­t kÃ½ kiá»ƒm toÃ¡n há»“ sÆ¡ (Audit History)
              </h4>
              <div className="mt-3 space-y-2.5">
                {analysis.auditHistory.map((log, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 border-l-2 border-cyan-400/50 pl-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-cyan-300">
                      <span>{log.timestamp}</span>
                      <span>â€¢</span>
                      <span>{log.actor}</span>
                      <span>â€¢</span>
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
                  Kiá»ƒm duyá»‡t viÃªn xÃ¡c nháº­n
                </h4>
                <p className="mt-2 text-xs text-slate-400">
                  Theo nguyÃªn táº¯c cá»‘t lÃµi cá»§a TRUSTRECOVER, AI khÃ´ng tá»± Ä‘Æ°a ra phÃ¡n quyáº¿t cuá»‘i cÃ¹ng. Kiá»ƒm duyá»‡t viÃªn con ngÆ°á»i xÃ¡c nháº­n káº¿t quáº£ sau khi Ä‘á»‘i chiáº¿u báº±ng chá»©ng:
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleHumanReviewAction("APPROVED_BY_REVIEWER")}
                  className="w-full rounded-xl bg-emerald-500/20 px-3 py-2.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
                >
                  âœ“ PhÃª duyá»‡t bÃ¡o cÃ¡o Ä‘iá»u tra (Human Approved)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleHumanReviewAction("FLAGGED_FOR_ESCALATION")
                  }
                  className="w-full rounded-xl bg-amber-500/20 px-3 py-2.5 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/40 hover:bg-amber-500/30"
                >
                  âš‘ ÄÃ¡nh dáº¥u cáº§n Ä‘iá»u tra chuyÃªn sÃ¢u (Escalate)
                </button>
                <button
                  type="button"
                  onClick={exportReportJson}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  â¤“ Xuáº¥t BÃ¡o cÃ¡o Kiá»ƒm toÃ¡n (.json)
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
                                detail: `Reviewer ${reviewerAddress} Ä‘Ã£ neo há»“ sÆ¡ lÃªn Avalanche Fuji Testnet (Tx: ${anchorTxHash}).`,
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
