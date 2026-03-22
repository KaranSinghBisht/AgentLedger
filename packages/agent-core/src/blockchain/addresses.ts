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

// ERC-8004 on Ethereum Mainnet (official)
export const erc8004Ethereum = {
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as Address,
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as Address,
};

// ERC-8004 on Sepolia (official)
export const erc8004Sepolia = {
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as Address,
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as Address,
};

export function getAddresses(chainId: number): ContractAddresses {
  switch (chainId) {
    case 11142220:
      return celoSepolia;
    default:
      return celoSepolia;
  }
}
