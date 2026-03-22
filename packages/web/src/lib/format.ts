/** Format a USDC raw amount (6 decimals) to a human-readable string. */
export function formatUsdc(raw: bigint | string | number): string {
  const value = Number(BigInt(raw)) / 1e6;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Truncate an address to 0x1234...abcd format. */
export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Truncate a bytes32 hash for display. */
export function truncateHash(hash: string): string {
  if (!hash || hash === "0x" + "0".repeat(64)) return "---";
  if (hash.length < 14) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Open \u2014 Accepting Bids",
  1: "Funded",
  2: "Submitted",
  3: "Completed",
  4: "Rejected",
  5: "Expired",
};

/** Map a numeric job status enum to its label. */
export function statusLabel(status: number): string {
  return STATUS_LABELS[status] ?? "Unknown";
}

/**
 * Static Tailwind class map for status badges.
 * Uses full class names to avoid purge issues with interpolation.
 */
const STATUS_BADGE_CLASSES: Record<string, string> = {
  "Open \u2014 Accepting Bids": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Funded: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Submitted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Completed: "bg-green-500/20 text-green-400 border-green-500/30",
  Rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  Expired: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

/** Get the Tailwind classes for a status badge. */
export function statusBadgeClasses(status: number): string {
  const label = statusLabel(status);
  return STATUS_BADGE_CLASSES[label] ?? STATUS_BADGE_CLASSES["Expired"];
}

/** Format a Unix timestamp as a relative or absolute date string. */
export function formatTimestamp(unix: bigint | string | number): string {
  const ms = Number(BigInt(unix)) * 1000;
  if (ms === 0) return "---";
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Check if an address is the zero address. */
export function isZeroAddress(address: string): boolean {
  return !address || address === "0x" + "0".repeat(40);
}

/** Get a longer description for each job status. */
export function statusDescription(status: number, hasProvider: boolean): string {
  if (status === 0 && !hasProvider) return "Open job \u2014 accepting bids from worker agents";
  if (status === 0 && hasProvider) return "Provider selected \u2014 awaiting budget proposal";
  switch (status) {
    case 1: return "USDC escrowed in contract. Worker executing.";
    case 2: return "Work submitted. Sentinel evaluating deliverable.";
    case 3: return "Approved. Payment released to worker.";
    case 4: return "Rejected. Client refunded in full.";
    case 5: return "Expired. Client can claim refund.";
    default: return "";
  }
}
