import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/app/AuthCard";
import { LoginForm } from "@/components/app/AuthForms";
import { Callout } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Client portal sign in", robots: { index: false } };
type Props = { searchParams: Promise<{ error?: string }> };

export default async function PortalLogin({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <AuthCard area="portal" title="Sign in to your client portal" subtitle="Approvals, automations, conversations, reports and billing in one place." footer={<>New to Elans? <Link href="/assessment" className="underline">Start with the free assessment</Link></>}>
      {error === "no-access" && <Callout tone="warning" className="mb-4">Your account is not linked to a client workspace yet.</Callout>}
      <LoginForm area="portal" />
      <div className="mt-6 rounded-2xl border border-dashed border-copper/60 bg-copper/5 p-4 text-sm">
        <p className="font-semibold text-heading">Just looking?</p>
        <p className="mt-1 text-muted">Explore a demo workspace with illustrative data: an eTIMS proof automation, M-Pesa reconciliation and a WhatsApp agent.</p>
        <Link href="/portal/demo" prefetch={false} className="mt-3 inline-flex h-10 items-center rounded-full bg-brown px-4 font-semibold text-white">Open the demo workspace</Link>
      </div>
    </AuthCard>
  );
}
