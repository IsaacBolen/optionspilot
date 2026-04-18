import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[520px] w-[720px] rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute -right-1/4 bottom-0 h-[480px] w-[640px] rounded-full bg-cyan-500/10 blur-[110px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <header className="relative z-10 border-b border-white/10 bg-zinc-950/70 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-5xl items-center px-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-white"
          >
            OptionsPilot
          </Link>
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 sm:pt-28">
          <p className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-emerald-300/90">
            AI-powered options companion
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
            Trade options with{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
              clarity, not chaos
            </span>
            .
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            OptionsPilot helps you interpret chains, surface risk, and explore
            strategies—so you spend less time guessing and more time deciding
            with context you can trust.
          </p>
          <div className="mt-10">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-8 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
            >
              Get Started
            </Link>
          </div>
          <p className="mt-16 max-w-2xl text-sm leading-relaxed text-zinc-500">
            Educational tooling only—not investment advice. Markets involve risk;
            always do your own research.
          </p>
        </section>
      </main>
    </div>
  );
}
