import { auth } from "@clerk/nextjs/server";
import JournalSlider from "@/components/journals/JournalSlider";

export default async function JournalsPage() {
  await auth.protect();
  return <JournalSlider />;
}
