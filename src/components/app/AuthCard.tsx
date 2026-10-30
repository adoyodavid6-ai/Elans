import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/ui/Logo";

export function AuthCard({ title, subtitle, children, footer, area }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; area: "ops" | "portal" }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-ivory px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/"><Wordmark /></Link>
          <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-espresso">{area === "ops" ? "Elans console" : "Client portal"}</span>
        </div>
        <div className="rounded-[2rem] border border-line bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle && <div className="mt-2 text-sm text-muted">{subtitle}</div>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
      </div>
    </main>
  );
}
