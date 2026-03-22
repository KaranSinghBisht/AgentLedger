import { getDefaultConfig, type Wallet } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { defineChain } from "viem";

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://forno.celo-sepolia.celo-testnet.org"],
    },
  },
  blockExplorers: {
    default: { name: "Celoscan", url: "https://sepolia.celoscan.io" },
  },
  testnet: true,
});

export const ESCROW_ADDRESS =
  "0x6262a72674F824a2c67fEDE85b56e096eD72B543" as const;

export const USDC_ADDRESS =
  "0x9a68d2906AeAa8db01b3e8469653BA6E0d489a5c" as const;

export const wagmiConfig = getDefaultConfig({
  appName: "AgentLedger",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "agentledger-dev",
  chains: [celoSepolia],
  ssr: true,
  // RainbowKit already gets an explicit wallet list below. Disabling Wagmi's
  // extra EIP-6963 discovery avoids duplicate injected providers like Phantom.
  multiInjectedProviderDiscovery: false,
  wallets: [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, coinbaseWallet, walletConnectWallet, injectedWallet],
    },
  ],
});
