import type { Metadata } from "next";
import { StatusPage } from "@/components/system/StatusPage";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main id="main" className="bg-ivory">
      <StatusPage code="Error 404" title="We can't find that page">
        <p>The link may be out of date or the address mistyped. Try the home page, browse our solutions, or run the free AI Opportunity Assessment.</p>
      </StatusPage>
    </main>
  );
}
