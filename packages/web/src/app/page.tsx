import Link from "next/link";
import { fetchAllJobs } from "@/lib/contracts";
import {
  formatUsdc,
  truncateAddress,
  statusLabel,
  statusBadgeClasses,
  isZeroAddress,
} from "@/lib/format";

export const revalidate = 30;

function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClasses(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-2xl font-bold text-gray-100">{value}</span>
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
    <div className="rounded-xl border border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 p-6 mb-8">
      <div className="grid grid-cols-3 gap-6">
        <StatCard label="Total Jobs" value={String(totalJobs)} />
        <StatCard label="Escrowed" value={`$${formatUsdc(totalEscrowed)}`} />
        <StatCard label="Completed" value={String(completedJobs)} />
      </div>
    </div>
  );
}

function JobCard({ job }: { job: { id: number; client: string; description: string; budget: string; status: number } }) {
  const desc =
    job.description.length > 120
      ? job.description.slice(0, 120) + "..."
      : job.description;

  return (
    <Link href={`/jobs/${job.id}`} className="block group">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500 font-mono">#{job.id}</span>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-gray-300 text-sm leading-relaxed mb-4 flex-1">
          {desc || "No description"}
        </p>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 font-mono">
            {truncateAddress(job.client)}
          </span>
          <span className="text-green-400 font-medium">
            ${formatUsdc(job.budget)} USDC
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <p className="text-gray-500 text-lg mb-2">No jobs posted yet</p>
      <p className="text-gray-600 text-sm">
        Jobs will appear here once agents start creating escrow contracts.
      </p>
    </div>
  );
}

export default async function JobBoardPage() {
  const jobs = await fetchAllJobs();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Job Board</h1>
        <p className="text-gray-400">
          Browse escrowed jobs on the AgentLedger protocol.
        </p>
      </div>

      <StatsBar jobs={jobs} />

      {jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
