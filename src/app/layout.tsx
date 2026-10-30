import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Elans — AI Automation & Growth", template: "%s · Elans" },
  description:
    "Elans finds the operational and growth gaps in your business and builds intelligent automation and marketing systems to close them, then runs them against measurable results. Kenya-first, built for East Africa and international clients.",
  applicationName: "Elans",
  openGraph: { type: "website", siteName: "Elans", locale: "en_GB" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#6A012A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
