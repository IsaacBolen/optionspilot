import Link from "next/link";

export default function GetStartedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-100">
      <p className="text-lg font-medium">Welcome to OptionsPilot</p>
      <p className="mt-2 max-w-md text-sm text-zinc-400">
        Onboarding will live here. Connect this route to your auth or waitlist
        flow when you are ready.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-emerald-400 hover:text-emerald-300"
      >
        ← Back to home
      </Link>
    </div>
  );
}
