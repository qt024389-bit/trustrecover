"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AbiCoder, BrowserProvider, Contract, JsonRpcProvider, formatEther, id } from "ethers";
import { ARBITRATION_ABI, ARBITRATION_CONTRACT_ADDRESS } from "@/lib/avalanche/arbitrationContract";

interface QueueItem {
  caseId: string;
  submitter: string;
  stakeAvax: string;
  approveVotes: number;
  rejectVotes: number;
  state: number;
  stakeClaimed: boolean;
}

const STATE_BADGE: Record<number, { text: string; cls: string }> = {
  1: { text: "CHỜ DUYỆT (OPEN)", cls: "bg-amber-500/20 text-amber-300" },
  2: { text: "ĐÃ CHẤP THUẬN", cls: "bg-emerald-500/20 text-emerald-300" },
  3: { text: "ĐÃ TỪ CHỐI", cls: "bg-rose-500/20 text-rose-300" },
};

export default function ArbitrationQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const topic0 = id("DisputeSubmitted(string,bytes32,address,uint256)");
      const url = `https://api.routescan.io/v2/network/testnet/evm/43113/etherscan/api?module=logs&action=getLogs&address=${ARBITRATION_CONTRACT_ADDRESS}&topic0=${topic0}&fromBlock=0&toBlock=latest`;
      const res = await fetch(url);
      const json = (await res.json()) as { status?: string; result?: Array<{ data: string }> };
      if (json.status !== "1" || !Array.isArray(json.result)) {
        setItems([]);
        return;
      }

      const coder = AbiCoder.defaultAbiCoder();
      const caseIds = Array.from(
        new Set(
          json.result
            .map((log) => {
              try {
                const decoded = coder.decode(["string", "uint256"], log.data);
                return String(decoded[0]);
              } catch {
                return "";
              }
            })
            .filter(Boolean)
        )
      ).reverse();

      const rpc = new JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc", {
        chainId: 43113,
        name: "avalanche-fuji",
      });
      const c = new Contract(ARBITRATION_CONTRACT_ADDRESS, ARBITRATION_ABI, rpc);
      const loaded = await Promise.all(
        caseIds.slice(0, 15).map(async (cid) => {
          const raw = await c.getCase(cid);
          return {
            caseId: raw.caseId,
            submitter: raw.submitter,
            stakeAvax: formatEther(raw.stakeAmount),
            approveVotes: Number(raw.approveVotes),
            rejectVotes: Number(raw.rejectVotes),
            state: Number(raw.state),
            stakeClaimed: Boolean(raw.stakeClaimed),
          };
        })
      );
      setItems(loaded.filter((x) => x.state > 0));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  async function getSigner() {
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (!eth) throw new Error("Vui lòng cài MetaMask.");
    await eth.request({ method: "eth_requestAccounts" });
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xa869" }] });
    return new BrowserProvider(eth as never).getSigner();
  }

  async function handleAction(caseId: string, action: "approve" | "reject" | "release") {
    setBusyId(caseId);
    setMsg(null);
    try {
      const signer = await getSigner();
      const c = new Contract(ARBITRATION_CONTRACT_ADDRESS, ARBITRATION_ABI, signer);
      const tx =
        action === "release"
          ? await c.releaseStake(caseId)
          : await c.voteResolution(caseId, action === "approve");
      setMsg(`Đang xử lý ${caseId} (${tx.hash.slice(0, 12)}...)`);
      await tx.wait();
      setMsg(`Đã cập nhật ${caseId} trên Avalanche Fuji!`);
      await loadQueue();
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : "Thao tác on-chain thất bại.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-indigo-400/20 bg-[#111b2d] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Hàng chờ Trọng tài On-Chain (Arbitration Queue)
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Reviewer xem và ký duyệt trực tiếp các hồ sơ đã ký quỹ trên{" "}
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
        <button
          type="button"
          onClick={loadQueue}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          Làm mới hàng chờ
        </button>
      </div>

      {msg && (
        <div className="mb-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
          {msg}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Đang tải danh sách từ Avalanche Fuji...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400">
          Chưa có hồ sơ ký quỹ nào trên contract Trọng tài.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const badge = STATE_BADGE[item.state] || { text: "KHÔNG RÕ", cls: "bg-slate-700 text-slate-200" };
            return (
              <div
                key={item.caseId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-3.5 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">{item.caseId}</span>
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Người gửi: <span className="font-mono">{item.submitter}</span> • Ký quỹ: {item.stakeAvax} AVAX • Phiếu: {item.approveVotes} thuận / {item.rejectVotes} chống
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.state === 1 && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === item.caseId}
                        onClick={() => handleAction(item.caseId, "approve")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        Chấp thuận
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.caseId}
                        onClick={() => handleAction(item.caseId, "reject")}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                  {(item.state === 2 || item.state === 3) && !item.stakeClaimed && (
                    <button
                      type="button"
                      disabled={busyId === item.caseId}
                      onClick={() => handleAction(item.caseId, "release")}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                    >
                      Giải ngân
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}