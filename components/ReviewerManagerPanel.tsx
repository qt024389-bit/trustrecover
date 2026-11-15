"use client";

import React, { useState } from "react";
import { BrowserProvider, Contract, isAddress } from "ethers";
import {
  SNOWTRACE_FUJI_URL,
  TRUSTRECOVER_FUJI_CHAIN_HEX,
  TRUSTRECOVER_FUJI_CHAIN_ID,
  TRUSTRECOVER_REGISTRY_ABI,
  TRUSTRECOVER_REGISTRY_ADDRESS,
} from "@/lib/avalanche/registryContract";

export default function ReviewerManagerPanel() {
  const [targetAddress, setTargetAddress] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [txLink, setTxLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function getContractWithSigner() {
    if (!window.ethereum) {
      throw new Error("Không tìm thấy ví MetaMask hoặc Core Wallet.");
    }
    let provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const net = await provider.getNetwork();
    if (Number(net.chainId) !== TRUSTRECOVER_FUJI_CHAIN_ID) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: TRUSTRECOVER_FUJI_CHAIN_HEX }],
      });
      provider = new BrowserProvider(window.ethereum);
    }
    const signer = await provider.getSigner();
    const myAddress = await signer.getAddress();
    const contract = new Contract(
      TRUSTRECOVER_REGISTRY_ADDRESS,
      TRUSTRECOVER_REGISTRY_ABI,
      signer
    );
    return { contract, myAddress };
  }

  async function handleUpdateReviewer(allowed: boolean) {
    setBusy(true);
    setStatusMsg(null);
    setTxLink(null);
    try {
      const addr = targetAddress.trim();
      if (!isAddress(addr)) {
        throw new Error("Địa chỉ ví không hợp lệ (phải là địa chỉ 0x...).");
      }
      const { contract, myAddress } = await getContractWithSigner();
      const contractOwner: string = await contract.owner();
      if (contractOwner.toLowerCase() !== myAddress.toLowerCase()) {
        throw new Error(
          `Chỉ Owner (${contractOwner.slice(0, 6)}...${contractOwner.slice(
            -4
          )}) mới có quyền cấp/gỡ Reviewer.`
        );
      }
      const tx = await contract.setReviewer(addr, allowed);
      await tx.wait();
      setTxLink(`${SNOWTRACE_FUJI_URL}/tx/${tx.hash}`);
      setStatusMsg(
        allowed
          ? `✓ Đã cấp quyền Kiểm duyệt viên (onlyReviewer) cho ví ${addr}.`
          : `✓ Đã thu hồi quyền Kiểm duyệt viên của ví ${addr}.`
      );
    } catch (err: unknown) {
      setStatusMsg(
        err instanceof Error ? err.message : "Không thể cập nhật quyền Reviewer."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#111b2d] p-5 text-xs sm:col-span-2">
      <h3 className="text-sm font-semibold text-white">
        Quản lý Kiểm duyệt viên (Smart Contract v2 • onlyOwner)
      </h3>
      <p className="mt-1 text-slate-400">
        Chỉ ví chủ sở hữu hợp đồng mới có quyền thêm hoặc gỡ ví kiểm duyệt viên hợp lệ trên Avalanche Fuji.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={targetAddress}
          onChange={(e) => setTargetAddress(e.target.value)}
          placeholder="Nhập địa chỉ ví Reviewer (0x...)..."
          className="flex-1 rounded-xl border border-white/10 bg-slate-950/80 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => handleUpdateReviewer(true)}
          className="rounded-xl bg-emerald-500/20 px-4 py-2 font-semibold text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30 disabled:opacity-50"
        >
          {busy ? "Đang xử lý..." : "+ Cấp quyền Reviewer"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleUpdateReviewer(false)}
          className="rounded-xl bg-rose-500/20 px-4 py-2 font-semibold text-rose-300 ring-1 ring-rose-500/40 hover:bg-rose-500/30 disabled:opacity-50"
        >
          Gỡ quyền
        </button>
      </div>

      {statusMsg && (
        <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/70 p-3 text-slate-200">
          <div>{statusMsg}</div>
          {txLink && (
            <a
              href={txLink}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block break-all font-mono text-cyan-300 underline"
            >
              Xem giao dịch trên Snowtrace Fuji ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}