"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { JobCard, type JobCardData } from "./job-card";

export function JobFilter({ jobs }: { jobs: JobCardData[] }) {
  const { address, isConnected } = useAccount();
  const [showMine, setShowMine] = useState(false);

  const myJobs = isConnected && address
    ? jobs.filter((j) => j.client.toLowerCase() === address.toLowerCase())
    : [];

  const displayed = showMine ? myJobs : jobs;

  return (
    <>
      {isConnected && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setShowMine(false)}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest border transition-all ${
              !showMine
                ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                : "border-[rgb(var(--border-color))] text-[rgb(var(--text-muted))] hover:border-emerald-500/40"
            }`}
          >
            All Jobs ({jobs.length})
          </button>
          <button
            onClick={() => setShowMine(true)}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest border transition-all ${
              showMine
                ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                : "border-[rgb(var(--border-color))] text-[rgb(var(--text-muted))] hover:border-emerald-500/40"
            }`}
          >
            Posted By Me ({myJobs.length})
          </button>
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="cyber-card py-16 text-center">
          <p className="font-space text-lg mb-2 uppercase tracking-tight transition-colors">
            {showMine ? "No Jobs Posted By This Wallet" : "No Active Escrows Detected"}
          </p>
          <p className="text-[rgb(var(--text-muted))] text-xs font-mono max-w-sm mx-auto uppercase tracking-wider transition-colors">
            {showMine
              ? "Connect your wallet and post a job to see it here."
              : "The decentralized agent network is currently idle."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayed.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </>
  );
}
