import Link from "next/link";
import { Wordmark } from "@/components/ui/Logo";
import type { SiteSettings } from "@/content/seed/settings";

export function Footer({ settings }: { settings: SiteSettings }) {
  const cols = [
    { title: "Solutions", links: [["/solutions", "All solutions"], ["/solutions/tax-compliance/etims-compliance-reconciliation", "eTIMS compliance"], ["/solutions/customer-service/whatsapp-sales-support-agent", "WhatsApp agents"], ["/solutions/payments-reconciliation/mpesa-bank-reconciliation", "M-Pesa reconciliation"], ["/templates", "Template library"], ["/integrations", "Integrations"]] },
    { title: "Industries", links: [["/industries/healthcare", "Healthcare"], ["/industries/saccos-lenders", "SACCOs & lenders"], ["/industries/education", "Education"], ["/industries/property-management", "Property"], ["/industries/retail-ecommerce", "Retail"], ["/industries", "All industries"]] },
    { title: "Growth & tools", links: [["/growth", "Growth & marketing"], ["/growth/ai-visibility-check", "AI Visibility Check"], ["/assessment", "AI Opportunity Assessment"], ["/roi", "ROI calculators"], ["/frontier", "Frontier: what's next"], ["/resources", "Resources"]] },
    { title: "Company", links: [["/about", "About"], ["/how-it-works", "How it works"], ["/case-studies", "Case studies"], ["/partners", "Partners"], ["/trust", "Trust & security"], ["/careers", "Careers"], ["/contact", "Contact"]] },
  ];
  return (
    <footer className="bg-espresso text-sand" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        Footer
      </h2>
      <div className="mx-auto max-w-[88rem] px-4 pb-28 pt-16 sm:px-6 md:pb-12 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <Wordmark tone="light" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-sand/80">{settings.tagline} AI automation and growth systems for businesses in Kenya, East Africa and beyond.</p>
            <p className="mt-4 text-sm text-sand/70">{settings.address}</p>
            {settings.email && <p className="text-sm text-sand/70">{settings.email}</p>}
            <Link href="/contact" className="mt-4 inline-block text-sm font-semibold text-copper hover:underline">
              Contact us →
            </Link>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper">{c.title}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className="text-sm text-sand/85 hover:text-ivory">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-sand/65 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Elans{settings.legalEntity ? ` · ${settings.legalEntity}` : ""}. We do not use client data to train AI models.
            {settings.odpcRegistration ? ` ODPC registration ${settings.odpcRegistration}.` : ""}
          </p>
          <ul className="flex flex-wrap gap-4">
            {[["/legal/privacy", "Privacy"], ["/legal/terms", "Terms"], ["/legal/cookies", "Cookies"], ["/legal/dpa", "Data processing"], ["/legal/acceptable-use", "Acceptable use"]].map(([h, l]) => (
              <li key={h}>
                <Link href={h} className="hover:text-ivory">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export function MobileCtaBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ivory/95 p-3 backdrop-blur md:hidden">
      <div className="flex gap-2">
        <Link href="/assessment" className="flex h-11 flex-1 items-center justify-center rounded-full bg-brown text-sm font-semibold text-white">
          Find opportunities
        </Link>
        <Link href="/sessions" className="flex h-11 flex-1 items-center justify-center rounded-full bg-white text-sm font-semibold text-espresso ring-1 ring-line">
          Book a call
        </Link>
      </div>
    </div>
  );
}
