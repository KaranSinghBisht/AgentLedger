import type { Address, PublicClient } from "viem";
import { getPublicClient } from "./clients.js";

// Keyed by "chainId:address" to prevent cross-chain nonce pollution
const nonceCache = new Map<string, number>();

function cacheKey(chainId: number, address: Address): string {
  return `${chainId}:${address}`;
}

export async function getNextNonce(address: Address, client?: PublicClient): Promise<number> {
  const pub = client ?? getPublicClient();
  const chainId = pub.chain?.id ?? 0;
  const onChain = await pub.getTransactionCount({ address, blockTag: "pending" });
  const key = cacheKey(chainId, address);
  const cached = nonceCache.get(key);

  // Use cache only if it's ahead of on-chain (rapid sequential calls).
  // If on-chain caught up or surpassed cache (tx confirmed or cache stale from
  // a failed send), on-chain wins and the cache self-corrects.
  const next = cached !== undefined && cached > onChain ? cached : onChain;
  nonceCache.set(key, next + 1);
  return next;
}

export function resetNonce(address: Address, chainId?: number): void {
  if (chainId !== undefined) {
    nonceCache.delete(cacheKey(chainId, address));
  } else {
    // Clear all chains for this address
    for (const key of nonceCache.keys()) {
      if (key.endsWith(`:${address}`)) {
        nonceCache.delete(key);
      }
    }
  }
}
