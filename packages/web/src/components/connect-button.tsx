"use client";

import { ConnectButton as RKConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectButton() {
  return (
    <RKConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!ready) {
          return (
            <div className="px-4 py-2 text-xs font-mono text-[rgb(var(--text-dim))] uppercase tracking-widest">
              ...
            </div>
          );
        }

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className="px-4 py-2 border border-emerald-500/40 text-emerald-500 text-xs font-mono uppercase tracking-widest hover:bg-emerald-500/10 hover:border-emerald-500 transition-all"
            >
              Connect_Wallet
            </button>
          );
        }

        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="px-4 py-2 border border-red-500/40 text-red-400 text-xs font-mono uppercase tracking-widest hover:bg-red-500/10 transition-all"
            >
              Wrong_Network
            </button>
          );
        }

        return (
          <button
            onClick={openAccountModal}
            className="flex items-center gap-3 px-4 py-2 border border-emerald-500/20 text-xs font-mono uppercase tracking-widest hover:border-emerald-500/50 transition-all group"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[rgb(var(--text-muted))] group-hover:text-emerald-500 transition-colors">
              {account.displayName}
            </span>
          </button>
        );
      }}
    </RKConnectButton.Custom>
  );
}
