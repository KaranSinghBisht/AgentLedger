import { z } from "zod";
import { config } from "dotenv";

config({ path: "../../.env" });

const envSchema = z.object({
  PRIVATE_KEY: z.string().startsWith("0x"),
  WORKER_PRIVATE_KEY: z.string().startsWith("0x"),
  SENTINEL_PRIVATE_KEY: z.string().startsWith("0x"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1),
  ESCROW_CONTRACT_ADDRESS: z.string().startsWith("0x"),
  HOOK_CONTRACT_ADDRESS: z.string().startsWith("0x"),
  PAYMENT_TOKEN_ADDRESS: z.string().startsWith("0x"),
  AGENTCASH_WALLET_ADDRESS: z.string().startsWith("0x").optional().or(z.literal("")),
  CELO_RPC_URL: z.string().url().default("https://forno.celo-sepolia.celo-testnet.org"),
  ETH_SEPOLIA_RPC_URL: z.string().url().default("https://rpc.sepolia.org"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
