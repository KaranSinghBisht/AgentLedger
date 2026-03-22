"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { type Address, keccak256, toBytes } from "viem";
import { escrowAbi } from "@/lib/escrow-abi";
import { ESCROW_ADDRESS } from "@/lib/wagmi-config";
import { TxStatus } from "./tx-status";

interface SubmitWorkButtonProps {
  jobId: number;
  provider: string;
}

export function SubmitWorkButton({ jobId, provider }: SubmitWorkButtonProps) {
  const { address, isConnected } = useAccount();
  const [deliverableInput, setDeliverableInput] = useState("");
  const [formError, setFormError] = useState("");

  const {
    data: hash,
    isPending,
    error: writeError,
    writeContract,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  const isProvider =
    isConnected && address?.toLowerCase() === provider.toLowerCase();

  if (!isConnected) {
    return (
      <p className="text-xs font-mono text-[rgb(var(--text-muted))] uppercase tracking-widest text-center py-3">
        Connect wallet to submit work
      </p>
    );
  }

  if (!isProvider) {
    return (
      <p className="text-xs font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest text-center py-3">
        Only the assigned provider can submit work.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const input = deliverableInput.trim();
    if (!input) {
      setFormError("Enter a deliverable hash or description to hash.");
      return;
    }

    // If it looks like a valid bytes32 hex, use as-is; otherwise hash the input
    const deliverable: `0x${string}` = /^0x[0-9a-fA-F]{64}$/.test(input)
      ? (input as `0x${string}`)
      : keccak256(toBytes(input));

    writeContract({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "submit",
      args: [BigInt(jobId), deliverable, "0x" as Address],
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest">
          Deliverable (bytes32 hash or text to hash)
        </label>
        <input
          type="text"
          value={deliverableInput}
          onChange={(e) => setDeliverableInput(e.target.value)}
          placeholder="0x... or descriptive text"
          className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border-color))] px-4 py-3 font-mono text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--text-dim))] focus:border-emerald-500/50 focus:outline-none transition-colors"
          disabled={isPending || isConfirming}
        />
      </div>

      {formError && (
        <p className="text-xs font-mono text-red-400 uppercase tracking-wider">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || isConfirming || isConfirmed}
        className="w-full py-3 bg-purple-500 text-black font-bold font-space text-sm uppercase italic hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending
          ? "Awaiting Signature..."
          : isConfirming
            ? "Confirming..."
            : isConfirmed
              ? "Work Submitted"
              : "Submit Deliverable"}
      </button>

      <TxStatus
        hash={hash}
        isPending={isPending}
        isConfirming={isConfirming}
        isConfirmed={isConfirmed}
        error={writeError}
      />
    </form>
  );
}
