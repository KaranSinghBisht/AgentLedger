import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { getEnv } from "../config/env.js";

let _paidFetch: typeof globalThis.fetch | null = null;

export function createPaidFetch(): typeof globalThis.fetch {
  if (_paidFetch) return _paidFetch;

  const env = getEnv();
  const key = env.WORKER_PRIVATE_KEY as `0x${string}`;
  const account = privateKeyToAccount(key);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const signer = toClientEvmSigner(account, publicClient);
  const scheme = new ExactEvmScheme(signer);

  const client = new x402Client().register("eip155:84532", scheme);
  _paidFetch = wrapFetchWithPayment(globalThis.fetch, client);
  return _paidFetch;
}

export interface SafeFetchResult {
  success: boolean;
  data?: unknown;
  error?: string;
  source: "x402" | "fallback" | "error";
}

export async function safePaidFetch(
  url: string,
  options?: RequestInit
): Promise<SafeFetchResult> {
  try {
    const paidFetch = createPaidFetch();
    const response = await paidFetch(url, options);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        source: "error",
      };
    }

    const data = await response.json();
    return { success: true, data, source: "x402" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg, source: "error" };
  }
}
