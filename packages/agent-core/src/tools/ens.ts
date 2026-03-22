/**
 * ENS tools — real resolution against Ethereum mainnet via viem.
 * Agent subnames registered on Sepolia: orchestrator/worker/sentinel.agentledger.eth
 */

import type { Address, Hash } from "viem";
import { namehash, normalize } from "viem/ens";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { getEnv } from "../config/env.js";

// ENS resolution uses Sepolia (where agentledger.eth is registered)
const ensClient = createPublicClient({
  chain: sepolia,
  transport: http("https://1rpc.io/sepolia"),
});

const publicResolverAbi = [
  {
    type: "function",
    name: "setText",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export async function resolveAddress(name: string): Promise<Address | null> {
  try {
    const address = await ensClient.getEnsAddress({
      name: normalize(name),
    });
    return address;
  } catch {
    return null;
  }
}

export async function resolveName(address: Address): Promise<string | null> {
  try {
    const name = await ensClient.getEnsName({ address });
    return name;
  } catch {
    return null;
  }
}

export async function setTextRecord(
  name: string,
  key: string,
  value: string
): Promise<{ txHash: Hash; resolver: Address }> {
  const normalized = normalize(name);
  const node = namehash(normalized);

  // Look up the resolver for this name
  const resolverAddr = await ensClient.getEnsResolver({ name: normalized });
  if (!resolverAddr) {
    throw new Error(`No resolver found for ENS name "${name}"`);
  }

  const env = getEnv();
  const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http("https://1rpc.io/sepolia"),
  });

  const txHash = await wallet.writeContract({
    address: resolverAddr as Address,
    abi: publicResolverAbi,
    functionName: "setText",
    args: [node, key, value],
  });

  return { txHash, resolver: resolverAddr as Address };
}
