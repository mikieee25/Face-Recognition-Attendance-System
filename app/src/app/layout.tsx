import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "@/components/providers/AppProviders";
import EmotionRegistry from "@/components/providers/EmotionRegistry";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "BFP Sorsogon Attendance System",
  description:
    "Bureau of Fire Protection Sorsogon Attendance Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <EmotionRegistry>
          <AppProviders>{children}</AppProviders>
        </EmotionRegistry>
      </body>
    </html>
  );
}

