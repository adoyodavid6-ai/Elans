import Link from "next/link";
import { cookies } from "next/headers";
import { portal } from "@/lib/portal";
import { updateProfile } from "@/app/portal/actions";
import { Badge, PageTitle, Panel } from "@/components/app/AppShell";
import { ThemeToggle } from "@/components/app/ThemeToggle";

export default async function Settings() {
  const c = await portal();
  const theme = (await cookies()).get("elans_theme")?.value === "dark" ? "dark" : "light";
  return (
    <>
      <PageTitle title="Settings" description="Your profile, sign-in security and display preferences." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Profile">
          <form action={updateProfile} className="space-y-3">
            <div><label htmlFor="name" className="text-sm font-medium">Name</label><input id="name" name="name" defaultValue={c.user.name} disabled={c.isDemo} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-60" /></div>
            <div><p className="text-sm font-medium">Email</p><p className="text-sm text-muted">{c.user.email}</p></div>
            <div><p className="text-sm font-medium">Workspace & role</p><p className="text-sm text-muted">{c.tenantName} · <Badge tone="brand">{c.role}</Badge></p></div>
            <button disabled={c.isDemo} className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
          </form>
        </Panel>
        <Panel title="Sign-in security">
          <p className="text-sm">Two-factor authentication: {c.user.mfaEnabled ? <Badge tone="good">on</Badge> : <Badge tone="warn">off</Badge>}</p>
          <p className="mt-2 text-sm text-muted">Use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others). Owners and admins must keep it on.</p>
          {!c.user.mfaEnabled && !c.isDemo && <Link href="/portal/login/enrol" className="mt-3 inline-block rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Turn on two-factor</Link>}
          <p className="mt-4 text-xs text-muted">Sessions expire after inactivity. To reset your authenticator, raise a support ticket; Elans verifies your identity before resetting.</p>
        </Panel>
        <Panel title="Display">
          <div className="flex items-center gap-3 text-sm"><ThemeToggle current={theme} /> <span>{theme === "dark" ? "Dark" : "Light"} mode</span></div>
        </Panel>
      </div>
    </>
  );
}
