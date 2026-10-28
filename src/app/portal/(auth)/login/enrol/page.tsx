import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/app/AuthCard";
import { CodeForm } from "@/components/app/AuthForms";
import { currentUser } from "@/lib/auth";
import { enrolmentDetails } from "@/app/actions/auth";

export default async function PortalEnrol() {
  const u = await currentUser();
  if (!u) redirect("/portal/login");
  const d = await enrolmentDetails();
  if (!d || d.enrolled) redirect("/portal/login/mfa");
  const needsMfa = u.memberships.some((m) => m.kind === "client" && (m.role === "owner" || m.role === "admin"));
  return (
    <AuthCard area="portal" title="Protect your account" subtitle={needsMfa ? "Two-step verification is required for workspace owners and administrators." : "We recommend two-step verification. Scan the code with an authenticator app."} footer={!needsMfa ? <Link href="/portal" className="underline">Skip for now</Link> : undefined}>
      <div className="mb-6 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-xl border border-line" />
        <details className="w-full text-sm"><summary className="cursor-pointer text-muted">Can&apos;t scan? Enter this key manually</summary><code className="mt-2 block break-all rounded-lg bg-surface-2 p-3 font-mono text-xs">{d.secret}</code></details>
      </div>
      <CodeForm area="portal" mode="enrol" />
    </AuthCard>
  );
}
