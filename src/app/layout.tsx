import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobPilot",
  description: "Local application preparation and tracking",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
