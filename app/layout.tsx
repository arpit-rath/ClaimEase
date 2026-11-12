import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppNav from "@/components/AppNav";
import BrandMark from "@/components/BrandMark";
import UserBadge from "@/components/UserBadge";
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
  title: { default: "ClaimEase", template: "%s · ClaimEase" },
  description: "Describe a work expense in plain language and submit it as a claim.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:px-8">
            <BrandMark />
            <AppNav className="col-span-2 row-start-2 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:justify-self-start" />
            <UserBadge />
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
