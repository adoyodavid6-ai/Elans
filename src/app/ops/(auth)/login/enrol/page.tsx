import { redirect } from "next/navigation";
import { AuthCard } from "@/components/app/AuthCard";
import { CodeForm } from "@/components/app/AuthForms";
import { currentUser } from "@/lib/auth";
import { enrolmentDetails } from "@/app/actions/auth";

export default async function OpsEnrol() {
  const u = await currentUser();
  if (!u) redirect("/ops/login");
  const d = await enrolmentDetails();
  if (!d || d.enrolled) redirect("/ops/login/mfa");
  return (
    <AuthCard area="ops" title="Set up two-step verification" subtitle="Scan this code with Google Authenticator, Microsoft Authenticator, 1Password or any TOTP app, then enter the 6-digit code.">
      <div className="mb-6 flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={d.qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-xl border border-line" />
        <details className="w-full text-sm">
          <summary className="cursor-pointer text-muted">Can&apos;t scan? Enter this key manually</summary>
          <code className="mt-2 block break-all rounded-lg bg-surface-2 p-3 font-mono text-xs">{d.secret}</code>
        </details>
      </div>
      <CodeForm area="ops" mode="enrol" />
    </AuthCard>
  );
}
