"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { type Address } from "viem";
import { escrowAbi, erc20Abi } from "@/lib/escrow-abi";
import { ESCROW_ADDRESS, USDC_ADDRESS } from "@/lib/wagmi-config";
import { TxStatus } from "./tx-status";

type Step = "idle" | "approving" | "funding";

interface FundJobButtonProps {
  jobId: number;
  budget: bigint;
}

export function FundJobButton({ jobId, budget }: FundJobButtonProps) {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<Step>("idle");

  // Check current allowance so we can skip approve if sufficient
  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ESCROW_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // Approve tx
  const {
    data: approveHash,
    isPending: approvePending,
    error: approveError,
    writeContract: writeApprove,
  } = useWriteContract();

  const { isLoading: approveConfirming, isSuccess: approveConfirmed } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Fund tx
  const {
    data: fundHash,
    isPending: fundPending,
    error: fundError,
    writeContract: writeFund,
  } = useWriteContract();

  const { isLoading: fundConfirming, isSuccess: fundConfirmed } =
    useWaitForTransactionReceipt({ hash: fundHash });

  const needsApproval =
    allowance === undefined || (allowance as bigint) < budget;

  function handleClick() {
    if (!isConnected) return;

    if (needsApproval && step === "idle") {
      setStep("approving");
      writeApprove({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [ESCROW_ADDRESS, budget],
      });
      return;
    }

    // Either approval is not needed, or it just confirmed
    setStep("funding");
    writeFund({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "fund",
      args: [BigInt(jobId), "0x" as Address],
    });
  }

  // Auto-advance from approve to fund once confirmed
  if (approveConfirmed && step === "approving") {
    setStep("funding");
    writeFund({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "fund",
      args: [BigInt(jobId), "0x" as Address],
    });
  }

  if (!isConnected) {
    return (
      <p className="text-xs font-mono text-[rgb(var(--text-muted))] uppercase tracking-widest text-center py-3">
        Connect wallet to fund
      </p>
    );
  }

  const isProcessing =
    approvePending || approveConfirming || fundPending || fundConfirming;

  const buttonLabel = (() => {
    if (approvePending) return "Approve USDC...";
    if (approveConfirming) return "Confirming Approval...";
    if (fundPending) return "Signing Fund...";
    if (fundConfirming) return "Confirming Fund...";
    if (fundConfirmed) return "Funded";
    if (needsApproval) return "Approve + Fund Escrow";
    return "Fund Escrow";
  })();

  // Show the most relevant tx status
  const activeHash = step === "approving" ? approveHash : fundHash;
  const activeError = step === "approving" ? approveError : fundError;
  const activePending = step === "approving" ? approvePending : fundPending;
  const activeConfirming =
    step === "approving" ? approveConfirming : fundConfirming;
  const activeConfirmed =
    step === "approving" ? approveConfirmed : fundConfirmed;

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isProcessing || fundConfirmed}
        className="w-full py-3 bg-emerald-500 text-black font-bold font-space text-sm uppercase italic hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {buttonLabel}
      </button>
      <TxStatus
        hash={activeHash}
        isPending={activePending}
        isConfirming={activeConfirming}
        isConfirmed={activeConfirmed}
        error={activeError}
      />
    </div>
  );
}
