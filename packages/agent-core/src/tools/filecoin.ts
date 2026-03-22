import { Synapse } from "@filoz/synapse-sdk";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";
import { getEnv } from "../config/env.js";

let synapseInstance: Synapse | null = null;
let initAttempted = false;

function getSynapse(): Synapse | null {
  if (synapseInstance) return synapseInstance;
  if (initAttempted) return null;
  initAttempted = true;
  try {
    const env = getEnv();
    const account = privateKeyToAccount(env.WORKER_PRIVATE_KEY as `0x${string}`);
    synapseInstance = Synapse.create({
      account,
      source: "agentledger",
    });
    return synapseInstance;
  } catch {
    return null;
  }
}

let depositDone = false;

async function ensureDeposit(synapse: Synapse, dataSize: number): Promise<void> {
  if (depositDone) return;
  try {
    const prep = await synapse.storage.prepare({ dataSize: BigInt(dataSize) });
    if (prep && !prep.costs.ready && prep.transaction) {
      await prep.transaction.execute();
    }
    depositDone = true;
  } catch {
    // Deposit may already exist or wallet unfunded — upload will retry
    depositDone = true;
  }
}

export async function uploadToFilecoin(
  content: string,
): Promise<{ cid: string; stored: boolean }> {
  const synapse = getSynapse();
  if (synapse) {
    try {
      const data = new TextEncoder().encode(content);
      await ensureDeposit(synapse, Math.max(data.length, 10000));
      // Race upload against a 90-second timeout
      const uploadPromise = synapse.storage.upload(data);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Filecoin upload timed out after 90s")), 90000)
      );
      const result = await Promise.race([uploadPromise, timeoutPromise]);
      return { cid: String(result.pieceCid), stored: true };
    } catch {
      // Synapse upload failed or timed out — falling back to hash-only mode
    }
  }
  const hash = keccak256(toHex(content));
  return { cid: `hash:${hash}`, stored: false };
}

export async function downloadFromFilecoin(cid: string): Promise<string> {
  if (cid.startsWith("hash:")) {
    throw new Error(
      "Content stored in hash-only mode — original not retrievable from hash",
    );
  }
  const synapse = getSynapse();
  if (!synapse) {
    throw new Error("Filecoin client not available");
  }
  const data = await synapse.storage.download({ pieceCid: cid });
  return new TextDecoder().decode(data);
}
