import type { Address } from "viem";

export interface Bid {
  jobId: bigint;
  agent: Address;
  agentId: number;
  proposedBudget: bigint;
  reason: string;
  timestamp: number;
  reputation?: number;
}

const bids = new Map<string, Bid[]>();

export function submitBid(bid: Bid): void {
  const key = bid.jobId.toString();
  const existing = bids.get(key) ?? [];
  existing.push(bid);
  bids.set(key, existing);
}

export function getBidsForJob(jobId: bigint): Bid[] {
  return bids.get(jobId.toString()) ?? [];
}

export function getBestBid(jobId: bigint, strategy: "cheapest" | "best_value"): Bid | null {
  const jobBids = getBidsForJob(jobId);
  if (jobBids.length === 0) return null;

  if (strategy === "cheapest") {
    return jobBids.reduce((best, bid) => bid.proposedBudget < best.proposedBudget ? bid : best);
  }
  // best_value — weight reputation against cost (reputation from ERC-8004)
  return jobBids.reduce((best, bid) => {
    const bidScore = (bid.reputation ?? 0) - Number(bid.proposedBudget) / 1e6;
    const bestScore = (best.reputation ?? 0) - Number(best.proposedBudget) / 1e6;
    return bidScore > bestScore ? bid : best;
  });
}

export function clearBids(): void {
  bids.clear();
}
