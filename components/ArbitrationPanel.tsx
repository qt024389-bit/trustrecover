"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, formatEther, keccak256, toUtf8Bytes } from "ethers";
import { ARBITRATION_ABI, ARBITRATION_CONTRACT_ADDRESS } from "@/lib/avalanche/arbitrationContract";

interface ArbitrationCaseView {
  caseId: string;
  reportHash: string;
  submitter: string;
  stakeAvax: string;
  approveVotes: number;
  rejectVotes: number;
  state: number;
  stakeClaimed: boolean;
}

const STATE_LABELS = ["CHƯA GỬI", "ĐANG MỞ BỎ PHIẾU (OPEN)", "ĐÃ CHẤP THUẬN (APPROVED)", "ĐÃ TỪ CHỐI (REJECTED)"];

export default function ArbitrationPanel({
  caseId,
  reportPayload,
}: {
  caseId: string;
  reportPayload: unknown;
}) {
  const [caseInfo, setCaseInfo] = useState<ArbitrationCaseView | null>(null);
  const [minStakeWei, setMinStakeWei] = useState<bigint>(BigInt("10000000000000000"));
  const [requiredVotes, setRequiredVotes] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadOnChain = useCallback(async () => {
    try {
      const rpc = new JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc", {
        chainId: 43113,
        name: "avalanche-fuji",
      });
      const c = new Contract(ARBITRATION_CONTRACT_ADDRESS, ARBITRATION_ABI, rpc);
      const [minStake, reqVotes, rawCase] = await Promise.all([
        c.minStakeWei(),
        c.requiredVotes(),
        c.getCase(caseId),
      ]);
      setMinStakeWei(BigInt(minStake));
      setRequiredVotes(Number(reqVotes));
      setCaseInfo({
        caseId: rawCase.caseId,
        reportHash: rawCase.reportHash,
        submitter: rawCase.submitter,
        stakeAvax: formatEther(rawCase.stakeAmount),
        approveVotes: Number(rawCase.approveVotes),
        rejectVotes: Number(rawCase.rejectVotes),
        state: Number(rawCase.state),
        stakeClaimed: Boolean(rawCase.stakeClaimed),
      });
    } catch {
      // Silent fallback if RPC busy
    }
  }, [caseId]);

  useEffect(() => {
    loadOnChain();
  }, [loadOnChain]);

  async function getFujiSigner() {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) {
      throw new Error("Vui lòng cài đặt MetaMask để thao tác on-chain.");
    }
    await eth.request({ method: "eth_requestAccounts" });
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xa869" }],
      });
    } catch {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xa869",
            chainName: "Avalanche Fuji C-Chain",
            rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
            nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
            blockExplorerUrls: ["https://testnet.snowtrace.io"],
          },
        ],
      });
    }
    const provider = new BrowserProvider(eth as never);
    return provider.getSigner();
  }

  async function handleSubmitStake() {
    setBusy(true);
    setMsg(null);
    try {
      const signer = await getFujiSigner();
      const c = new Contract(ARBITRATION_CONTRACT_ADDRESS, ARBITRATION_ABI, signer);
      const reportHash = keccak256(toUtf8Bytes(JSON.stringify(reportPayload)));
      const tx = await c.submitDisputeWithStake(caseId, reportHash, { value: minStakeWei });
      setMsg(`Đã gửi giao dịch ký quỹ (${tx.hash.slice(0, 12)}...), đang chờ xác nhận...`);
      await tx.wait();
      setMsg("Đã gửi hồ sơ & ký quỹ AVAX lên Trọng tài On-Chain thành công!");
      await loadOnChain();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Giao dịch ký quỹ thất bại.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVote(approve: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const signer = await getFujiSigner();
      const c = new Contract(ARBITRATION_CONTRACT_ADDRESS, ARBITRATION_ABI, signer);
      const tx = await c.voteResolution(caseId, approve);
      setMsg(`Đang gửi phiếu bầu ${approve ? "Chấp thuận" : "Từ chối"}...`);
      await tx.wait();
      setMsg("Đã ghi nhận phiếu bầu Trọng tài trên Avalanche Fuji!");
      await loadOnChain();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Bỏ phiếu thất bại (chỉ Reviewer hợp lệ mới được bỏ phiếu).");
    } finally {
      setBusy(false);
    }
  }

  async function handleRelease() {
    setBusy(true);
    setMsg(null);
    try {
      const signer = await getFujiSigner();
      const c = new Contract(ARBITRATION_CONTRACT_ADDRESS, ARBITRATION_ABI, signer);
      const tx = await c.releaseStake(caseId);
      setMsg("Đang giải ngân khoản ký quỹ AVAX...");
      await tx.wait();
      setMsg("Đã giải ngân ký quỹ AVAX thành công!");
      await loadOnChain();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Không thể giải ngân ký quỹ.");
    } finally {
      setBusy(false);
    }
  }

  const stateIdx = caseInfo?.state ?? 0;

  return (
    <div className="rounded-2xl border border-indigo-400/20 bg-slate-900/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
            Trọng tài Đồng thuận On-Chain &amp; Ký quỹ AVAX (Arbitration Contract)
          </h4>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            Contract:{" "}
            <a
              href={`https://testnet.snowtrace.io/address/${ARBITRATION_CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 underline"
            >
              {ARBITRATION_CONTRACT_ADDRESS}
            </a>
          </p>
        </div>
        <span className="whitespace-nowrap rounded-full bg-indigo-500/20 px-3 py-1 text-[11px] font-semibold text-indigo-200">
          {STATE_LABELS[stateIdx] || "KHÔNG RÕ"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
          <div className="text-slate-400">Ký quỹ tối thiểu</div>
          <div className="mt-1 font-bold text-slate-100">{formatEther(minStakeWei)} AVAX</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
          <div className="text-slate-400">Phiếu bầu (Chấp thuận / Từ chối)</div>
          <div className="mt-1 font-bold text-slate-100">
            {caseInfo?.approveVotes ?? 0} / {caseInfo?.rejectVotes ?? 0} (Cần: {requiredVotes})
          </div>
        </div>
        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3">
          <div className="text-slate-400">Trạng thái ký quỹ</div>
          <div className="mt-1 font-bold text-slate-100">
            {stateIdx === 0
              ? "Chưa nộp ký quỹ"
              : caseInfo?.stakeClaimed
              ? `Đã giải ngân (${caseInfo.stakeAvax} AVAX)`
              : `Đang khóa ${caseInfo?.stakeAvax} AVAX`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {stateIdx === 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={handleSubmitStake}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Gửi Hồ sơ &amp; Ký quỹ {formatEther(minStakeWei)} AVAX
          </button>
        )}
        {stateIdx === 1 && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleVote(true)}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              Reviewer Bỏ phiếu: Chấp thuận
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleVote(false)}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
            >
              Reviewer Bỏ phiếu: Từ chối
            </button>
          </>
        )}
        {(stateIdx === 2 || stateIdx === 3) && !caseInfo?.stakeClaimed && (
          <button
            type="button"
            disabled={busy}
            onClick={handleRelease}
            className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
          >
            Giải ngân Ký quỹ AVAX
          </button>
        )}
      </div>

      {msg && (
        <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
          {msg}
        </div>
      )}
    </div>
  );
}