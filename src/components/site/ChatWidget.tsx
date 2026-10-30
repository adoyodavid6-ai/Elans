"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { TreeMark } from "@/components/ui/Logo";
import { cx } from "@/components/ui/primitives";

type Msg = { author: "customer" | "agent" | "human" | "system"; body: string; links?: { label: string; href: string }[]; at?: string };
const STORE = "elans_chat";

function load(): { visitor: string; conversationId?: string; messages: Msg[] } {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch {}
  const visitor = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  return { visitor, messages: [] };
}

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>));
}

export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ visitor: string; conversationId?: string; messages: Msg[] } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState(load());
    const onHash = () => {
      if (location.hash === "#chat") setOpen(true);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (state) {
      try {
        localStorage.setItem(STORE, JSON.stringify({ ...state, messages: state.messages.slice(-40) }));
      } catch {}
    }
  }, [state]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [state?.messages.length, open]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // While a person is handling the conversation, poll for their replies.
  useEffect(() => {
    if (!open || !handedOff || !state?.conversationId) return;
    const t = setInterval(async () => {
      const last = state.messages.filter((m) => m.at).at(-1)?.at ?? new Date(Date.now() - 60_000).toISOString();
      const r = await fetch(`/api/chat?conversationId=${state.conversationId}&visitor=${state.visitor}&after=${encodeURIComponent(last)}`).then((x) => x.json()).catch(() => null);
      if (r?.messages?.length) setState((s) => (s ? { ...s, messages: [...s.messages, ...r.messages.filter((m: Msg) => m.author === "human")] } : s));
    }, 5000);
    return () => clearInterval(t);
  }, [open, handedOff, state]);

  if (pathname.startsWith("/assessment/report")) return null;

  async function send(message: string) {
    if (!state || !message.trim() || busy) return;
    setError(null);
    setBusy(true);
    setText("");
    setState({ ...state, messages: [...state.messages, { author: "customer", body: message, at: new Date().toISOString() }] });
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: state.conversationId, visitor: state.visitor, message, page: pathname }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Chat unavailable");
      setHandedOff(Boolean(data.handedOff));
      setState((s) => (s ? { ...s, conversationId: data.conversationId, messages: [...s.messages, ...data.replies.map((r: Msg) => ({ ...r, at: new Date().toISOString() }))] } : s));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const quick = ["What does Elans do?", "How much does it cost?", "eTIMS compliance", "Talk to a person"];

  return (
    <div className="no-print">
      {!open && (
        <button type="button" onClick={() => setOpen(true)} aria-label="Open chat with Elans" className="fixed bottom-20 right-4 z-40 flex h-14 items-center gap-2 rounded-full surface-brand pl-3 pr-5 text-sm font-semibold text-ivory shadow-[var(--shadow-lift)] hover:bg-brown md:bottom-6 md:right-6">
          <TreeMark size={32} onBrand /> Chat with us
        </button>
      )}
      {open && (
        <section role="dialog" aria-label="Chat with Elans" className="fixed inset-x-2 bottom-2 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[var(--shadow-lift)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[24rem]">
          <header className="flex items-center gap-3 surface-brand px-4 py-3 text-ivory">
            <TreeMark size={32} onBrand />
            <div className="flex-1">
              <p className="font-semibold">Elans assistant</p>
              <p className="text-xs text-sand/80">{handedOff ? "A team member will reply here" : "AI assistant · a person can take over"}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
              <Icon name="x" />
            </button>
          </header>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-ivory p-4" aria-live="polite">
            {state?.messages.length === 0 && (
              <div className="rounded-2xl bg-white p-3 text-sm ring-1 ring-line">
                Hello! Ask me about our automation and growth solutions, prices or booking a call. Unaweza pia kuandika kwa Kiswahili.
              </div>
            )}
            {state?.messages.map((m, i) => (
              <div key={i} className={cx("flex", m.author === "customer" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", m.author === "customer" ? "bg-brown text-white" : m.author === "human" ? "bg-success-bg text-text ring-1 ring-success/20" : "bg-white text-text ring-1 ring-line")}>
                  {m.author === "human" && <p className="mb-1 text-xs font-semibold text-success">Elans team</p>}
                  <p className="whitespace-pre-line">{renderInline(m.body)}</p>
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.links.map((l) =>
                        l.href === "#handover" ? (
                          <button key={l.href} type="button" onClick={() => send("Talk to a person")} className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-espresso">
                            {l.label}
                          </button>
                        ) : (
                          <a key={l.href} href={l.href} className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-espresso hover:bg-sand-strong">
                            {l.label}
                          </a>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-muted">Typing…</p>}
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          </div>
          {state && state.messages.length < 2 && (
            <div className="flex gap-1.5 overflow-x-auto border-t border-line bg-white px-3 py-2">
              {quick.map((q) => (
                <button key={q} type="button" onClick={() => send(q)} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-espresso hover:bg-sand/50">
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-center gap-2 border-t border-line bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <label htmlFor="chat-input" className="sr-only">
              Your message
            </label>
            <input id="chat-input" ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type your message…" className="h-11 flex-1 rounded-full border border-line bg-ivory px-4 text-sm focus:border-brown focus:outline-none" autoComplete="off" />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="grid h-11 w-11 place-items-center rounded-full bg-brown text-white disabled:opacity-50">
              <Icon name="send" size={18} />
            </button>
          </form>
          <p className="bg-white px-4 pb-2 text-[0.65rem] text-muted">Please don&apos;t share passwords, PINs or card numbers. Chats are stored to help us respond; see our <a href="/legal/privacy" className="underline">privacy notice</a>.</p>
        </section>
      )}
    </div>
  );
}
