import type { Address } from "viem";

export interface ContractAddresses {
  escrow: Address;
  hook: Address;
  paymentToken: Address;
  identityRegistry?: Address;
  reputationRegistry?: Address;
}

// Celo Mainnet
export const celoMainnet: ContractAddresses = {
  escrow: "0x0000000000000000000000000000000000000000" as Address, // TODO: deploy
  hook: "0x0000000000000000000000000000000000000000" as Address,
  paymentToken: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address, // USDC
};

// Celo Sepolia Testnet — filled after deployment
export const celoSepolia: ContractAddresses = {
  escrow: (process.env.ESCROW_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address,
  hook: (process.env.HOOK_CONTRACT_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address,
  paymentToken: (process.env.PAYMENT_TOKEN_ADDRESS ?? "0x0000000000000000000000000000000000000000") as Address,
};

// ERC-8004 on Celo (if deployed)
export const erc8004Celo = {
  identityRegistry: "0x0000000000000000000000000000000000000000" as Address, // TODO
  reputationRegistry: "0x0000000000000000000000000000000000000000" as Address,
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
    case 42220:
      return celoMainnet;
    case 11142220:
      return celoSepolia;
    default:
      return celoSepolia;
  }
}
