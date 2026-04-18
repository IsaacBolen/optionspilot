import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const q = await searchParams;
  const initialTab =
    q.tab === "screener" ? ("screener" as const) : ("overview" as const);

  return <DashboardClient initialTab={initialTab} />;
}
