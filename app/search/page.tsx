import { redirect } from "next/navigation";
import SearchWizard from "@/components/search/SearchWizard";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = String(rawQuery ?? "").trim();

  if (query) {
    const target = new URLSearchParams({
      q: query,
      quartile: "All",
      field: "all",
    });
    redirect(`/results?${target.toString()}`);
  }

  return <SearchWizard />;
}
