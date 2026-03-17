import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJob } from "@/lib/contracts";
import {
  formatUsdc,
  truncateAddress,
  truncateHash,
  statusLabel,
  statusBadgeClasses,
  formatTimestamp,
  isZeroAddress,
} from "@/lib/format";

export const revalidate = 30;

function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusBadgeClasses(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function AddressRow({ label, address }: { label: string; address: string }) {
  if (isZeroAddress(address)) {
    return (
      <div className="flex justify-between py-3 border-b border-gray-800">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-600">Not assigned</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between py-3 border-b border-gray-800">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200 font-mono">{truncateAddress(address)}</span>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between py-3 border-b border-gray-800">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{children}</span>
    </div>
  );
}

function TimelineStep({
  label,
  active,
  completed,
}: {
  label: string;
  active: boolean;
  completed: boolean;
}) {
  const dotClass = completed
    ? "bg-green-500"
    : active
      ? "bg-yellow-500 animate-pulse"
      : "bg-gray-700";

  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${dotClass}`} />
      <span className={completed || active ? "text-gray-200" : "text-gray-600"}>
        {label}
      </span>
    </div>
  );
}

function JobTimeline({ status }: { status: number }) {
  const steps = ["Created", "Funded", "Submitted", "Settled"];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">Timeline</h2>
      <div className="flex flex-col gap-4">
        {steps.map((step, i) => (
          <TimelineStep
            key={step}
            label={step}
            completed={status >= i + 1 || (status >= 3 && i < 4)}
            active={status === i}
          />
        ))}
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

  const job = await fetchJob(jobId);
  if (!job) notFound();

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6 inline-block"
      >
        &larr; Back to Job Board
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Job #{job.id}</h1>
        <StatusBadge status={job.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-3">Description</h2>
            <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
              {job.description || "No description provided."}
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-3">Details</h2>
            <div className="divide-y divide-gray-800">
              <InfoRow label="Budget">
                <span className="text-green-400 font-medium">
                  ${formatUsdc(job.budget)} USDC
                </span>
              </InfoRow>
              <InfoRow label="Expires">
                {formatTimestamp(job.expiredAt)}
              </InfoRow>
              <AddressRow label="Client" address={job.client} />
              <AddressRow label="Provider" address={job.provider} />
              <AddressRow label="Evaluator" address={job.evaluator} />
              <AddressRow label="Hook" address={job.hook} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <JobTimeline status={job.status} />
        </div>
      </div>
    </div>
  );
}
