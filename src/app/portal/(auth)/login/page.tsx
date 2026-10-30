import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/app/AuthCard";
import { LoginForm } from "@/components/app/AuthForms";
import { Callout } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Client portal sign in", robots: { index: false } };
type Props = { searchParams: Promise<{ error?: string; demo?: string }> };

const DEMO_MESSAGES: Record<string, string> = {
  "no-database": "The demo workspace is not available on this deployment yet: no database is connected. You can still explore the public site, run the free assessment and use the ROI calculators.",
  "not-seeded": "The demo workspace has not been set up on this deployment yet. Please try again later.",
  "database-error": "The demo workspace is temporarily unavailable. Please try again in a few minutes.",
  busy: "Too many demo sessions from your network in the last hour. Please try again later.",
};

export default async function PortalLogin({ searchParams }: Props) {
  const { error, demo } = await searchParams;
  return (
    <AuthCard area="portal" title="Sign in to your client portal" subtitle="Approvals, automations, conversations, reports and billing in one place." footer={<>New to Elans? <Link href="/assessment" className="underline">Start with the free assessment</Link></>}>
      {error === "no-access" && <Callout tone="warning" className="mb-4">Your account is not linked to a client workspace yet.</Callout>}
      {demo && DEMO_MESSAGES[demo] && <Callout tone="warning" className="mb-4">{DEMO_MESSAGES[demo]}</Callout>}
      <LoginForm area="portal" />
      <div className="mt-6 rounded-2xl border border-dashed border-copper/60 bg-copper/5 p-4 text-sm">
        <p className="font-semibold text-heading">Just looking?</p>
        <p className="mt-1 text-muted">Explore a demo workspace with illustrative data: an eTIMS proof automation, M-Pesa reconciliation and a WhatsApp agent.</p>
        <Link href="/portal/demo" prefetch={false} className="mt-3 inline-flex h-10 items-center rounded-full bg-brown px-4 font-semibold text-white">Open the demo workspace</Link>
      </div>
    </AuthCard>
  );
}
