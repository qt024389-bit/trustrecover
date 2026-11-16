export type AvalancheNetworkId = "fuji" | "dispatch" | "mainnet";

export interface AvalancheNetworkConfig {
  id: AvalancheNetworkId;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerTxBase: string;
  nativeSymbol: string;
}

export const AVALANCHE_NETWORKS: Record<AvalancheNetworkId, AvalancheNetworkConfig> = {
  fuji: {
    id: "fuji",
    name: "Avalanche Fuji C-Chain",
    chainId: 43113,
    rpcUrl:
      process.env.AVALANCHE_FUJI_RPC_URL ||
      "https://api.avax-test.network/ext/bc/C/rpc",
    explorerTxBase: "https://testnet.snowtrace.io/tx/",
    nativeSymbol: "AVAX",
  },
  dispatch: {
    id: "dispatch",
    name: "Dispatch L1 Testnet (Avalanche ICM)",
    chainId: 779672,
    rpcUrl:
      process.env.AVALANCHE_DISPATCH_RPC_URL ||
      "https://subnets.avax.network/dispatch/testnet/rpc",
    explorerTxBase: "https://subnets-test.avax.network/dispatch/tx/",
    nativeSymbol: "DISP",
  },
  mainnet: {
    id: "mainnet",
    name: "Avalanche C-Chain Mainnet",
    chainId: 43114,
    rpcUrl:
      process.env.AVALANCHE_MAINNET_RPC_URL ||
      "https://api.avax.network/ext/bc/C/rpc",
    explorerTxBase: "https://snowtrace.io/tx/",
    nativeSymbol: "AVAX",
  },
};

export function resolveAvalancheNetwork(raw?: unknown): AvalancheNetworkConfig {
  if (raw === "dispatch") return AVALANCHE_NETWORKS.dispatch;
  if (raw === "mainnet") return AVALANCHE_NETWORKS.mainnet;
  return AVALANCHE_NETWORKS.fuji;
}