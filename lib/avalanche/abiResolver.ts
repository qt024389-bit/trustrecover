import { Interface } from "ethers";

const abiCache = new Map<string, Interface | null>();

export async function fetchVerifiedContractInterface(
  chainId: number,
  address: string
): Promise<Interface | null> {
  const key = `${chainId}:${address.toLowerCase()}`;
  if (abiCache.has(key)) {
    return abiCache.get(key) ?? null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);

  try {
    const netSeg = chainId === 43114 ? "mainnet" : "testnet";
    const url = `https://api.routescan.io/v2/network/${netSeg}/evm/${chainId}/etherscan/api?module=contract&action=getabi&address=${address}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      abiCache.set(key, null);
      return null;
    }
    const json = (await res.json()) as { status?: string; result?: string };
    if (json.status === "1" && typeof json.result === "string" && json.result.startsWith("[")) {
      const iface = new Interface(json.result);
      abiCache.set(key, iface);
      return iface;
    }
    abiCache.set(key, null);
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}