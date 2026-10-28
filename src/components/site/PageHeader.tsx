import type { ReactNode } from "react";
import { Breadcrumbs, Container, Eyebrow, Heading, Lead } from "@/components/ui/primitives";
import { JsonLd, breadcrumbLd } from "./JsonLd";

export function PageHeader({ crumbs, eyebrow, title, lead, actions, aside, children }: { crumbs?: { href?: string; label: string }[]; eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode; aside?: ReactNode; children?: ReactNode }) {
  return (
    <header className="border-b border-line bg-ivory">
      {crumbs && <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.label, path: c.href ?? "" })))} />}
      <Container className="py-10 sm:py-14">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <div className={aside ? "mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-start" : "mt-6"}>
          <div className="min-w-0 max-w-3xl">
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <Heading as="h1" size="lg" className="mt-3 sm:text-5xl">
              {title}
            </Heading>
            {lead && <Lead className="mt-5">{lead}</Lead>}
            {actions && <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
            {children}
          </div>
          {aside && <div className="min-w-0">{aside}</div>}
        </div>
      </Container>
    </header>
  );
}
