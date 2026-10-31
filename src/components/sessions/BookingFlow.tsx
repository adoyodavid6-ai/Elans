"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createBooking } from "@/app/actions/booking";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { Turnstile } from "@/components/forms/Turnstile";

interface TypeOpt {
  key: "discovery" | "strategy" | "support";
  name: string;
  minutes: number;
  summary: string;
  price: string;
  free: boolean;
  slots: string[];
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Nairobi" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
const input = "h-11 w-full rounded-xl border border-line bg-white px-3 text-[0.95rem] focus:border-brown focus:outline-none focus:ring-2 focus:ring-copper/40";

export function BookingFlow({ types, initialType, mpesaMode }: { types: TypeOpt[]; initialType: string; mpesaMode: string }) {
  const router = useRouter();
  const [typeKey, setTypeKey] = useState(types.find((t) => t.key === initialType)?.key ?? types[0].key);
  const type = types.find((t) => t.key === typeKey)!;
  const days = useMemo(() => [...new Set(type.slots.map(fmtDay))], [type]);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", email: "", phone: "", organisation: "", topic: "", payWith: "mpesa", consent: false, marketing: false });
  const [err, setErr] = useState<{ message: string; field?: string } | null>(null);
  const [pending, start] = useTransition();
  const activeDay = day ?? days[0];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-heading">1. Choose a session</p>
        {types.map((t) => (
          <button key={t.key} type="button" aria-pressed={t.key === typeKey} onClick={() => { setTypeKey(t.key); setSlot(null); setDay(null); }} className={cx("w-full rounded-2xl border p-5 text-left transition", t.key === typeKey ? "border-brown bg-white ring-1 ring-brown" : "border-line bg-white hover:border-sand-strong")}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-heading">{t.name}</p>
              <p className="shrink-0 font-semibold text-heading">{t.free ? "Free" : t.price}</p>
            </div>
            <p className="mt-1 text-sm text-muted">{t.minutes} minutes · {t.summary}</p>
          </button>
        ))}
        <p className="pt-2 text-xs text-muted">Times are shown in East Africa Time (EAT). Sessions run by video call; a link is sent after booking.</p>
      </div>

      <form
        className="relative space-y-6 rounded-[var(--radius-card)] border border-line bg-white p-5 sm:p-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (!slot) return setErr({ message: "Choose a time.", field: "slot" });
          const fd = new FormData(e.currentTarget);
          setErr(null);
          start(async () => {
            const r = await createBooking({ type: typeKey, slot, name: f.name, email: f.email, phone: f.phone, organisation: f.organisation, topic: f.topic, payWith: f.payWith, consentContact: f.consent, consentMarketing: f.marketing, turnstile: fd.get("cf-turnstile-response") ?? undefined, honeypot: fd.get("company_website") ?? "" });
            if (r.ok) router.push(`/sessions/confirmation/${r.bookingId}`);
            else setErr({ message: r.message, field: r.field });
          });
        }}
      >
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden"><input name="company_website" tabIndex={-1} autoComplete="off" /></div>
        <fieldset>
          <legend className="text-sm font-semibold text-heading">2. Pick a time</legend>
          {type.slots.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No times available in the next two weeks. Please use the contact form.</p>
          ) : (
            <>
              {/* All available days are visible at once (wrapping grid), so none are hidden off-screen. */}
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 xl:grid-cols-7" role="group" aria-label="Available days">
                {days.map((d) => {
                  const [weekday, ...date] = d.split(" ");
                  return (
                    <button key={d} type="button" onClick={() => { setDay(d); setSlot(null); }} aria-pressed={d === activeDay} aria-label={d} className={cx("flex flex-col items-center rounded-xl px-1 py-2 text-sm leading-tight", d === activeDay ? "surface-brand text-ivory" : "bg-surface-2 text-espresso hover:bg-sand")}>
                      <span className="text-[0.7rem] font-medium uppercase tracking-wide opacity-80">{weekday}</span>
                      <span className="font-semibold">{date.join(" ")}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {type.slots.filter((s) => fmtDay(s) === activeDay).map((s) => (
                  <label key={s} className={cx("cursor-pointer rounded-xl border px-2 py-2.5 text-center text-sm font-semibold", slot === s ? "border-brown bg-brown text-white" : "border-line hover:border-sand-strong")}>
                    <input type="radio" name="slot" value={s} className="sr-only" checked={slot === s} onChange={() => setSlot(s)} />
                    {fmtTime(s)}
                  </label>
                ))}
              </div>
            </>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-heading">3. Your details</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block font-medium">Name *</span><input required autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Work email *</span><input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Organisation *</span><input required autoComplete="organization" value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} className={input} /></label>
            <label className="text-sm"><span className="mb-1 block font-medium">Phone / M-Pesa number{!type.free && f.payWith === "mpesa" ? " *" : ""}</span><input type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={cx(input, err?.field === "phone" && "border-danger")} placeholder="07XX XXX XXX" /></label>
          </div>
          <label className="block text-sm"><span className="mb-1 block font-medium">What would you like to cover? (optional)</span><textarea value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} className={cx(input, "h-auto min-h-24 py-2")} /></label>
        </fieldset>

        {!type.free && (
          <fieldset>
            <legend className="text-sm font-semibold text-heading">4. Payment · {type.price}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ["mpesa", "M-Pesa (STK push to your phone)"],
                ["invoice", "Send my organisation an invoice"],
              ].map(([v, l]) => (
                <label key={v} className={cx("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm", f.payWith === v ? "border-brown ring-1 ring-brown" : "border-line")}>
                  <input type="radio" name="payWith" value={v} checked={f.payWith === v} onChange={() => setF({ ...f, payWith: v })} className="accent-brown" /> {l}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Card payments will be added once our card gateway is live.{mpesaMode === "mock" && " Payments are currently in TEST MODE: no money will be taken."}</p>
          </fieldset>
        )}

        <div className="space-y-2 text-sm">
          <label className="flex items-start gap-2"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brown" /><span>Elans may use these details to arrange this session (see the <a href="/legal/privacy" className="underline" target="_blank">privacy notice</a>). *</span></label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} className="mt-0.5 h-5 w-5 accent-brown" /><span>Send me occasional insights (optional).</span></label>
        </div>
        <Turnstile />
        {err && <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">{err.message}</p>}
        <button disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brown px-6 font-semibold text-white disabled:opacity-60 sm:w-auto">
          {pending ? "Booking…" : type.free ? "Confirm booking" : f.payWith === "mpesa" ? `Book and pay ${type.price}` : "Book and request invoice"}
          {!pending && <Icon name="arrow-right" size={18} />}
        </button>
      </form>
    </div>
  );
}
