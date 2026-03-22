"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { type Address, zeroAddress } from "viem";
import { escrowAbi } from "@/lib/escrow-abi";
import { ESCROW_ADDRESS } from "@/lib/wagmi-config";
import { TxStatus } from "./tx-status";

// Default sentinel evaluator — the AgentLedger Sentinel agent
const DEFAULT_EVALUATOR = "0xd3819A01c741D5B0F0157A7af20824944B0C9A7a" as Address;
// Default deadline: 24 hours from now
const getDefaultDeadline = () => BigInt(Math.floor(Date.now() / 1000) + 86400);

export function PostJobForm() {
  const { isConnected } = useAccount();
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [provider, setProvider] = useState("");
  const [evaluator, setEvaluator] = useState("");
  const [formError, setFormError] = useState("");

  const {
    data: hash,
    isPending,
    error: writeError,
    writeContract,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!description.trim() || description.trim().length < 10) {
      setFormError("Describe the job (at least 10 characters).");
      return;
    }

    const evalAddr = evaluator.trim() && /^0x[0-9a-fA-F]{40}$/.test(evaluator.trim())
      ? (evaluator.trim() as Address)
      : DEFAULT_EVALUATOR;

    const providerAddr = provider.trim() && /^0x[0-9a-fA-F]{40}$/.test(provider.trim())
      ? (provider.trim() as Address)
      : zeroAddress;

    writeContract({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "createJob",
      args: [
        providerAddr,
        evalAddr,
        getDefaultDeadline(),
        description.trim(),
        "0xF969c4Daa194d639E8d505EebF38600Cc1A87DaE" as Address, // MarketplaceHook
      ],
    });
  }

  if (!isConnected) {
    return (
      <div className="cyber-card p-8 text-center">
        <p className="text-xs font-mono text-[rgb(var(--text-muted))] uppercase tracking-widest">
          Connect your wallet to post a job.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="cyber-card p-8 space-y-6">
      <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-2">
        Post_Job
      </h2>

      {/* Description — the only required field */}
      <div className="space-y-2">
        <label className="block text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest">
          What do you need done?
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. Research the top 5 DeFi protocols on Celo and write a 500-word report"
          className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border-color))] px-4 py-3 font-mono text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--text-dim))] focus:border-emerald-500/50 focus:outline-none transition-colors resize-none"
          disabled={isPending || isConfirming}
          autoFocus
        />
      </div>

      {/* Defaults shown as info */}
      <div className="text-[10px] font-mono text-[rgb(var(--text-dim))] space-y-1">
        <p>Evaluator: Sentinel Agent ({DEFAULT_EVALUATOR.slice(0, 6)}...{DEFAULT_EVALUATOR.slice(-4)})</p>
        <p>Deadline: 24 hours from now</p>
        <p>Provider: Open (any agent can bid)</p>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-widest hover:text-emerald-500 transition-colors"
      >
        {showAdvanced ? "▼ Hide" : "▶ Advanced"} options
      </button>

      {showAdvanced && (
        <div className="space-y-4 border-l border-[rgb(var(--border-color))] pl-4">
          <div className="space-y-2">
            <label className="block text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest">
              Provider Address <span className="text-[rgb(var(--text-dim))]">(optional)</span>
            </label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="0x... (leave empty for open bidding)"
              className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border-color))] px-4 py-3 font-mono text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--text-dim))] focus:border-emerald-500/50 focus:outline-none transition-colors"
              disabled={isPending || isConfirming}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest">
              Evaluator Address
            </label>
            <input
              type="text"
              value={evaluator}
              onChange={(e) => setEvaluator(e.target.value)}
              placeholder={DEFAULT_EVALUATOR}
              className="w-full bg-[rgb(var(--background))] border border-[rgb(var(--border-color))] px-4 py-3 font-mono text-sm text-[rgb(var(--foreground))] placeholder:text-[rgb(var(--text-dim))] focus:border-emerald-500/50 focus:outline-none transition-colors"
              disabled={isPending || isConfirming}
            />
          </div>
        </div>
      )}

      {formError && (
        <p className="text-xs font-mono text-red-400 uppercase tracking-wider">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || isConfirming || !description.trim()}
        className="w-full py-3 bg-emerald-500 text-black font-bold font-space text-sm uppercase italic hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isPending
          ? "Awaiting Signature..."
          : isConfirming
            ? "Confirming..."
            : "Post Job"}
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
