import { Header, type MegaMenu } from "@/components/site/Header";
import { Footer, MobileCtaBar } from "@/components/site/Footer";
import { ChatWidget } from "@/components/site/ChatWidget";
import { getCatalogue } from "@/lib/content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const cat = await getCatalogue();
  const menus: MegaMenu[] = [
    {
      key: "solutions",
      label: "Solutions",
      href: "/solutions",
      groups: cat.categoryGroups
        .map((g) => ({
          title: g.name,
          links: cat.categories.filter((c) => c.group === g.key).map((c) => ({ href: `/solutions/${c.slug}`, label: c.name })),
        }))
        .reduce<MegaMenu["groups"]>((acc, g, i) => {
          // Fold six function groups into three columns.
          if (i % 2 === 0) acc.push({ title: g.title, links: g.links });
          else acc[acc.length - 1] = { title: `${acc[acc.length - 1].title} · ${g.title}`, links: [...acc[acc.length - 1].links, ...g.links] };
          return acc;
        }, []),
      feature: { title: "Start with the proof solution", body: "eTIMS Compliance & Reconciliation: every purchase invoice checked before you claim it.", href: "/solutions/tax-compliance/etims-compliance-reconciliation", cta: "See how it works" },
    },
    {
      key: "industries",
      label: "Industries",
      href: "/industries",
      groups: [0, 1, 2].map((col) => ({
        title: ["Health, finance & education", "Property, hospitality & trade", "Operations & impact"][col],
        links: cat.industries.filter((_, i) => i % 3 === col).map((i) => ({ href: `/industries/${i.slug}`, label: i.short })),
      })),
      feature: { title: "Industry Packs", body: "Bundled solutions for hospitals, SACCOs, schools, landlords, retailers and more.", href: "/industries#packs", cta: "Browse packs" },
    },
    {
      key: "growth",
      label: "Growth & Marketing",
      href: "/growth",
      groups: [
        { title: "Elans Grow", links: cat.growthServices.filter((g) => g.division === "grow").map((g) => ({ href: `/growth/${g.slug}`, label: g.name.replace(/ \(.*\)$/, "") })) },
        { title: "Studio · Relate", links: cat.growthServices.filter((g) => g.division === "studio" || g.division === "relate").map((g) => ({ href: `/growth/${g.slug}`, label: g.name.replace(/ \(.*\)$/, "") })) },
        { title: "Intelligence · Free tools", links: [...cat.growthServices.filter((g) => g.division === "intelligence").map((g) => ({ href: `/growth/${g.slug}`, label: g.name })), { href: "/growth/ai-visibility-check", label: "Free AI Visibility Check" }, { href: "/roi/whatsapp-after-hours", label: "WhatsApp leakage calculator" }, { href: "/frontier", label: "Frontier: emerging needs" }] },
      ],
      feature: { title: "Are AI assistants recommending you?", body: "Run the free AI Visibility Check for a sample snapshot of how AI answers describe your business.", href: "/growth/ai-visibility-check", cta: "Run the check" },
    },
    {
      key: "company",
      label: "Company",
      href: "/about",
      groups: [
        { title: "About Elans", links: [{ href: "/about", label: "About" }, { href: "/how-it-works", label: "The Elans Method" }, { href: "/careers", label: "Careers" }] },
        { title: "Proof & trust", links: [{ href: "/case-studies", label: "Case studies" }, { href: "/trust", label: "Security, privacy & AI governance" }, { href: "/integrations", label: "Integrations" }] },
        { title: "Work with us", links: [{ href: "/contact", label: "Contact" }, { href: "/sessions", label: "Book a session" }, { href: "/partners", label: "Partners & white-label" }] },
      ],
    },
  ];
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header menus={menus} />
      <main id="main">{children}</main>
      <Footer settings={cat.settings} />
      <MobileCtaBar />
      <ChatWidget />
    </>
  );
}
