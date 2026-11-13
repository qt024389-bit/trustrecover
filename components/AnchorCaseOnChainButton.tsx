"use client";

import React, { useState } from "react";
import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from "ethers";
import {
  SNOWTRACE_FUJI_URL,
  TRUSTRECOVER_FUJI_CHAIN_HEX,
  TRUSTRECOVER_FUJI_CHAIN_ID,
  TRUSTRECOVER_REGISTRY_ABI,
  TRUSTRECOVER_REGISTRY_ADDRESS,
} from "@/lib/avalanche/registryContract";
import type { DisputeCaseAnalysis } from "@/lib/dispute/types";

interface AnchorCaseOnChainButtonProps {
  analysis: DisputeCaseAnalysis;
  onAnchored?: (anchorTxHash: string, reviewerAddress: string) => void;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export default function AnchorCaseOnChainButton({
  analysis,
  onAnchored,
}: AnchorCaseOnChainButtonProps) {
  const [anchoring, setAnchoring] = useState(false);
  const [anchorTxHash, setAnchorTxHash] = useState<string | null>(null);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  async function handleAnchorOnFuji() {
    setAnchoring(true);
    setAnchorError(null);

    try {
      if (!window.ethereum) {
        throw new Error(
          "Không tìm thấy ví MetaMask hoặc Core Wallet trên trình duyệt."
        );
      }

      let provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);

      const network = await provider.getNetwork();
      if (Number(network.chainId) !== TRUSTRECOVER_FUJI_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: TRUSTRECOVER_FUJI_CHAIN_HEX }],
          });
        } catch {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: TRUSTRECOVER_FUJI_CHAIN_HEX,
                chainName: "Avalanche Fuji C-Chain",
                nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
                rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
                blockExplorerUrls: [SNOWTRACE_FUJI_URL],
              },
            ],
          });
        }
      }

      provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const reviewerAddress = await signer.getAddress();

      const contract = new Contract(
        TRUSTRECOVER_REGISTRY_ADDRESS,
        TRUSTRECOVER_REGISTRY_ABI,
        signer
      );

      const rawTxHash = analysis.userInput.txHash.trim();
      const txHashBytes32 = /^0x[A-Fa-f0-9]{64}$/.test(rawTxHash)
        ? rawTxHash
        : keccak256(toUtf8Bytes(rawTxHash));

      const reportPayload = JSON.stringify({
        caseId: analysis.caseId,
        txHash: rawTxHash,
        score: analysis.aiInvestigation.doubtStamp.evidenceSufficiencyScore,
        findings: analysis.aiInvestigation.doubtStamp.findings,
        askPaySummary: analysis.aiInvestigation.askPay.txStatusSummary,
      });
      const reportHash = keccak256(toUtf8Bytes(reportPayload));

      const verdictSummary = `SCORE_${analysis.aiInvestigation.doubtStamp.evidenceSufficiencyScore}_HUMAN_APPROVED`;

      const tx = await contract.anchorCase(
        analysis.caseId,
        txHashBytes32,
        reportHash,
        verdictSummary
      );

      await tx.wait();
      setAnchorTxHash(tx.hash);
      if (onAnchored) {
        onAnchored(tx.hash, reviewerAddress);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Không thể ký giao dịch neo hồ sơ lên Avalanche Fuji.";
      setAnchorError(msg);
    } finally {
      setAnchoring(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
      <button
        type="button"
        onClick={handleAnchorOnFuji}
        disabled={anchoring || Boolean(anchorTxHash)}
        className="w-full rounded-xl bg-cyan-500/20 px-3 py-2.5 text-xs font-bold text-cyan-200 ring-1 ring-cyan-400/40 transition hover:bg-cyan-500/30 disabled:opacity-50"
      >
        {anchoring
          ? "Đang chờ MetaMask ký & xác nhận trên Fuji..."
          : anchorTxHash
          ? "✓ Đã neo hồ sơ vĩnh viễn trên Avalanche Fuji"
          : "⛓ Ký & Neo Hồ Sơ Lên Avalanche Fuji (On-Chain)"}
      </button>

      {anchorTxHash && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 p-2.5 text-[11px] text-emerald-200">
          <div className="font-semibold text-emerald-300">
            Đã ghi Audit Trail lên Avalanche Fuji!
          </div>
          <a
            href={`${SNOWTRACE_FUJI_URL}/tx/${anchorTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all font-mono text-cyan-300 underline hover:text-cyan-200"
          >
            Xem trên Snowtrace Fuji: {anchorTxHash}
          </a>
        </div>
      )}

      {anchorError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/30 p-2 text-[11px] text-rose-200">
          {anchorError}
        </div>
      )}
    </div>
  );
}