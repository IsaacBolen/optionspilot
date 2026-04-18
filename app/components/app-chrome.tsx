"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function UserAvatarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block size-5 shrink-0 ${className ?? ""}`}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function AppHeader() {
  const pathname = usePathname();
  const dashboardActive = pathname === "/dashboard";
  const screenerActive = pathname === "/screener";
  const positionsActive = pathname === "/positions";

  return (
    <header className="relative z-10 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6 lg:gap-10">
          <Link
            href="/"
            className="shrink-0 text-lg font-semibold tracking-tight text-white transition hover:text-emerald-200"
          >
            OptionsPilot
          </Link>
          <div className="flex flex-wrap items-center gap-x-0.5 gap-y-1 sm:gap-x-1">
            <Link
              href="/dashboard"
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                dashboardActive
                  ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/25"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-emerald-200/90"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/screener"
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                screenerActive
                  ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/25"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-emerald-200/90"
              }`}
            >
              Screener
            </Link>
            <Link
              href="/positions"
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                positionsActive
                  ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-500/25"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-emerald-200/90"
              }`}
            >
              Positions
            </Link>
            <span
              className="cursor-not-allowed select-none rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-600"
              title="Coming soon"
            >
              AI Chat
            </span>
          </div>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200"
          aria-label="Open profile menu"
        >
          <UserAvatarIcon />
        </button>
      </nav>
    </header>
  );
}

export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[420px] w-[600px] rounded-full bg-emerald-500/12 blur-[100px]" />
        <div className="absolute -right-1/4 bottom-0 h-[380px] w-[520px] rounded-full bg-cyan-500/8 blur-[95px]" />
        <div
          className="absolute inset-0 opacity-[0.3]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <AppHeader />

      {children}
    </div>
  );
}
