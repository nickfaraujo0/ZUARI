import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-cormorant", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ZUARI — Build. Manage. Deliver.", template: "%s · ZUARI" },
  description: "The operating system for construction. One platform. Every project.",
  applicationName: "ZUARI",
  appleWebApp: { capable: true, title: "ZUARI Site", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};
export const viewport: Viewport = { themeColor: "#123C36", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable} ${plex.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
