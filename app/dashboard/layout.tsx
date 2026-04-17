import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | OptionsPilot",
  description: "Your OptionsPilot trading dashboard.",
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
