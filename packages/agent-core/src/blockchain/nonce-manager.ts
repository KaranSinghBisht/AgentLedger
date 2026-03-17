import type { Address } from "viem";
import { getPublicClient } from "./clients.js";

const nonceCache = new Map<Address, number>();

export async function getNextNonce(address: Address): Promise<number> {
  const client = getPublicClient();
  const cached = nonceCache.get(address);

  if (cached !== undefined) {
    const onChain = await client.getTransactionCount({ address });
    const next = Math.max(cached, onChain);
    nonceCache.set(address, next + 1);
    return next;
  }

  const nonce = await client.getTransactionCount({ address });
  nonceCache.set(address, nonce + 1);
  return nonce;
}

export function resetNonce(address: Address): void {
  nonceCache.delete(address);
}
