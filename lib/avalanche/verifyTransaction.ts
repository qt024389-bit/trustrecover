import { Interface, JsonRpcProvider, formatEther } from "ethers";

const ERC20_IFACE = new Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);
import {
  VerifyTransactionResult,
  TransactionLogItem,
} from "./types";

const FUJI_CHAIN_ID = 43113;
const TX_HASH_REGEX = /^0x([A-Fa-f0-9]{64})$/;

export function isValidTxHash(txHash: unknown): txHash is string {
  return typeof txHash === "string" && TX_HASH_REGEX.test(txHash.trim());
}

function getFujiProvider(): JsonRpcProvider {
  const rpcUrl =
    process.env.AVALANCHE_FUJI_RPC_URL ||
    "https://api.avax-test.network/ext/bc/C/rpc";

  return new JsonRpcProvider(rpcUrl, {
    chainId: FUJI_CHAIN_ID,
    name: "avalanche-fuji",
  });
}

export async function verifyFujiTransaction(
  rawTxHash: unknown
): Promise<VerifyTransactionResult> {
  const queriedAt = new Date().toISOString();

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
    const provider = getFujiProvider();

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== FUJI_CHAIN_ID) {
      return {
        success: false,
        verifiedOnChain: false,
        error: {
          code: "CHAIN_MISMATCH",
          message: `Chain ID từ RPC (${network.chainId.toString()}) không khớp với Avalanche Fuji Testnet (${FUJI_CHAIN_ID}).`,
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
          message:
            "Không tìm thấy giao dịch này trên Avalanche Fuji Testnet (Chain ID 43113).",
        },
        queriedAt,
      };
    }

    const logs: TransactionLogItem[] = receipt
      ? receipt.logs.map((log) => {
          let decodedEvent: { name: string; args: Record<string, string> } | undefined;
          try {
            const parsed = ERC20_IFACE.parseLog({
              topics: [...log.topics],
              data: log.data,
            });
            if (parsed) {
              const args: Record<string, string> = {};
              parsed.fragment.inputs.forEach((input, idx) => {
                args[input.name || `arg${idx}`] = String(parsed.args[idx]);
              });
              decodedEvent = { name: parsed.name, args };
            }
          } catch {
            // Non-ERC20 log
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

    return {
      success: true,
      data: {
        verifiedOnChain: true,
        network: {
          name: "Avalanche Fuji Testnet",
          chainId: FUJI_CHAIN_ID,
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
        message: `Không thể kết nối hoặc truy vấn Avalanche Fuji RPC: ${rawMessage.replace(
          /https?:\/\/[^\s]+/g,
          "[REDACTED_RPC_URL]"
        )}`,
      },
      queriedAt,
    };
  }
}
