"use client";

import { FundJobButton } from "./fund-job-button";
import { SubmitWorkButton } from "./submit-work-button";

interface JobActionsProps {
  jobId: number;
  status: number;
  budget: string;
  provider: string;
  client: string;
}

/**
 * Renders the correct action widget for a job based on its current status.
 * Status enum: 0=Open, 1=Funded, 2=Submitted, 3=Completed, 4=Rejected, 5=Expired
 */
export function JobActions({
  jobId,
  status,
  budget,
  provider,
  client: _client,
}: JobActionsProps) {
  // Open -- client can fund if budget is set
  if (status === 0) {
    const budgetBn = BigInt(budget);
    if (budgetBn === 0n) {
      return (
        <div className="space-y-3">
          <p className="text-xs font-mono text-[rgb(var(--text-muted))] uppercase tracking-wider leading-relaxed">
            Waiting for provider to propose a budget before funding can proceed.
          </p>
        </div>
      );
    }
    return <FundJobButton jobId={jobId} budget={budgetBn} />;
  }

  // Funded -- provider can submit work
  if (status === 1) {
    return <SubmitWorkButton jobId={jobId} provider={provider} />;
  }

  // Submitted -- awaiting evaluator
  if (status === 2) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
          <span className="text-xs font-mono text-purple-400 uppercase tracking-widest">
            Awaiting Evaluation
          </span>
        </div>
        <p className="text-xs font-mono text-[rgb(var(--text-muted))] uppercase tracking-wider leading-relaxed">
          Deliverable submitted. The evaluator will review and settle the escrow.
        </p>
      </div>
    );
  }

  // Completed
  if (status === 3) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
        <span className="text-xs font-mono text-emerald-500 uppercase tracking-widest">
          Settlement Complete
        </span>
      </div>
    );
  }

  // Rejected
  if (status === 4) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
        <span className="text-xs font-mono text-red-400 uppercase tracking-widest">
          Rejected -- Funds Refunded
        </span>
      </div>
    );
  }

  // Expired
  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-gray-500" />
      <span className="text-xs font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest">
        Expired
      </span>
    </div>
  );
}
