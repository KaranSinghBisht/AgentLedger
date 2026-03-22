import type { Address, Hash } from "viem";
import { decodeEventLog } from "viem";
import {
  getEthSepoliaPublicClient,
  getEthSepoliaWalletClient,
} from "../blockchain/clients.js";
import { identityRegistryAbi, reputationRegistryAbi } from "../blockchain/abis.js";
import { erc8004Sepolia } from "../blockchain/addresses.js";
import { getNextNonce, resetNonce } from "../blockchain/nonce-manager.js";

export interface AgentIdentity {
  owner: Address;
  agentURI: string;
  metadata: Array<{ key: string; value: string }>;
}

export interface ReputationSummary {
  totalFeedbacks: bigint;
  averageValue: bigint;
  averageValueDecimals: number;
}

const REGISTRY = erc8004Sepolia;

export async function registerAgent(
  role: "orchestrator" | "worker" | "sentinel",
  agentURI: string,
  metadata: Array<{ key: string; value: string }>
): Promise<{ agentId: bigint; txHash: Hash }> {
  const wallet = getEthSepoliaWalletClient(role);
  const pub = getEthSepoliaPublicClient();
  const nonce = await getNextNonce(wallet.account.address, pub);

  let txHash: Hash;
  try {
    txHash = await wallet.writeContract({
      address: REGISTRY.identityRegistry,
      abi: identityRegistryAbi,
      functionName: "register",
      args: [agentURI, metadata],
      nonce,
    });
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }

  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });

  // Extract agentId from Transfer event (ERC-721 mint: Transfer(address(0), to, tokenId))
  let agentId: bigint | null = null;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: [
          {
            type: "event",
            name: "Transfer",
            inputs: [
              { name: "from", type: "address", indexed: true },
              { name: "to", type: "address", indexed: true },
              { name: "tokenId", type: "uint256", indexed: true },
            ],
          },
        ],
        data: log.data,
        topics: log.topics,
      });
      agentId = decoded.args.tokenId;
      break;
    } catch {
      // Not a Transfer event, skip
    }
  }

  if (agentId === null) {
    throw new Error(`registerAgent tx ${txHash} succeeded but no Transfer event found — check registry address and ABI`);
  }

  return { agentId, txHash };
}

export async function getIdentity(agentId: bigint): Promise<AgentIdentity> {
  const pub = getEthSepoliaPublicClient();

  const result = await pub.readContract({
    address: REGISTRY.identityRegistry,
    abi: identityRegistryAbi,
    functionName: "getIdentity",
    args: [agentId],
  });

  const [owner, agentURI, metadata] = result as [Address, string, Array<{ key: string; value: string }>];
  return { owner, agentURI, metadata };
}

export async function giveFeedback(params: {
  agentId: bigint;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: `0x${string}`;
}): Promise<Hash> {
  const wallet = getEthSepoliaWalletClient("sentinel");
  const pub = getEthSepoliaPublicClient();
  const nonce = await getNextNonce(wallet.account.address, pub);

  try {
    const txHash = await wallet.writeContract({
      address: REGISTRY.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "giveFeedback",
      args: [
        params.agentId,
        params.value,
        params.valueDecimals,
        params.tag1,
        params.tag2,
        params.endpoint,
        params.feedbackURI,
        params.feedbackHash,
      ],
      nonce,
    });

    await pub.waitForTransactionReceipt({ hash: txHash });
    return txHash;
  } catch (err) {
    resetNonce(wallet.account.address);
    throw err;
  }
}

export async function getReputation(agentId: bigint): Promise<ReputationSummary> {
  try {
    const pub = getEthSepoliaPublicClient();

    const clients = (await pub.readContract({
      address: REGISTRY.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "getClients",
      args: [agentId],
    })) as Address[];

    if (clients.length === 0) {
      return { totalFeedbacks: 0n, averageValue: 0n, averageValueDecimals: 0 };
    }

    const [totalFeedbacks, averageValue, averageValueDecimals] = (await pub.readContract({
      address: REGISTRY.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: "getSummary",
      args: [agentId, clients],
    })) as [bigint, bigint, number];

    return { totalFeedbacks, averageValue, averageValueDecimals };
  } catch {
    // Registry may be owner-gated or agent not registered — return zero scores
    return { totalFeedbacks: 0n, averageValue: 0n, averageValueDecimals: 0 };
  }
}
