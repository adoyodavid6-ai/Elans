"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import type { SearchHit } from "@/app/ops/search-actions";

export interface PaletteAction {
  label: string;
  href: string;
  group: string;
  keywords?: string;
}

/**
 * ⌘K / Ctrl+K: jump to any page or action, or find a lead, opportunity, quote, client, session or content item.
 * Keyboard: ↑ ↓ to move, Enter to open, Esc to close.
 */
export function CommandPalette({ actions, search }: { actions: PaletteAction[]; search: (q: string) => Promise<SearchHit[]> }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !open && !(e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("elans:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("elans:open-search", onOpen);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => start(async () => setHits(await search(q))), 180);
    return () => clearTimeout(t);
  }, [q, search]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const acts = actions.filter((a) => !term || `${a.label} ${a.keywords ?? ""} ${a.group}`.toLowerCase().includes(term)).slice(0, term ? 8 : 12);
    return [...hits, ...acts.map((a) => ({ group: a.group, label: a.label, href: a.href }) as SearchHit)];
  }, [actions, hits, q]);

  useEffect(() => setActive(0), [results.length]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-graphite/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Search the console" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-muted" />
          <input
            ref={input}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === "Enter" && results[active]) go(results[active].href);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${active}` : undefined}
            placeholder="Search leads, clients, quotes, content… or type a page name"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          {pending && <span className="text-xs text-muted">Searching…</span>}
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[0.7rem] text-muted sm:inline">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{q.trim().length < 2 ? "Type at least two letters to search records." : "No matches. Try a company name, email or quote number."}</li>}
          {results.map((r, i) => {
            const header = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <li key={`${r.group}-${r.href}-${i}`}>
                {header && <p className="px-3 pb-1 pt-3 text-[0.68rem] font-semibold uppercase tracking-wider text-muted">{header}</p>}
                <button
                  id={`palette-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.href)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${i === active ? "bg-sand text-heading" : "text-text"}`}
                >
                  <span className="truncate font-medium">{r.label}</span>
                  {r.hint && <span className="shrink-0 truncate text-xs text-muted">{r.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[0.72rem] text-muted">↑ ↓ to move · Enter to open · Ctrl/⌘ K or / to open anywhere</p>
      </div>
    </div>
  );
}

export function SearchButton({ compact = false }: { compact?: boolean }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("elans:open-search"))} aria-label="Search the console (Ctrl+K)" className={compact ? "grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-heading" : "flex w-full items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted hover:border-sand-strong hover:text-heading"}>
      <Icon name="search" size={16} />
      {!compact && <><span className="flex-1 text-left">Search…</span><kbd className="rounded border border-line bg-surface px-1.5 text-[0.68rem]">Ctrl K</kbd></>}
    </button>
  );
}
