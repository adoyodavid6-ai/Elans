import type { Metadata } from "next";
import { AuthCard } from "@/components/app/AuthCard";
import { LoginForm } from "@/components/app/AuthForms";

export const metadata: Metadata = { title: "Console sign in", robots: { index: false } };

export default function OpsLogin() {
  return (
    <AuthCard area="ops" title="Sign in to the Elans console" subtitle="For Elans staff. Two-step verification is required." footer="Client? Use the client portal instead.">
      <LoginForm area="ops" />
    </AuthCard>
  );
}
