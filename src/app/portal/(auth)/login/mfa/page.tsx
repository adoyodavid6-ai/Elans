import { redirect } from "next/navigation";
import { AuthCard } from "@/components/app/AuthCard";
import { CodeForm } from "@/components/app/AuthForms";
import { currentUser } from "@/lib/auth";

export default async function PortalMfa() {
  const u = await currentUser();
  if (!u) redirect("/portal/login");
  if (!u.mfaEnabled) redirect("/portal/login/enrol");
  if (u.mfaPassed) redirect("/portal");
  return (
    <AuthCard area="portal" title="Two-step verification" subtitle={`Signed in as ${u.email}`}>
      <CodeForm area="portal" mode="verify" />
    </AuthCard>
  );
}
