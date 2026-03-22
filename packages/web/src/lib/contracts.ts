import { createPublicClient, http, type Address, defineChain } from "viem";
import { sepolia } from "viem/chains";

// ─── Chain Definitions ─────────────────────────────────────────────────────

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://forno.celo-sepolia.celo-testnet.org"] },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://sepolia.celoscan.io" },
  },
});

// ─── Contract Addresses ────────────────────────────────────────────────────

const ESCROW_ADDRESS: Address = "0x6262a72674F824a2c67fEDE85b56e096eD72B543";

// Block at which the escrow contract was deployed — avoids scanning from genesis
const ESCROW_DEPLOY_BLOCK = 11_000_000n;

const IDENTITY_REGISTRY: Address = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const REPUTATION_REGISTRY: Address = "0x8004B663056A597Dffe9eCcC1965A193B7388713";

// ─── Clients ───────────────────────────────────────────────────────────────

export const celoClient = createPublicClient({
  chain: celoSepolia,
  transport: http("https://forno.celo-sepolia.celo-testnet.org", { timeout: 15_000 }),
});

export const ethSepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http("https://ethereum-sepolia-rpc.publicnode.com", { timeout: 10_000 }),
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
  // Events for deliverable/settlement display
  {
    name: "WorkSubmitted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "deliverable", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "JobCompleted",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
      { name: "providerPayment", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
      { name: "evaluatorFee", type: "uint256", indexed: false },
    ],
  },
  {
    name: "JobRejected",
    type: "event",
    inputs: [
      { name: "jobId", type: "uint256", indexed: true },
      { name: "reason", type: "bytes32", indexed: false },
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
      { name: "owner", type: "address" },
      { name: "agentURI", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "key", type: "string" },
          { name: "value", type: "string" },
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
      { name: "clientAddresses", type: "address[]" },
    ],
    outputs: [
      { name: "totalFeedbacks", type: "uint256" },
      { name: "averageValue", type: "int128" },
      { name: "averageValueDecimals", type: "uint8" },
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
  owner: string;
  uri: string;
  metadata: Array<{ key: string; value: string }>;
}

export interface ReputationSummary {
  agentId: number;
  totalFeedbacks: number;
  averageValue: string;
  averageValueDecimals: number;
}

export interface AgentProfile {
  identity: AgentIdentity;
  reputation: ReputationSummary;
}

export interface JobEventData {
  deliverableHash: string | null;
  providerPayment: string | null;
  platformFee: string | null;
  evaluatorFee: string | null;
  rejectionReason: string | null;
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

/** Fetch events (deliverable submission, settlement) for a specific job. */
export async function fetchJobEvents(jobId: number): Promise<JobEventData> {
  const result: JobEventData = {
    deliverableHash: null,
    providerPayment: null,
    platformFee: null,
    evaluatorFee: null,
    rejectionReason: null,
  };

  try {
    const [submitLogs, completeLogs, rejectLogs] = await Promise.all([
      celoClient.getContractEvents({
        address: ESCROW_ADDRESS,
        abi: escrowAbi,
        eventName: "WorkSubmitted",
        args: { jobId: BigInt(jobId) },
        fromBlock: ESCROW_DEPLOY_BLOCK,
      }),
      celoClient.getContractEvents({
        address: ESCROW_ADDRESS,
        abi: escrowAbi,
        eventName: "JobCompleted",
        args: { jobId: BigInt(jobId) },
        fromBlock: ESCROW_DEPLOY_BLOCK,
      }),
      celoClient.getContractEvents({
        address: ESCROW_ADDRESS,
        abi: escrowAbi,
        eventName: "JobRejected",
        args: { jobId: BigInt(jobId) },
        fromBlock: ESCROW_DEPLOY_BLOCK,
      }),
    ]);

    if (submitLogs.length > 0) {
      const args = submitLogs[0].args as { deliverable?: `0x${string}` };
      result.deliverableHash = args.deliverable ?? null;
    }

    if (completeLogs.length > 0) {
      const args = completeLogs[0].args as {
        providerPayment?: bigint;
        platformFee?: bigint;
        evaluatorFee?: bigint;
      };
      result.providerPayment = args.providerPayment?.toString() ?? null;
      result.platformFee = args.platformFee?.toString() ?? null;
      result.evaluatorFee = args.evaluatorFee?.toString() ?? null;
    }

    if (rejectLogs.length > 0) {
      const args = rejectLogs[0].args as { reason?: `0x${string}` };
      result.rejectionReason = args.reason ?? null;
    }
  } catch {
    // Events may fail on some RPCs; return partial data
  }

  return result;
}

/** Fetch all jobs via individual reads. Returns an array of JobData. */
export async function fetchAllJobs(): Promise<JobData[]> {
  const count = await fetchJobCount();
  if (count === 0) return [];

  const jobs: JobData[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const raw = await celoClient.readContract({
        address: ESCROW_ADDRESS,
        abi: escrowAbi,
        functionName: "getJob",
        args: [BigInt(i)],
      });
      jobs.push(serializeJob(raw));
    } catch {
      // Individual job read failed — skip
    }
  }
  return jobs;
}

// ─── ERC-8004 Data Fetchers ────────────────────────────────────────────────

/** Fetch an agent's identity from the ERC-8004 IdentityRegistry. */
export async function fetchAgentIdentity(
  agentId: number
): Promise<AgentIdentity | null> {
  try {
    const [owner, agentURI, metadata] = await ethSepoliaClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: identityRegistryAbi,
      functionName: "getIdentity",
      args: [BigInt(agentId)],
    });

    return {
      agentId,
      owner,
      uri: agentURI,
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

    const [totalFeedbacks, averageValue, averageValueDecimals] =
      await ethSepoliaClient.readContract({
        address: REPUTATION_REGISTRY,
        abi: reputationRegistryAbi,
        functionName: "getSummary",
        args: [BigInt(agentId), clients],
      });

    return {
      agentId,
      totalFeedbacks: Number(totalFeedbacks),
      averageValue: averageValue.toString(),
      averageValueDecimals: Number(averageValueDecimals),
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
      totalFeedbacks: 0,
      averageValue: "0",
      averageValueDecimals: 0,
    },
  };
}
