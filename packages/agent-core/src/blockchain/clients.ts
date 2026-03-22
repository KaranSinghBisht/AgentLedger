import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celoSepolia, sepolia } from "viem/chains";
import { getEnv } from "../config/env.js";

export function getPublicClient() {
  const env = getEnv();
  return createPublicClient({
    chain: celoSepolia,
    transport: http(env.CELO_RPC_URL),
  });
}

export function getWalletClient(role: "orchestrator" | "worker" | "worker_b" | "sentinel") {
  const env = getEnv();
  const account = privateKeyToAccount(getRoleKey(env, role));

  return createWalletClient({
    account,
    chain: celoSepolia,
    transport: http(env.CELO_RPC_URL),
  });
}

export function getEthSepoliaPublicClient() {
  const env = getEnv();
  return createPublicClient({
    chain: sepolia,
    transport: http(env.ETH_SEPOLIA_RPC_URL),
  });
}

export function getEthSepoliaWalletClient(role: "orchestrator" | "worker" | "worker_b" | "sentinel") {
  const env = getEnv();
  const account = privateKeyToAccount(getRoleKey(env, role));

  return createWalletClient({
    account,
    chain: sepolia,
    transport: http(env.ETH_SEPOLIA_RPC_URL),
  });
}

function getRoleKey(env: ReturnType<typeof getEnv>, role: "orchestrator" | "worker" | "worker_b" | "sentinel"): `0x${string}` {
  const keyMap = {
    orchestrator: env.PRIVATE_KEY,
    worker: env.WORKER_PRIVATE_KEY,
    worker_b: env.WORKER_B_PRIVATE_KEY ?? env.WORKER_PRIVATE_KEY,
    sentinel: env.SENTINEL_PRIVATE_KEY,
  } as const;
  return keyMap[role] as `0x${string}`;
}
