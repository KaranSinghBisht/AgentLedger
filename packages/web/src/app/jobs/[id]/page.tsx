import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJob, fetchJobEvents } from "@/lib/contracts";
import {
  formatUsdc,
  truncateAddress,
  truncateHash,
  statusLabel,
  formatTimestamp,
  isZeroAddress,
  statusDescription,
} from "@/lib/format";
import { JobActions } from "@/components/job-actions";

export const revalidate = 30;

// Known agent addresses → human-readable roles
const KNOWN_ROLES: Record<string, string> = {
  "0xCA1Fa75626240543F092d0EB1016483bA6cE97FA": "Orchestrator Agent",
  "0x273e054f21de7c3C30Fbfa0c282Fe78a8b10c0f8": "Worker Agent",
  "0xd3819A01c741D5B0F0157A7af20824944B0C9A7a": "Sentinel (Evaluator)",
  "0xF969c4Daa194d639E8d505EebF38600Cc1A87DaE": "MarketplaceHook",
};

function roleName(address: string): string | null {
  for (const [addr, name] of Object.entries(KNOWN_ROLES)) {
    if (addr.toLowerCase() === address.toLowerCase()) return name;
  }
  return null;
}

function StatusBadge({ status }: { status: number }) {
  const colors: Record<number, string> = {
    0: "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]",
    1: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]",
    2: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]",
    3: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
    4: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
    5: "bg-gray-500 shadow-[0_0_10px_rgba(107,114,128,0.5)]",
  };
  return (
    <div className="flex items-center gap-3 bg-[rgb(var(--card-bg))]/60 border border-emerald-500/20 px-4 py-2">
      <div className={`w-2 h-2 rounded-full ${colors[status] ?? colors[0]} ${status === 2 ? "animate-pulse" : ""}`} />
      <span className="text-xs font-mono uppercase tracking-[0.2em] text-[rgb(var(--foreground))]">
        {statusLabel(status)}
      </span>
    </div>
  );
}

