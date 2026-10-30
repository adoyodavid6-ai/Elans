import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bookingStatus } from "@/app/actions/booking";
import { SESSION_TYPES, type SessionType } from "@/lib/booking";
import { mpesaMode } from "@/lib/integrations/mpesa";
import { ButtonLink, Callout, Container, Section } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { PaymentPoller } from "@/components/sessions/PaymentPoller";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Booking confirmation", robots: { index: false, follow: false } };
type Props = { params: Promise<{ id: string }> };

export default async function Confirmation({ params }: Props) {
  const { id } = await params;
  const b = await bookingStatus(id);
  if (!b) notFound();
  const meta = SESSION_TYPES[b.type as SessionType];
  const when = b.starts_at.toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
  const confirmed = b.status === "confirmed";
  return (
    <Section>
      <Container className="max-w-2xl">
        <div className="rounded-[2rem] border border-line bg-white p-6 text-center sm:p-10">
          <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${confirmed ? "bg-success-bg text-success" : "bg-warning-bg text-warning"}`}>
            <Icon name={confirmed ? "check" : "clock"} size={28} />
          </span>
          <h1 className="mt-4 font-display text-3xl font-bold">{confirmed ? "You're booked" : "Waiting for payment"}</h1>
          <p className="mt-2 text-muted">
            {meta?.name} · {when} EAT · {meta?.minutes} minutes
          </p>
          {!confirmed && b.status === "pending_payment" && (
            <div className="mt-6 text-left">
              {b.payment_status ? (
                <PaymentPoller bookingId={b.id} testMode={mpesaMode() === "mock" || b.provider === "mock"} message={b.message ?? "Check your phone and enter your M-Pesa PIN to approve the payment."} />
              ) : (
                <Callout tone="info">We will email an invoice to your organisation. Your slot is held for 48 hours.</Callout>
              )}
            </div>
          )}
          {confirmed && (
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <ButtonLink href={`/api/bookings/${b.id}/ics`} variant="secondary" icon="calendar">Add to calendar</ButtonLink>
              <ButtonLink href="/assessment" icon="arrow-right">Prepare with the assessment</ButtonLink>
            </div>
          )}
          {b.status === "cancelled" && <Callout tone="danger" className="mt-6 text-left">This booking was cancelled.</Callout>}
        </div>
      </Container>
    </Section>
  );
}
