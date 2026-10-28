import type { Metadata } from "next";
import { getCatalogue } from "@/lib/content";
import { availableSlots, SESSION_TYPES, type SessionType } from "@/lib/booking";
import { mpesaMode } from "@/lib/integrations/mpesa";
import { Container, Section } from "@/components/ui/primitives";
import { PageHeader } from "@/components/site/PageHeader";
import { BookingFlow } from "@/components/sessions/BookingFlow";
import { priceLabel } from "@/components/site/Price";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book a session", description: "Book a paid Strategy Session or a free Discovery Call with Elans. Pay by M-Pesa.", alternates: { canonical: "/sessions" } };
type Props = { searchParams: Promise<{ type?: string }> };

export default async function Sessions({ searchParams }: Props) {
  const { type } = await searchParams;
  const cat = await getCatalogue();
  const keys: SessionType[] = ["discovery", "strategy"];
  const types = await Promise.all(
    keys.map(async (k) => {
      const m = SESSION_TYPES[k];
      const p = priceLabel(cat, m.priceKey);
      return { key: k, name: m.name, minutes: m.minutes, summary: m.summary, price: p.text, free: k === "discovery" ? cat.settings.discoveryCallFree : (p.amount ?? 0) === 0, slots: await availableSlots(k) };
    }),
  );
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { label: "Book a session" }]} eyebrow="Sessions" title="Talk to a consultant" lead="A free Discovery Call checks whether we can help. A Strategy Session gives you a consultant's attention on your processes and leaves you with a written action list." />
      <Section className="pt-10">
        <Container>
          <BookingFlow types={types} initialType={type ?? "strategy"} mpesaMode={mpesaMode()} />
        </Container>
      </Section>
    </>
  );
}
