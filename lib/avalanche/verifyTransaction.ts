import { Interface, JsonRpcProvider, formatEther } from "ethers";
import { resolveAvalancheNetwork, type AvalancheNetworkConfig } from "./networks";
import { VerifyTransactionResult, TransactionLogItem } from "./types";

const ERC20_IFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

const AWM_IFACE = new Interface([
  "event SendWarpMessage(address indexed sender, bytes32 indexed messageID, bytes message)",
]);

const TX_HASH_REGEX = /^0x([A-Fa-f0-9]{64})$/;

export function isValidTxHash(txHash: unknown): txHash is string {
  return typeof txHash === "string" && TX_HASH_REGEX.test(txHash.trim());
}

function getAvalancheProvider(cfg: AvalancheNetworkConfig): JsonRpcProvider {
  return new JsonRpcProvider(cfg.rpcUrl, {
    chainId: cfg.chainId,
    name: cfg.id,
  });
}

export async function verifyFujiTransaction(
  rawTxHash: unknown,
  rawNetwork?: unknown
): Promise<VerifyTransactionResult> {
  const queriedAt = new Date().toISOString();
  const cfg = resolveAvalancheNetwork(rawNetwork);

  if (!isValidTxHash(rawTxHash)) {
    return {
      success: false,
      verifiedOnChain: false,
      error: {
        code: "INVALID_HASH",
        message:
          "Transaction hash không hợp lệ. Hash phải bắt đầu bằng '0x' và theo sau bởi đúng 64 ký tự hex (0-9, a-f).",
      },
      queriedAt,
    };
  }

  const txHash = rawTxHash.trim();

  try {
    const provider = getAvalancheProvider(cfg);
    const network = await provider.getNetwork();

    if (Number(network.chainId) !== cfg.chainId) {
      return {
        success: false,
        verifiedOnChain: false,
        error: {
          code: "CHAIN_MISMATCH",
          message: `Chain ID từ RPC (${network.chainId.toString()}) không khớp với ${cfg.name} (${cfg.chainId}).`,
        },
        queriedAt,
      };
    }

    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!tx) {
      return {
        success: false,
        verifiedOnChain: false,
        error: {
          code: "TX_NOT_FOUND",
          message: `Không tìm thấy giao dịch này trên ${cfg.name} (Chain ID ${cfg.chainId}).`,
        },
        queriedAt,
      };
    }

    const logs: TransactionLogItem[] = receipt
      ? receipt.logs.map((log) => {
          let decodedEvent: { name: string; args: Record<string, string> } | undefined;
          for (const iface of [ERC20_IFACE, AWM_IFACE]) {
            try {
              const parsed = iface.parseLog({
                topics: [...log.topics],
                data: log.data,
              });
              if (parsed) {
                const args: Record<string, string> = {};
                parsed.fragment.inputs.forEach((input, idx) => {
                  args[input.name || `arg${idx}`] = String(parsed.args[idx]);
                });
                decodedEvent = { name: parsed.name, args };
                break;
              }
            } catch {
              // Ignore non-matching log
            }
          }
          return {
            logIndex: log.index,
            address: log.address,
            topics: [...log.topics],
            data: log.data,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            ...(decodedEvent ? { decodedEvent } : {}),
          };
        })
      : [];

    let status: "confirmed" | "failed" | "pending" = "pending";
    if (receipt) {
      status = receipt.status === 1 ? "confirmed" : "failed";
    }

    let recipientProfile: {
      address: string;
      isContract: boolean;
      balanceAvax: string;
    } | null = null;

    if (tx.to) {
      try {
        const [code, balWei] = await Promise.all([
          provider.getCode(tx.to),
          provider.getBalance(tx.to),
        ]);
        recipientProfile = {
          address: tx.to,
          isContract: code !== "0x" && code.length > 2,
          balanceAvax: formatEther(balWei),
        };
      } catch {
        recipientProfile = null;
      }
    }

    return {
      success: true,
      data: {
        verifiedOnChain: true,
        network: {
          name: cfg.name,
          chainId: cfg.chainId,
        },
        transaction: {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          valueWei: tx.value.toString(),
          valueAvax: formatEther(tx.value),
          nonce: tx.nonce,
          gasLimit: tx.gasLimit.toString(),
          blockNumber: tx.blockNumber,
          blockHash: tx.blockHash,
        },
        receipt: {
          status,
          statusCode: receipt ? receipt.status : null,
          blockNumber: receipt ? receipt.blockNumber : null,
          gasUsed: receipt ? receipt.gasUsed.toString() : null,
          effectiveGasPrice:
            receipt && receipt.gasPrice ? receipt.gasPrice.toString() : null,
          contractAddress: receipt ? receipt.contractAddress : null,
          logsCount: logs.length,
          logs,
        },
        recipientProfile,
        queriedAt,
      },
    };
  } catch (err: unknown) {
    const rawMessage =
      err instanceof Error ? err.message : "Lỗi không xác định khi gọi RPC";
    return {
      success: false,
      verifiedOnChain: false,
      error: {
        code: "RPC_ERROR",
        message: `Không thể kết nối hoặc truy vấn ${cfg.name} RPC: ${rawMessage.replace(
          /https?:\/\/[^\s]+/g,
          "[REDACTED_RPC_URL]"
        )}`,
      },
      queriedAt,
    };
  }
}

export const verifyAvalancheTransaction = verifyFujiTransaction;