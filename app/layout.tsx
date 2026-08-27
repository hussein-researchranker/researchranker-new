import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ResearchRanker",
    template: "%s | ResearchRanker",
  },
  description:
    "منصة بحثية للعثور على المصادر العلمية، مراجعة بيانات المجلات والتصنيفات، التحقق من الوصول المفتوح، وحفظ المراجع في مكتبة بحثية شخصية.",
  applicationName: "ResearchRanker",
  keywords: [
    "research articles",
    "academic journals",
    "PubMed",
    "Crossref",
    "OpenAlex",
    "SCImago",
    "Q1 journals",
    "research library",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="ar"
        dir="rtl"
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <body className="pb-24 md:pb-0">
          <LanguageProvider>{children}</LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
