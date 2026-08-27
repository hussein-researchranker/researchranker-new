import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import DashboardHome from "@/components/dashboard/DashboardHome";

export default async function DashboardPage() {
  await auth.protect();

  return (
    <>
      <DashboardHome />
      <Link
        href="/library"
        className="fixed bottom-4 left-4 z-40 rounded-2xl border border-violet-200 bg-white/95 px-4 py-3 text-sm font-black text-violet-800 shadow-lg backdrop-blur hover:-translate-y-0.5 hover:shadow-xl sm:bottom-6 sm:left-6"
      >
        مكتبتي البحثية
      </Link>
    </>
  );
}
