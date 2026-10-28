import { AuthCard } from "@/components/app/AuthCard";
import { withDb } from "@/lib/db";
import { sha256 } from "@/lib/security";
import { acceptInvite } from "@/app/portal/actions";
import { Callout } from "@/components/ui/primitives";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> };

export default async function Invite({ params, searchParams }: Props) {
  const { token } = await params;
  const { error } = await searchParams;
  const inv = await withDb({ system: true }, async (tx) => {
    const [i] = await tx<{ email: string; role: string; accepted_at: Date | null; expires_at: Date; tenant: string }[]>`select i.email, i.role, i.accepted_at, i.expires_at, t.name as tenant from invites i join tenants t on t.id = i.tenant_id where i.token_hash = ${sha256(token)}`;
    return i;
  }).catch(() => null);
  if (!inv || inv.accepted_at || inv.expires_at < new Date()) {
    return <AuthCard area="portal" title="Invitation unavailable"><Callout tone="warning">This invitation has expired or was already used. Ask your workspace owner or Elans to send a new one.</Callout></AuthCard>;
  }
  return (
    <AuthCard area="portal" title={`Join ${inv.tenant} on Elans`} subtitle={`You are invited as ${inv.role} (${inv.email}).`}>
      {error && <Callout tone="danger" className="mb-4">Use at least 12 characters for your password and enter your name.</Callout>}
      <form action={acceptInvite.bind(null, token)} className="space-y-4">
        <label className="block text-sm"><span className="mb-1 block font-semibold">Your name</span><input name="name" required className="h-12 w-full rounded-xl border border-line px-3" autoComplete="name" /></label>
        <label className="block text-sm"><span className="mb-1 block font-semibold">Choose a password (12+ characters)</span><input name="password" type="password" required minLength={12} className="h-12 w-full rounded-xl border border-line px-3" autoComplete="new-password" /></label>
        <button className="h-12 w-full rounded-full bg-brown font-semibold text-white">Activate my account</button>
      </form>
    </AuthCard>
  );
}
