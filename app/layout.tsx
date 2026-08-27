import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
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
    "منصة بحث أكاديمي للتحقق من بيانات المجلات، البحث بالمصادر، التلخيص المقيد بالأدلة، ومتابعة أخبار النشر العلمي.",
  applicationName: "ResearchRanker",
  keywords: [
    "academic search",
    "research articles",
    "journal quartile",
    "Scopus",
    "Crossref",
    "OpenAlex",
    "DOI",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
