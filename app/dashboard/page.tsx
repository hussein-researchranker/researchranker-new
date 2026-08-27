import { auth } from "@clerk/nextjs/server";
import DashboardHome from "@/components/dashboard/DashboardHome";

export default async function DashboardPage() {
  await auth.protect();
  return <DashboardHome />;
}
