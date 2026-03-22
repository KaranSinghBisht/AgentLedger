import { describe, it, expect, beforeEach } from "vitest";
import { parseUnits, type Address } from "viem";
import { submitBid, getBidsForJob, getBestBid, clearBids } from "../marketplace/bid-registry.js";

const WORKER_A = "0xCA1Fa75626240543F092d0EB1016483bA6cE97FA" as Address;
const WORKER_B = "0x273e054f21de7c3C30Fbfa0c282Fe78a8b10c0f8" as Address;
const JOB_ID = 1n;

describe("BidRegistry", () => {
  beforeEach(() => clearBids());

  it("submits and retrieves bids", () => {
    submitBid({ jobId: JOB_ID, agent: WORKER_A, agentId: 1, proposedBudget: parseUnits("15", 6), reason: "Fast delivery", timestamp: Date.now(), reputation: 80 });
    const bids = getBidsForJob(JOB_ID);
    expect(bids).toHaveLength(1);
    expect(bids[0].agent).toBe(WORKER_A);
  });

  it("returns empty for unknown job", () => {
    expect(getBidsForJob(999n)).toHaveLength(0);
  });

  it("getBestBid cheapest picks lowest price", () => {
    submitBid({ jobId: JOB_ID, agent: WORKER_A, agentId: 1, proposedBudget: parseUnits("15", 6), reason: "Cheap", timestamp: Date.now(), reputation: 50 });
    submitBid({ jobId: JOB_ID, agent: WORKER_B, agentId: 2, proposedBudget: parseUnits("25", 6), reason: "Expensive", timestamp: Date.now(), reputation: 90 });
    const best = getBestBid(JOB_ID, "cheapest");
    expect(best?.agent).toBe(WORKER_A);
  });

  it("getBestBid best_value weights reputation against cost", () => {
    submitBid({ jobId: JOB_ID, agent: WORKER_A, agentId: 1, proposedBudget: parseUnits("15", 6), reason: "Cheap low rep", timestamp: Date.now(), reputation: 10 });
    submitBid({ jobId: JOB_ID, agent: WORKER_B, agentId: 2, proposedBudget: parseUnits("20", 6), reason: "Slightly more but high rep", timestamp: Date.now(), reputation: 90 });
    // Score A: 10 - 15 = -5, Score B: 90 - 20 = 70 → B wins
    const best = getBestBid(JOB_ID, "best_value");
    expect(best?.agent).toBe(WORKER_B);
  });

  it("getBestBid returns null for no bids", () => {
    expect(getBestBid(JOB_ID, "cheapest")).toBeNull();
  });

  it("clearBids removes all bids", () => {
    submitBid({ jobId: JOB_ID, agent: WORKER_A, agentId: 1, proposedBudget: parseUnits("15", 6), reason: "Test", timestamp: Date.now() });
    clearBids();
    expect(getBidsForJob(JOB_ID)).toHaveLength(0);
  });
});