function AddressDisplay({ label, address }: { label: string; address: string }) {
  const zero = isZeroAddress(address);
  const role = roleName(address);

  return (
    <div className="py-4 border-b border-[rgb(var(--border-color))]">
      <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">
        {label}
      </span>
      {zero ? (
        <span className="text-[rgb(var(--text-dim))] italic font-mono text-sm">Not assigned</span>
      ) : (
        <div>
          {role && (
            <span className="text-emerald-500 font-space text-sm font-semibold block">{role}</span>
          )}
          <span className="font-mono text-xs text-[rgb(var(--text-muted))]">
            {truncateAddress(address)}
          </span>
          <a
            href={`https://sepolia.celoscan.io/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 text-[10px] font-mono text-emerald-500/50 hover:text-emerald-500 transition-colors"
          >
            [view]
          </a>
        </div>
      )}
    </div>
  );
}

function TimelineStep({
  label,
  description,
  active,
  completed,
  index,
}: {
  label: string;
  description: string;
  active: boolean;
  completed: boolean;
  index: number;
}) {
  return (
    <div className="flex items-start gap-4 relative">
      <div className="flex flex-col items-center">
        <div className={`w-6 h-6 border ${
          completed ? "bg-emerald-500 border-emerald-500" :
          active ? "bg-[rgb(var(--background))] border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" :
          "bg-[rgb(var(--background))] border-[rgb(var(--border-color))]"
        } flex items-center justify-center font-mono text-[10px] z-10 ${
          completed ? "text-black font-bold" : active ? "text-emerald-500" : "text-[rgb(var(--text-dim))]"
        }`}>
          {completed ? "\u2713" : index + 1}
        </div>
        {index < 3 && <div className={`w-[1px] h-10 ${completed ? "bg-emerald-500" : "bg-[rgb(var(--border-color))]"}`} />}
      </div>
      <div className="pt-0.5">
        <span className={`text-xs font-space uppercase tracking-wider ${
          completed ? "text-emerald-500" : active ? "text-[rgb(var(--foreground))]" : "text-[rgb(var(--text-dim))]"
        }`}>
          {label}
        </span>
        <p className="text-[10px] font-mono text-[rgb(var(--text-dim))] mt-0.5">{description}</p>
        {active && (
          <div className="mt-1 flex items-center gap-1">
            <div className="w-1 h-1 bg-emerald-500 animate-ping" />
            <span className="text-[9px] font-mono text-emerald-500/60 uppercase">Awaiting action...</span>
          </div>
        )}
      </div>
    </div>
  );
}


export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (isNaN(jobId)) notFound();

  const [job, events] = await Promise.all([
    fetchJob(jobId),
    fetchJobEvents(jobId),
  ]);
  if (!job) notFound();

  // Load deliverable content from static file (written by E2E)
  let deliverableContent: { text: string | null; filecoinCid: string | null; sealed: boolean } | null = null;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "deliverables.json");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      deliverableContent = data[String(jobId)] ?? null;
    }
  } catch {
    // File may not exist yet
  }

  const steps = [
    { label: "Job Posted", desc: "Client creates escrow job on Celo" },
    { label: "Funded", desc: "USDC locked in escrow contract" },
    { label: "Work Submitted", desc: "Worker delivers and submits proof" },
    { label: "Settled", desc: job.status === 4 ? "Rejected \u2014 client refunded" : "Approved \u2014 worker paid" },
  ];

  const budget = formatUsdc(job.budget);
  const hasBudget = budget !== "0.00";

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        href="/terminal"
        className="text-[10px] font-mono text-[rgb(var(--text-dim))] hover:text-emerald-500 transition-colors mb-8 flex items-center gap-2 uppercase tracking-widest"
      >
        &larr; Back to Jobs
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-l-2 border-emerald-500 pl-8 py-2">
        <div>
          <h1 className="text-4xl font-bold font-space text-[rgb(var(--foreground))] tracking-tighter mb-1">
            Job <span className="text-emerald-500">#{job.id}</span>
          </h1>
          <p className="text-[rgb(var(--text-muted))] font-mono text-xs">
            {statusDescription(job.status, !isZeroAddress(job.provider))}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Description */}
          <div className="cyber-card p-8">
            <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-4">
              Job Description
            </h2>
            <p className="text-lg font-space text-[rgb(var(--foreground))] leading-relaxed whitespace-pre-wrap">
              {job.description || "No description provided."}
            </p>
          </div>

          {/* Financials */}
          <div className="cyber-card p-8">
            <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-6">
              Escrow Details
            </h2>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">Budget</span>
                <span className="text-2xl font-space font-bold text-[rgb(var(--foreground))]">
                  {hasBudget ? `$${budget}` : "Pending bid"}
                </span>
                {hasBudget && <span className="text-xs text-[rgb(var(--text-dim))] font-mono ml-1">USDC</span>}
              </div>
              <div>
                <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">Deadline</span>
                <span className="text-sm font-mono text-[rgb(var(--foreground))]">
                  {formatTimestamp(job.expiredAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Deliverable */}
          {job.status >= 2 && events.deliverableHash && (
            <div className="cyber-card p-8">
              <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-4">
                Deliverable
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">
                    Deliverable Hash
                  </span>
                  <span className="font-mono text-sm text-[rgb(var(--foreground))]">
                    {truncateHash(events.deliverableHash)}
                  </span>
                  <a
                    href={`https://sepolia.celoscan.io/address/0x6262a72674F824a2c67fEDE85b56e096eD72B543#events`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-[10px] font-mono text-emerald-500/50 hover:text-emerald-500 transition-colors"
                  >
                    [view tx]
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Deliverable Content */}
          {deliverableContent?.text && job.status >= 3 && (
            <div className="cyber-card p-8">
              <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-4">
                Deliverable Content
              </h2>
              {deliverableContent.sealed && deliverableContent.filecoinCid && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                    AES-256-GCM SEALED
                  </span>
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))]">
                    Filecoin CID: {deliverableContent.filecoinCid.slice(0, 30)}...
                  </span>
                </div>
              )}
              <div className="bg-[rgb(var(--background))] border border-[rgb(var(--border-color))] p-4 max-h-[400px] overflow-y-auto">
                <p className="text-sm font-mono text-[rgb(var(--text-muted))] leading-relaxed whitespace-pre-wrap">
                  {deliverableContent.text}
                </p>
              </div>
              <p className="text-[9px] font-mono text-[rgb(var(--text-dim))] mt-2">
                Deliverable content from completed job. When sealed, original is encrypted on Filecoin.
              </p>
            </div>
          )}

          {/* Settlement Breakdown */}
          {job.status === 3 && events.providerPayment && (
            <div className="cyber-card p-8 border-emerald-500/20">
              <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-6">
                Settlement Breakdown
              </h2>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">
                    Worker Payment
                  </span>
                  <span className="text-xl font-space font-bold text-emerald-500">
                    ${formatUsdc(events.providerPayment)}
                  </span>
                  <span className="text-xs text-[rgb(var(--text-dim))] font-mono ml-1">USDC</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">
                    Platform Fee
                  </span>
                  <span className="text-lg font-space font-bold text-[rgb(var(--foreground))]">
                    ${formatUsdc(events.platformFee ?? "0")}
                  </span>
                  <span className="text-xs text-[rgb(var(--text-dim))] font-mono ml-1">USDC</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">
                    Evaluator Fee
                  </span>
                  <span className="text-lg font-space font-bold text-[rgb(var(--foreground))]">
                    ${formatUsdc(events.evaluatorFee ?? "0")}
                  </span>
                  <span className="text-xs text-[rgb(var(--text-dim))] font-mono ml-1">USDC</span>
                </div>
              </div>
            </div>
          )}

          {/* Rejection */}
          {job.status === 4 && (
            <div className="cyber-card p-8 border-red-500/20">
              <h2 className="text-[10px] font-mono text-red-500/60 uppercase tracking-[0.3em] mb-4">
                Rejected
              </h2>
              <p className="text-sm font-space text-[rgb(var(--foreground))]">
                Work was rejected by the evaluator. Full budget refunded to client.
              </p>
              {events.rejectionReason && events.rejectionReason !== "0x" + "0".repeat(64) && (
                <div className="mt-3">
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest block mb-1">
                    Reason Hash
                  </span>
                  <span className="font-mono text-xs text-[rgb(var(--text-muted))]">
                    {truncateHash(events.rejectionReason)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Participants */}
          <div className="cyber-card p-8">
            <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-4">
              Participants
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
              <AddressDisplay label="Posted by" address={job.client} />
              <AddressDisplay label="Worker" address={job.provider} />
              <AddressDisplay label="Evaluator" address={job.evaluator} />
              <AddressDisplay label="Hook Contract" address={job.hook} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Timeline */}
          <div className="cyber-card p-8">
            <h2 className="text-[10px] font-mono text-emerald-500/60 uppercase tracking-[0.3em] mb-6">
              Progress
            </h2>
            <div className="space-y-0">
              {steps.map((step, i) => (
                <TimelineStep
                  key={step.label}
                  index={i}
                  label={step.label}
                  description={step.desc}
                  completed={job.status >= i + 1 || (job.status >= 3 && i < 4)}
                  active={job.status === i}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="cyber-card p-8 border-emerald-500/20">
            <h2 className="text-[10px] font-mono text-emerald-500 uppercase tracking-[0.3em] mb-4">
              Actions
            </h2>
            <JobActions
              jobId={job.id}
              status={job.status}
              budget={job.budget}
              provider={job.provider}
              client={job.client}
            />
          </div>

          {/* Explorer link */}
          <div className="cyber-card p-6">
            <a
              href={`https://sepolia.celoscan.io/address/0x6262a72674F824a2c67fEDE85b56e096eD72B543`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-emerald-500/60 hover:text-emerald-500 transition-colors uppercase tracking-widest"
            >
              View Escrow Contract on Celoscan &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
