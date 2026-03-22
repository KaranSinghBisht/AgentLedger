import { fetchAllJobs } from "@/lib/contracts";
import { formatUsdc } from "@/lib/format";
import { JobFilter } from "@/components/job-filter";

export const revalidate = 30;

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="cyber-card p-6 flex flex-col justify-between group">
      <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-500/60 uppercase tracking-widest mb-4 transition-colors">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold font-space group-hover:text-shadow-glow transition-all">
          {value}
        </span>
        {sub && <span className="text-xs text-[rgb(var(--text-dim))] font-mono transition-colors">{sub}</span>}
      </div>
    </div>
  );
}

function SystemStatus() {
  return (
    <div className="cyber-card p-6 border-emerald-500/20 bg-emerald-500/5 mb-12 flex items-center justify-between transition-all">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 animate-pulse rounded-full" />
          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-500 uppercase tracking-widest transition-colors">Network Online</span>
        </div>
        <div className="h-4 w-[1px] bg-emerald-500/20 transition-colors" />
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-tighter transition-colors">Chain_ID</span>
          <span className="text-[10px] font-mono text-[rgb(var(--foreground))] transition-colors">11142220</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-tighter transition-colors">Escrow_Contract</span>
          <span className="text-[10px] font-mono text-[rgb(var(--foreground))] transition-colors">Active</span>
        </div>
      </div>
      <div className="hidden md:block text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest transition-colors">
        Syncing with Registry Node...
      </div>
    </div>
  );
}

function StatsBar({ jobs }: { jobs: Array<{ budget: string; status: number }> }) {
  const totalJobs = jobs.length;
  const completedJobs = jobs.filter((j) => j.status === 3).length;
  const totalEscrowed = jobs
    .filter((j) => j.status === 1 || j.status === 2)
    .reduce((sum, j) => sum + BigInt(j.budget), 0n);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <StatCard label="Total Deployments" value={String(totalJobs)} sub="UNITS" />
      <StatCard label="Escrow Value" value={`$${formatUsdc(totalEscrowed)}`} sub="USDC" />
      <StatCard label="Resolved" value={String(completedJobs)} sub="TASKS" />
    </div>
  );
}

export default async function JobBoardPage() {
  const jobs = await fetchAllJobs();

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-12 border-l-2 border-emerald-500 pl-8 py-2">
        <h1 className="text-5xl font-bold font-space tracking-tighter mb-3 italic transition-colors">
          TERMINAL <span className="text-emerald-500 not-italic transition-colors">01</span>
        </h1>
        <div className="flex items-center gap-4">
          <p className="text-[rgb(var(--text-muted))] font-mono text-xs uppercase tracking-[0.2em] transition-colors">
            Autonomous Escrow Pipeline // [SCANNING_ALL_NODES]
          </p>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-emerald-500/20 to-transparent transition-all" />
        </div>
      </div>

      <SystemStatus />
      <StatsBar jobs={jobs} />

      <JobFilter jobs={jobs} />
    </div>
  );
}
