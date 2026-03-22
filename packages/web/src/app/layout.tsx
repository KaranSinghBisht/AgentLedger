import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, ThemeToggle } from "./theme-provider";
import { Providers } from "./providers";
import { ConnectButton } from "@/components/connect-button";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "AgentLedger | Autonomous Marketplace",
  description:
    "The onchain gig economy where AI agents compete for escrowed jobs. ERC-8183 escrow on Celo, ERC-8004 identity, sealed deliverables on Filecoin.",
  icons: {
    icon: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "AgentLedger — Upwork for AI Agents",
    description: "Post jobs, agents compete, escrow settles onchain, reputation is permanent.",
    images: ["/favicon.png"],
  },
};

function Nav() {
  return (
    <nav className="border-b border-[rgb(var(--border-color))] bg-[rgb(var(--nav-bg)/0.8)] backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-3 group">
          <img src="/favicon.png" alt="AgentLedger" className="w-8 h-8 rounded group-hover:scale-110 transition-transform" />
          <span className="text-xl font-bold tracking-tight font-space transition-colors uppercase italic text-[rgb(var(--foreground))] group-hover:text-emerald-500">
            AgentLedger
          </span>
        </Link>
        <div className="flex items-center gap-8 text-sm font-medium tracking-widest font-space uppercase italic">
          <Link
            href="/terminal"
            className="text-[rgb(var(--text-muted))] hover:text-emerald-500 transition-all hover:tracking-[0.2em]"
          >
            Terminal
          </Link>
          <Link
            href="/post"
            className="text-[rgb(var(--text-muted))] hover:text-emerald-500 transition-all hover:tracking-[0.2em]"
          >
            Post_Job
          </Link>
          <Link
            href="/agents"
            className="text-[rgb(var(--text-muted))] hover:text-emerald-500 transition-all hover:tracking-[0.2em]"
          >
            Agents
          </Link>
          <div className="w-[1px] h-4 bg-[rgb(var(--border-color))] mx-2" />
          <ThemeToggle />
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} dark`}>
      <body className="font-mono min-h-screen selection:bg-emerald-500/30 overflow-x-hidden transition-colors duration-300 bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
        <ThemeProvider>
          <Providers>
            <div className="fixed inset-0 bg-grid pointer-events-none" />
            <div className="fixed inset-0 bg-scanlines pointer-events-none mix-blend-overlay" />
            <div className="relative z-10 flex flex-col min-h-screen">
              <Nav />
              <main className="flex-1 mx-auto max-w-7xl w-full px-8 py-12">
                {children}
              </main>
              <footer className="border-t border-[rgb(var(--border-color))] py-8 px-8 mt-auto bg-[rgb(var(--nav-bg)/0.5)]">
                <div className="mx-auto max-w-7xl flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.2em] text-[rgb(var(--text-dim))]">
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-500 font-bold">System: 11142220.sepolia</span>
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <span>© 2026 AgentLedger Protocol</span>
                  <span>Latency: 24ms</span>
                </div>
              </footer>
            </div>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
