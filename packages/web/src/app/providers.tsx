"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { wagmiConfig } from "@/lib/wagmi-config";
import { useTheme } from "./theme-provider";

import "@rainbow-me/rainbowkit/styles.css";

function RainbowKitThemeWrapper({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  const rkTheme =
    theme === "light"
      ? lightTheme({
          accentColor: "#10b981",
          accentColorForeground: "white",
          borderRadius: "small",
        })
      : darkTheme({
          accentColor: "#10b981",
          accentColorForeground: "black",
          borderRadius: "small",
        });

  return <RainbowKitProvider theme={rkTheme}>{children}</RainbowKitProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitThemeWrapper>{children}</RainbowKitThemeWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
