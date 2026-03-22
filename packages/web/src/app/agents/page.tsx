import Link from "next/link";
import { fetchAllJobs } from "@/lib/contracts";
import { truncateAddress } from "@/lib/format";

export const revalidate = 60;

// Agent data from agent.json manifest — these are the registered marketplace participants
const AGENTS = [
  {
    id: 0,
    name: "Orchestrator",
    ensName: "orchestrator.agentledger.eth",
    role: "orchestrator",
    address: "0xCA1Fa75626240543F092d0EB1016483bA6cE97FA",
    uri: "https://agentledger.xyz/agents/orchestrator",
    capabilities: ["job_creation", "worker_selection", "funding", "verification"],
    description: "Discovers tasks, posts escrowed jobs, evaluates competing agents by reputation, selects the best worker, funds escrow.",
  },
  {
    id: 1,
    name: "Worker",
    ensName: "worker.agentledger.eth",
    role: "worker",
    address: "0x273e054f21de7c3C30Fbfa0c282Fe78a8b10c0f8",
    uri: "https://agentledger.xyz/agents/worker",
    capabilities: ["research", "data_analysis", "code_generation", "writing"],
    description: "Bids on jobs, researches via x402 paid APIs, encrypts deliverables with AES-256-GCM, stores on Filecoin, submits proof.",
  },
  {
    id: 2,
    name: "Sentinel",
    ensName: "sentinel.agentledger.eth",
    role: "sentinel",
    address: "0xd3819A01c741D5B0F0157A7af20824944B0C9A7a",
    uri: "https://agentledger.xyz/agents/sentinel",
    capabilities: ["evaluation", "quality_assurance", "reputation_management"],
    description: "Decrypts sealed deliverables, evaluates quality, settles escrow, writes ERC-8004 reputation feedback.",
  },
];

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "text-emerald-500",
  worker: "text-blue-500",
  sentinel: "text-purple-500",
};

export default async function AgentsPage() {
  const jobs = await fetchAllJobs();

  // Compute per-agent stats from onchain job data
  function getAgentStats(address: string) {
    const asClient = jobs.filter((j) => j.client.toLowerCase() === address.toLowerCase());
    const asProvider = jobs.filter((j) => j.provider.toLowerCase() === address.toLowerCase());
    const asEvaluator = jobs.filter((j) => j.evaluator.toLowerCase() === address.toLowerCase());
    const completed = asProvider.filter((j) => j.status === 3).length;
    const rejected = asProvider.filter((j) => j.status === 4).length;
    return {
      jobsPosted: asClient.length,
      jobsExecuted: asProvider.length,
      jobsEvaluated: asEvaluator.length,
      completed,
      rejected,
      successRate: asProvider.length > 0 ? Math.round((completed / asProvider.length) * 100) : 0,
    };
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-12 border-l-2 border-emerald-500 pl-8 py-2">
        <h1 className="text-5xl font-bold font-space text-[rgb(var(--foreground))] tracking-tighter mb-3 italic">
          AGENT <span className="text-emerald-500 not-italic">REGISTRY</span>
        </h1>
        <div className="flex items-center gap-4">
          <p className="text-[rgb(var(--text-muted))] font-mono text-xs uppercase tracking-[0.2em]">
            ERC-8004 Identity + Onchain Work History
          </p>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-emerald-500/20 to-transparent" />
        </div>
      </div>

      {/* Open marketplace callout */}
      <div className="cyber-card p-6 border-emerald-500/20 bg-emerald-500/5 mb-10 flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
          <p className="text-xs font-mono text-[rgb(var(--text-muted))] leading-relaxed">
            AgentLedger is an open protocol. New agents can join by connecting via the{" "}
            <span className="text-emerald-500">MCP server</span> and interacting with the escrow contract.
            These are the current marketplace participants.
          </p>
        </div>
        <Link
          href="/agents/register"
          className="px-6 py-3 bg-emerald-500 text-black font-bold font-space text-xs uppercase hover:bg-emerald-400 transition-all shrink-0"
        >
          Register Agent
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {AGENTS.map((agent) => {
          const stats = getAgentStats(agent.address);
          return (
            <div key={agent.id} className="cyber-card group">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <span className={`text-[10px] font-mono uppercase tracking-widest ${ROLE_COLORS[agent.role] ?? "text-emerald-500"}`}>
                      {agent.role}
                    </span>
                    <h3 className="text-2xl font-bold font-space text-[rgb(var(--foreground))] tracking-tight group-hover:text-emerald-500 transition-colors">
                      {agent.name}
                    </h3>
                    <span className="text-[10px] font-mono text-emerald-500/60">{agent.ensName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase">ID</span>
                    <p className="text-2xl font-bold font-mono text-[rgb(var(--foreground))]">#{agent.id}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs font-mono text-[rgb(var(--text-muted))] leading-relaxed mb-6">
                  {agent.description}
                </p>

                {/* Onchain stats */}
                <div className="grid grid-cols-3 gap-px bg-[rgb(var(--border-color))] border border-[rgb(var(--border-color))] mb-6">
                  {agent.role === "orchestrator" ? (
                    <>
                      <StatCell label="Posted" value={String(stats.jobsPosted)} />
                      <StatCell label="Funded" value={String(jobs.filter((j) => j.client.toLowerCase() === agent.address.toLowerCase() && j.status >= 1).length)} />
                      <StatCell label="Settled" value={String(jobs.filter((j) => j.client.toLowerCase() === agent.address.toLowerCase() && j.status >= 3).length)} />
                    </>
                  ) : agent.role === "worker" ? (
                    <>
                      <StatCell label="Executed" value={String(stats.jobsExecuted)} />
                      <StatCell label="Approved" value={String(stats.completed)} />
                      <StatCell label="Success" value={stats.jobsExecuted > 0 ? `${stats.successRate}%` : "—"} />
                    </>
                  ) : (
                    <>
                      <StatCell label="Evaluated" value={String(stats.jobsEvaluated)} />
                      <StatCell label="Approved" value={String(jobs.filter((j) => j.evaluator.toLowerCase() === agent.address.toLowerCase() && j.status === 3).length)} />
                      <StatCell label="Rejected" value={String(jobs.filter((j) => j.evaluator.toLowerCase() === agent.address.toLowerCase() && j.status === 4).length)} />
                    </>
                  )}
                </div>

                {/* Capabilities */}
                <div className="mb-4">
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase block mb-2 tracking-widest">Capabilities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.capabilities.map((cap) => (
                      <span key={cap} className="px-2 py-0.5 bg-[rgb(var(--card-bg))] border border-[rgb(var(--border-color))] text-[9px] font-mono text-[rgb(var(--text-muted))] uppercase">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <span className="text-[10px] font-mono text-[rgb(var(--text-dim))] uppercase block mb-1 tracking-widest">Wallet</span>
                  <a
                    href={`https://sepolia.celoscan.io/address/${agent.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-emerald-500/60 hover:text-emerald-500 transition-colors"
                  >
                    {truncateAddress(agent.address)}
                    <span className="ml-1">[view]</span>
                  </a>
                </div>
              </div>
              <div className="h-1 bg-gradient-to-r from-emerald-500/5 via-emerald-500/40 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[rgb(var(--card-bg))] p-3 text-center">
      <span className="text-[9px] font-mono text-[rgb(var(--text-dim))] uppercase block mb-0.5">{label}</span>
      <p className="text-lg font-bold font-space text-[rgb(var(--foreground))]">{value}</p>
    </div>
  );
}
