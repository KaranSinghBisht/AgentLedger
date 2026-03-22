import type { Hash } from "viem";
import { getPublicClient } from "../blockchain/clients.js";
import * as escrow from "./escrow.js";

export async function completeJobAndWait(
  jobId: bigint,
  reason: string
): Promise<{ txHash: Hash; status: string }> {
  const txHash = await escrow.completeJob(jobId, reason);
  const pub = getPublicClient();
  const receipt = await pub.getTransactionReceipt({ hash: txHash });
  const status = receipt.status === "success" ? "confirmed" : "reverted";
  if (status === "reverted") {
    throw new Error(`completeJob tx ${txHash} was mined but reverted onchain`);
  }
  return { txHash, status };
}

export async function rejectJobAndWait(
  jobId: bigint,
  reason: string
): Promise<{ txHash: Hash; status: string }> {
  const txHash = await escrow.rejectJob(jobId, reason);
  const pub = getPublicClient();
  const receipt = await pub.getTransactionReceipt({ hash: txHash });
  const status = receipt.status === "success" ? "confirmed" : "reverted";
  if (status === "reverted") {
    throw new Error(`rejectJob tx ${txHash} was mined but reverted onchain`);
  }
  return { txHash, status };
}
