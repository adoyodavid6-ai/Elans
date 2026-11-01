import Link from "next/link";
import type { ReactNode } from "react";
import { TreeMark } from "@/components/ui/Logo";

/** Shared layout for 404 and error screens: brand, a plain message and useful ways forward. */
export function StatusPage({ code, title, children, actions }: { code: string; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-6 w-fit"><TreeMark size={48} /></div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-copper-ink">{code}</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-heading sm:text-4xl">{title}</h1>
        <div className="mt-4 text-base text-muted">{children}</div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {actions ?? (
            <>
              <Link href="/" className="inline-flex h-11 items-center rounded-full bg-brown px-5 text-sm font-semibold text-white hover:bg-brown-hover">Go to the home page</Link>
              <Link href="/solutions" className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-espresso ring-1 ring-line hover:bg-sand/40">Browse solutions</Link>
              <Link href="/contact" className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold text-copper-ink hover:underline">Contact us</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
