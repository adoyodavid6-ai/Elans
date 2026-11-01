import { StatusPage } from "@/components/system/StatusPage";

export default function SiteNotFound() {
  return (
    <StatusPage code="Error 404" title="We can't find that page">
      <p>The link may be out of date or the address mistyped. Try the home page, browse our solutions, or run the free AI Opportunity Assessment.</p>
    </StatusPage>
  );
}
