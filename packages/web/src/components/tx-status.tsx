"use client";

import type { Address } from "viem";
import { celoSepolia } from "@/lib/wagmi-config";

interface TxStatusProps {
  hash?: Address;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
}

export function TxStatus({
  hash,
  isPending,
  isConfirming,
  isConfirmed,
  error,
}: TxStatusProps) {
  if (!isPending && !isConfirming && !isConfirmed && !error) return null;

  const explorerUrl = hash
    ? `${celoSepolia.blockExplorers.default.url}/tx/${hash}`
    : null;

  return (
    <div className="mt-4 p-4 border border-[rgb(var(--border-color))] bg-[rgb(var(--card-bg)/0.4)] font-mono text-xs uppercase tracking-wider">
      {isPending && (
        <div className="flex items-center gap-2 text-yellow-500">
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          Awaiting wallet signature...
        </div>
      )}
      {isConfirming && (
        <div className="flex items-center gap-2 text-blue-400">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Confirming on Celo Sepolia...
        </div>
      )}
      {isConfirmed && (
        <div className="flex items-center gap-2 text-emerald-500">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          Transaction confirmed
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-red-400">
          <div className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
          <span className="break-all normal-case">
            {extractErrorMessage(error)}
          </span>
        </div>
      )}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 text-emerald-500/70 hover:text-emerald-500 transition-colors underline underline-offset-4"
        >
          View on Celoscan
        </a>
      )}
    </div>
  );
}

function extractErrorMessage(error: Error): string {
  const msg = error.message;
  // Shorten wallet rejection messages
  if (msg.includes("User rejected") || msg.includes("user rejected")) {
    return "Transaction rejected by user.";
  }
  // Shorten generic RPC errors
  if (msg.includes("execution reverted")) {
    const match = msg.match(/reason:\s*(.+?)(?:\n|$)/);
    return match ? `Reverted: ${match[1]}` : "Transaction reverted on-chain.";
  }
  // Cap length for readability
  if (msg.length > 200) {
    return msg.slice(0, 200) + "...";
  }
  return msg;
}
