import { auth } from "@clerk/nextjs/server";
import SearchWizard from "@/components/search/SearchWizard";

export default async function SearchPage() {
  await auth.protect();
  return <SearchWizard />;
}
