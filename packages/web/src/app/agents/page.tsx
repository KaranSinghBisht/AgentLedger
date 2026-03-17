import { fetchAgentProfile, type AgentProfile } from "@/lib/contracts";

export const revalidate = 60;

const KNOWN_AGENT_IDS = [0, 1, 2];

function decodeBytes32(hex: string): string {
  try {
    const clean = hex.replace(/0+$/, "");
    if (clean.length <= 2) return "";
    const bytes = Buffer.from(clean.slice(2), "hex");
    return bytes.toString("utf8");
  } catch {
    return hex;
  }
}

function computeScore(profile: AgentProfile): string {
  const { overallValue, overallDecimals } = profile.reputation;
  if (overallDecimals === 0 && overallValue === "0") return "N/A";
  const divisor = Math.pow(10, overallDecimals);
  const score = Number(BigInt(overallValue)) / divisor;
  return score.toFixed(1);
}

function TagBadge({ tag, value, valueDecimals }: { tag: string; value: string; valueDecimals: number }) {
  const label = decodeBytes32(tag) || tag.slice(0, 10);
  const divisor = Math.pow(10, valueDecimals);
  const score = Number(BigInt(value)) / divisor;
  const isPositive = score >= 0;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${
        isPositive
          ? "bg-green-500/10 text-green-400 border-green-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
      }`}
    >
      {label}: {score.toFixed(1)}
    </span>
  );
}

function AgentCard({ profile }: { profile: AgentProfile }) {
  const { identity, reputation } = profile;
  const score = computeScore(profile);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-sm text-gray-500 font-mono">
            Agent #{identity.agentId}
          </span>
          <h3 className="text-lg font-semibold text-gray-100 mt-1">
            {identity.uri || "Unnamed Agent"}
          </h3>
        </div>
        <div className="text-right">
          <span className="text-sm text-gray-500">Score</span>
          <p className="text-2xl font-bold text-green-400">{score}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-500">Reviews</span>
          <p className="text-gray-200 font-medium">{reputation.count}</p>
        </div>
        <div>
          <span className="text-gray-500">Unique Clients</span>
          <p className="text-gray-200 font-medium">{reputation.uniqueClients}</p>
        </div>
      </div>

      {reputation.tags.length > 0 && (
        <div>
          <span className="text-sm text-gray-500 mb-2 block">Tags</span>
          <div className="flex flex-wrap gap-2">
            {reputation.tags.map((t, i) => (
              <TagBadge
                key={i}
                tag={t.tag}
                value={t.value}
                valueDecimals={t.valueDecimals}
              />
            ))}
          </div>
        </div>
      )}

      {identity.metadata.length > 0 && (
        <div className="mt-4">
          <span className="text-sm text-gray-500 mb-2 block">Metadata</span>
          <div className="space-y-1">
            {identity.metadata.map((m, i) => (
              <div key={i} className="text-xs text-gray-500 font-mono">
                {decodeBytes32(m.key)}: {decodeBytes32(m.value)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <p className="text-gray-500 text-lg mb-2">No agents registered yet</p>
      <p className="text-gray-600 text-sm">
        Agent profiles will appear here once they register on the ERC-8004
        IdentityRegistry.
      </p>
    </div>
  );
}

export default async function AgentsPage() {
  const profiles = await Promise.all(
    KNOWN_AGENT_IDS.map((id) => fetchAgentProfile(id))
  );
  const validProfiles = profiles.filter(
    (p): p is AgentProfile => p !== null
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Agent Leaderboard</h1>
        <p className="text-gray-400">
          AI agents registered on the ERC-8004 IdentityRegistry with onchain
          reputation scores.
        </p>
      </div>

      {validProfiles.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {validProfiles.map((profile) => (
            <AgentCard key={profile.identity.agentId} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
