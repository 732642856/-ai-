import { scan } from "react-scan";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import * as Sentry from "@sentry/nextjs";
import "./globals.css";

if (typeof window !== "undefined") {
  scan({
    enabled: process.env.NODE_ENV === "development",
    showToolbar: true,
  });
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "星轨画布（前期）",
  description: "面向创意构思、分镜草稿和视觉设计的 StarTrails 前期画布。",
  icons: {
    icon: [{ url: "/startrails-icon.jpg", type: "image/jpeg" }],
    apple: [{ url: "/startrails-icon.jpg", type: "image/jpeg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Sentry.ErrorBoundary fallback={<div>Something went wrong</div>}>
          {children}
        </Sentry.ErrorBoundary>
      </body>
    </html>
  );
}
