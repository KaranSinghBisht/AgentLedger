import type { Hash } from "viem";
import { getPublicClient } from "../blockchain/clients.js";
import * as escrow from "./escrow.js";

export async function completeJobAndWait(
  jobId: bigint,
  reason: string
): Promise<{ txHash: Hash; status: string }> {
  const pub = getPublicClient();
  const txHash = await escrow.completeJob(jobId, reason);
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  return {
    txHash,
    status: receipt.status === "success" ? "confirmed" : "failed",
  };
}

export async function rejectJobAndWait(
  jobId: bigint,
  reason: string
): Promise<{ txHash: Hash; status: string }> {
  const pub = getPublicClient();
  const txHash = await escrow.rejectJob(jobId, reason);
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  return {
    txHash,
    status: receipt.status === "success" ? "confirmed" : "failed",
  };
}
