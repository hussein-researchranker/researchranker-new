import { auth } from "@clerk/nextjs/server";
import LibraryWorkspace from "@/components/library/LibraryWorkspace";

export default async function LibraryPage() {
  await auth.protect();
  return <LibraryWorkspace />;
}
