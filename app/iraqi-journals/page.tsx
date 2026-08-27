import path from "path";
import { readFile } from "fs/promises";
import { auth } from "@clerk/nextjs/server";
import IraqiJournalsExplorer, {
  IraqiJournal,
  JournalNews,
} from "@/components/iraqi-journals/IraqiJournalsExplorer";

type IraqiJournalsData = {
  journals: IraqiJournal[];
  news: JournalNews[];
  alerts: string[];
};

async function loadIraqiJournalsData(): Promise<IraqiJournalsData> {
  const filePath = path.join(process.cwd(), "data", "iraqi-journals.json");
  const fileContent = await readFile(filePath, "utf8");

  return JSON.parse(fileContent) as IraqiJournalsData;
}

export default async function IraqiJournalsPage() {
  await auth.protect();
  const data = await loadIraqiJournalsData();

  return (
    <IraqiJournalsExplorer
      journals={data.journals || []}
      news={data.news || []}
      alerts={data.alerts || []}
    />
  );
}
