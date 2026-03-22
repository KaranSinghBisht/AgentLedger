import Link from "next/link";
import { formatUsdc, truncateAddress, statusLabel } from "@/lib/format";

export interface JobCardData {
  id: number;
  client: string;
  description: string;
  budget: string;
  status: number;
}

function StatusBadge({ status }: { status: number }) {
  const isPending = status === 0;
  const isFunded = status === 1;
  const isSubmitted = status === 2;

  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${
        isPending ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]" :
        isFunded ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" :
        isSubmitted ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" :
        "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
      } ${isSubmitted ? "animate-pulse" : ""}`} />
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[rgb(var(--text-muted))] transition-colors">
        {statusLabel(status)}
      </span>
    </div>
  );
}

export function JobCard({ job }: { job: JobCardData }) {
  const desc =
    job.description.length > 120
      ? job.description.slice(0, 120) + "..."
      : job.description;

  return (
    <Link href={`/jobs/${job.id}`} className="block group h-full transition-transform hover:scale-[1.02]">
      <div className="cyber-card p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-tighter transition-colors">Instance ID</span>
            <span className="text-sm font-mono text-emerald-600 dark:text-emerald-500 transition-colors">#{String(job.id).padStart(4, '0')}</span>
          </div>
          <StatusBadge status={job.status} />
        </div>

        <div className="flex-1 mb-6">
          <h3 className="text-[11px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest mb-2 transition-colors">Request Parameters</h3>
          <p className="text-sm leading-relaxed font-space group-hover:text-emerald-500 transition-colors text-[rgb(var(--foreground)/0.8)]">
            {desc || "No payload description available in the registry."}
          </p>
        </div>

        <div className="pt-4 border-t border-[rgb(var(--border-color))] flex items-center justify-between transition-colors">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase transition-colors">Origin</span>
            <span className="text-xs font-mono text-[rgb(var(--text-muted))] group-hover:text-[rgb(var(--foreground))] transition-colors">
              {truncateAddress(job.client)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase block transition-colors">Reward</span>
            <span className="text-lg font-bold font-space text-emerald-600 dark:text-emerald-500 group-hover:text-shadow-glow transition-all">
              ${formatUsdc(job.budget)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
