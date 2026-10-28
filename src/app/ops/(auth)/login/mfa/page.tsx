import { redirect } from "next/navigation";
import { AuthCard } from "@/components/app/AuthCard";
import { CodeForm } from "@/components/app/AuthForms";
import { currentUser } from "@/lib/auth";

export default async function OpsMfa() {
  const u = await currentUser();
  if (!u) redirect("/ops/login");
  if (!u.mfaEnabled) redirect("/ops/login/enrol");
  return (
    <AuthCard area="ops" title="Two-step verification" subtitle={`Signed in as ${u.email}`}>
      <CodeForm area="ops" mode="verify" />
    </AuthCard>
  );
}
