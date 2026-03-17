import { createPublicClient, http, type Address, defineChain } from "viem";
import { sepolia } from "viem/chains";

// ─── Chain Definitions ─────────────────────────────────────────────────────

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://celo-sepolia.drpc.org"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://sepolia.celoscan.io" },
  },
});

// ─── Contract Addresses ────────────────────────────────────────────────────

const ESCROW_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_ESCROW_ADDRESS as Address) ??
  (process.env.ESCROW_CONTRACT_ADDRESS as Address) ??
  "0x0000000000000000000000000000000000000000";

const IDENTITY_REGISTRY: Address = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY: Address = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

// ─── Clients ───────────────────────────────────────────────────────────────

export const celoClient = createPublicClient({
  chain: celoSepolia,
  transport: http(),
});

export const ethSepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
});

// ─── Escrow ABI (minimal read-only subset) ─────────────────────────────────

const escrowAbi = [
  {
    name: "jobCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getJob",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "hook", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;

// ─── ERC-8004 ABIs (minimal read-only subset) ──────────────────────────────

const identityRegistryAbi = [
  {
    name: "getIdentity",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      { name: "uri", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "key", type: "bytes32" },
          { name: "value", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

const reputationRegistryAbi = [
  {
    name: "getClients",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "getSummary",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clients", type: "address[]" },
    ],
    outputs: [
      { name: "overallValue", type: "int256" },
      { name: "overallDecimals", type: "uint256" },
      { name: "count", type: "uint256" },
      { name: "uniqueClients", type: "uint256" },
      {
        name: "tags",
        type: "tuple[]",
        components: [
          { name: "tag", type: "bytes32" },
          { name: "value", type: "int256" },
          { name: "valueDecimals", type: "uint256" },
          { name: "count", type: "uint256" },
        ],
      },
    ],
  },
] as const;

// ─── Data Types ────────────────────────────────────────────────────────────

export interface JobData {
  id: number;
  client: string;
  provider: string;
  evaluator: string;
  hook: string;
  description: string;
  budget: string;
  expiredAt: string;
  status: number;
}

export interface AgentIdentity {
  agentId: number;
  uri: string;
  metadata: Array<{ key: string; value: string }>;
}

export interface ReputationSummary {
  agentId: number;
  overallValue: string;
  overallDecimals: number;
  count: number;
  uniqueClients: number;
  tags: Array<{
    tag: string;
    value: string;
    valueDecimals: number;
    count: number;
  }>;
}

export interface AgentProfile {
  identity: AgentIdentity;
  reputation: ReputationSummary;
}

// ─── Escrow Data Fetchers ──────────────────────────────────────────────────

/** Fetch the total job count from the escrow contract. */
export async function fetchJobCount(): Promise<number> {
  try {
    const count = await celoClient.readContract({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "jobCount",
    });
    return Number(count);
  } catch {
    return 0;
  }
}

/** Convert raw contract job tuple to serializable JobData. */
function serializeJob(raw: {
  id: bigint;
  client: string;
  provider: string;
  evaluator: string;
  hook: string;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
}): JobData {
  return {
    id: Number(raw.id),
    client: raw.client,
    provider: raw.provider,
    evaluator: raw.evaluator,
    hook: raw.hook,
    description: raw.description,
    budget: raw.budget.toString(),
    expiredAt: raw.expiredAt.toString(),
    status: raw.status,
  };
}

/** Fetch a single job by ID. Returns null if the read fails. */
export async function fetchJob(jobId: number): Promise<JobData | null> {
  try {
    const raw = await celoClient.readContract({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "getJob",
      args: [BigInt(jobId)],
    });
    return serializeJob(raw);
  } catch {
    return null;
  }
}

/** Fetch all jobs via multicall. Returns an array of JobData. */
export async function fetchAllJobs(): Promise<JobData[]> {
  const count = await fetchJobCount();
  if (count === 0) return [];

  try {
    const calls = Array.from({ length: count }, (_, i) => ({
      address: ESCROW_ADDRESS,
      abi: escrowAbi,
      functionName: "getJob" as const,
      args: [BigInt(i)],
    }));

    const results = await celoClient.multicall({ contracts: calls });

    const jobs: JobData[] = [];
    for (const result of results) {
      if (result.status === "success" && result.result) {
        jobs.push(serializeJob(result.result as never));
      }
    }
    return jobs;
  } catch {
    return [];
  }
}

// ─── ERC-8004 Data Fetchers ────────────────────────────────────────────────

/** Fetch an agent's identity from the ERC-8004 IdentityRegistry. */
export async function fetchAgentIdentity(
  agentId: number
): Promise<AgentIdentity | null> {
  try {
    const [uri, metadata] = await ethSepoliaClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: identityRegistryAbi,
      functionName: "getIdentity",
      args: [BigInt(agentId)],
    });

    return {
      agentId,
      uri,
      metadata: metadata.map((m) => ({
        key: m.key,
        value: m.value,
      })),
    };
  } catch {
    return null;
  }
}

/** Fetch an agent's reputation summary from the ERC-8004 ReputationRegistry. */
export async function fetchAgentReputation(
  agentId: number
): Promise<ReputationSummary | null> {
  try {
    const clients = await ethSepoliaClient.readContract({
      address: REPUTATION_REGISTRY,
      abi: reputationRegistryAbi,
      functionName: "getClients",
      args: [BigInt(agentId)],
    });

    const [overallValue, overallDecimals, count, uniqueClients, tags] =
      await ethSepoliaClient.readContract({
        address: REPUTATION_REGISTRY,
        abi: reputationRegistryAbi,
        functionName: "getSummary",
        args: [BigInt(agentId), clients],
      });

    return {
      agentId,
      overallValue: overallValue.toString(),
      overallDecimals: Number(overallDecimals),
      count: Number(count),
      uniqueClients: Number(uniqueClients),
      tags: tags.map((t) => ({
        tag: t.tag,
        value: t.value.toString(),
        valueDecimals: Number(t.valueDecimals),
        count: Number(t.count),
      })),
    };
  } catch {
    return null;
  }
}

/** Fetch a full agent profile (identity + reputation). */
export async function fetchAgentProfile(
  agentId: number
): Promise<AgentProfile | null> {
  const [identity, reputation] = await Promise.all([
    fetchAgentIdentity(agentId),
    fetchAgentReputation(agentId),
  ]);

  if (!identity) return null;

  return {
    identity,
    reputation: reputation ?? {
      agentId,
      overallValue: "0",
      overallDecimals: 0,
      count: 0,
      uniqueClients: 0,
      tags: [],
    },
  };
}
