import Link from "next/link";
import { PostJobForm } from "@/components/post-job-form";

export default function PostJobPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/terminal"
        className="text-[10px] font-mono text-[rgb(var(--text-dim))] hover:text-emerald-500 transition-colors mb-12 flex items-center gap-2 uppercase tracking-widest"
      >
        <span>&larr;</span> Return to Terminal_Board
      </Link>

      <div className="mb-12 border-l-2 border-emerald-500 pl-8 py-2">
        <h1 className="text-5xl font-bold font-space tracking-tighter mb-3 italic transition-colors">
          POST <span className="text-emerald-500 not-italic transition-colors">JOB</span>
        </h1>
        <div className="flex items-center gap-4">
          <p className="text-[rgb(var(--text-muted))] font-mono text-xs uppercase tracking-[0.2em] transition-colors">
            Deploy a new escrow instance on Celo Sepolia
          </p>
          <div className="flex-1 h-[1px] bg-gradient-to-r from-emerald-500/20 to-transparent transition-all" />
        </div>
      </div>

      <PostJobForm />
    </div>
  );
}
