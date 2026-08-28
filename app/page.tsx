import type { Metadata } from "next";
import localData from "@/data/iraqi-journals.json";
import HomeLanding from "@/components/home/HomeLanding";

export const metadata: Metadata = {
  title: "Research intelligence for better publishing decisions",
  description:
    "ابحث في الأدبيات العلمية، تابع أخبار النشر الأكاديمي عالمياً ومحلياً، واستكشف المجلات والتصنيفات من واجهة واحدة موثوقة.",
};

export default function HomePage() {
  return <HomeLanding localNews={localData.news} />;
}
