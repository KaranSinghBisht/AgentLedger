import type { Address } from "viem";

export interface ContractAddresses {
  escrow: Address;
  hook: Address;
  paymentToken: Address;
  identityRegistry?: Address;
  reputationRegistry?: Address;
}

function requireAddress(envVar: string, name: string): Address {
  const val = process.env[envVar];
  if (!val || val === "") throw new Error(`Missing required env var ${envVar} for ${name}`);
  return val as Address;
}

// Celo Sepolia Testnet — filled after deployment
export const celoSepolia: ContractAddresses = {
  escrow: requireAddress("ESCROW_CONTRACT_ADDRESS", "escrow"),
  hook: requireAddress("HOOK_CONTRACT_ADDRESS", "hook"),
  paymentToken: requireAddress("PAYMENT_TOKEN_ADDRESS", "paymentToken"),
};

// ERC-8004-compatible registries on Celo Sepolia (our deployment — permissionless)
export const erc8004CeloSepolia = {
  identityRegistry: "0xf49deb57997bd9a89b72f1669589d24a5afbb1b0" as Address,
  reputationRegistry: "0x10372602654c1bd271622f61f0a7e979e6bf0b92" as Address,
};

export function getAddresses(chainId: number): ContractAddresses {
  switch (chainId) {
    case 11142220:
      return celoSepolia;
    default:
      return celoSepolia;
  }
}
