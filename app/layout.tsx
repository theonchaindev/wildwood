import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WILDWOOD — The Glade",
  description: "An isometric forest survival game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
