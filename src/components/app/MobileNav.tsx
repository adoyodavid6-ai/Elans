"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { NavLinks, type NavItem } from "./NavLinks";

export function MobileNav({ nav, area }: { nav: { section?: string; items: NavItem[] }[]; area: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2">
        <Icon name="menu" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-label={`${area} navigation`}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-72 overflow-y-auto bg-surface p-4">
            <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="mb-3 grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2">
              <Icon name="x" />
            </button>
            <NavLinks nav={nav} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
