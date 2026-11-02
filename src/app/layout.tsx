import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "Elans — AI Automation & Growth", template: "%s · Elans" },
  description:
    "Elans finds the operational and growth gaps in your business and builds intelligent automation and marketing systems to close them, then runs them against measurable results. Kenya-first, built for East Africa and international clients.",
  applicationName: "Elans",
  openGraph: { type: "website", siteName: "Elans", locale: "en_GB", images: [{ url: "/og.png", width: 1200, height: 630, alt: "Elans: Intelligent Systems. Measurable Results." }] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
};

import { ViewportGuard } from "@/components/ViewportGuard";

export const viewport: Viewport = {
  themeColor: "#6A012A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh">{children}<ViewportGuard /></body>
    </html>
  );
}
