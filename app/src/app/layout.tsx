import type { Metadata } from "next";

import "./globals.css";
import AppProviders from "@/components/providers/AppProviders";
import EmotionRegistry from "@/components/providers/EmotionRegistry";



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
    <html lang="en" className="inter-fallback">
      <body>
        <EmotionRegistry>
          <AppProviders>{children}</AppProviders>
        </EmotionRegistry>
      </body>
    </html>
  );
}

