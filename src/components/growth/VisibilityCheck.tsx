"use client";

import { useState, useTransition } from "react";
import { runVisibilityCheck, type VisibilityResponse } from "@/app/actions/ai-visibility";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { Turnstile } from "@/components/forms/Turnstile";

const input = "h-11 w-full rounded-xl border border-line bg-white px-3 text-[0.95rem] focus:border-brown focus:outline-none focus:ring-2 focus:ring-copper/40";

export function VisibilityCheck() {
  const [f, setF] = useState({ brand: "", website: "", category: "", location: "Nairobi", q1: "", q2: "", q3: "", name: "", email: "", consent: false, marketing: false });
  const [res, setRes] = useState<VisibilityResponse | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const suggest = () => {
    if (!f.category) return;
    setF((p) => ({ ...p, q1: p.q1 || `What are the best ${p.category} in ${p.location}?`, q2: p.q2 || `Which ${p.category} in ${p.location} would you recommend and why?`, q3: p.q3 || `Is ${p.brand || "[your brand]"} a good ${p.category.replace(/s$/, "")} in ${p.location}?` }));
  };

  if (res?.ok && res.mode === "live") {
    const hits = res.results.filter((r) => r.mentioned).length;
    return (
      <div className="space-y-6" aria-live="polite">
        <div className="rounded-[var(--radius-card)] bg-espresso p-6 text-sand">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-copper">Sample snapshot · not a full audit</p>
          <p className="mt-2 font-display text-3xl font-semibold text-ivory">
            Mentioned in {hits} of {res.results.length} answers
          </p>
          <p className="mt-2 text-sm text-sand/80">
            One AI assistant ({res.model} with web search, via API) answered your questions on {new Date(res.checkedAt).toLocaleString("en-GB")}. Consumer apps such as ChatGPT, Gemini or Perplexity may answer differently, and answers vary from run to run.
          </p>
        </div>
        {res.results.map((r) => (
          <div key={r.question} className="rounded-[var(--radius-card)] border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="font-semibold text-heading">“{r.question}”</p>
              <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-semibold", r.mentioned ? "bg-success-bg text-success" : "bg-danger-bg text-danger")}>{r.mentioned ? "You were mentioned" : "Not mentioned"}</span>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm text-muted">{r.excerpt}{r.excerpt.length >= 700 ? "…" : ""}</p>
            {r.sources.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sources it looked at {r.ownSiteCited && <span className="ml-2 text-success">· your site was cited</span>}</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {r.sources.map((s) => (
                    <li key={s.url} className="truncate">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-copper-ink underline">{s.title || s.url}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        <a href="/growth/ai-visibility-geo" className="inline-flex h-11 items-center gap-2 rounded-full bg-brown px-5 font-semibold text-white">Improve your AI visibility <Icon name="arrow-right" size={16} /></a>
      </div>
    );
  }
  if (res?.ok && res.mode === "manual") {
    return (
      <div role="status" className="rounded-[var(--radius-card)] border border-line bg-white p-6">
        <Icon name="clock" className="text-brown" />
        <p className="mt-2 font-semibold text-heading">Request received</p>
        <p className="mt-1 text-sm text-muted">{res.message}</p>
        <a href="/roi/ai-visibility-opportunity" className="mt-4 inline-block text-sm font-semibold text-copper-ink underline">Meanwhile: take the 1-minute readiness self-assessment →</a>
      </div>
    );
  }

  return (
    <form
      className="relative space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setRes(await runVisibilityCheck({ brand: f.brand, website: f.website, category: f.category, location: f.location, questions: [f.q1, f.q2, f.q3].filter((q) => q.trim().length >= 8), name: f.name, email: f.email, consentContact: f.consent, consentMarketing: f.marketing, turnstile: fd.get("cf-turnstile-response") ?? undefined, honeypot: fd.get("company_website") ?? "" }));
        });
      }}
    >
      <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden"><input name="company_website" tabIndex={-1} autoComplete="off" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-semibold">Business or brand name *</span><input required value={f.brand} onChange={(e) => set("brand", e.target.value)} className={input} /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Website (optional)</span><input value={f.website} onChange={(e) => set("website", e.target.value)} className={input} placeholder="example.co.ke" /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">What you are (plural) *</span><input required value={f.category} onChange={(e) => set("category", e.target.value)} onBlur={suggest} className={input} placeholder="e.g. dental clinics, hardware stores" /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Location *</span><input required value={f.location} onChange={(e) => set("location", e.target.value)} onBlur={suggest} className={input} /></label>
      </div>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Questions your customers might ask an AI assistant (up to 3)</legend>
        {(["q1", "q2", "q3"] as const).map((k, i) => (
          <input key={k} aria-label={`Question ${i + 1}`} value={f[k]} onChange={(e) => set(k, e.target.value)} className={input} placeholder={i === 0 ? "What are the best … in …?" : ""} />
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm"><span className="mb-1 block font-semibold">Your name *</span><input required value={f.name} onChange={(e) => set("name", e.target.value)} className={input} autoComplete="name" /></label>
        <label className="text-sm"><span className="mb-1 block font-semibold">Email *</span><input required type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={input} autoComplete="email" /></label>
      </div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} required className="mt-0.5 h-5 w-5 accent-[#6B4936]" /><span>Elans may use these details to run the check, send me the results and follow up (see the <a href="/legal/privacy" className="underline">privacy notice</a>). *</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={f.marketing} onChange={(e) => set("marketing", e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#6B4936]" /><span>Send me occasional insights (optional).</span></label>
      <Turnstile />
      {res && !res.ok && <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">{res.message}</p>}
      <button disabled={pending} className="inline-flex h-12 items-center gap-2 rounded-full bg-brown px-6 font-semibold text-white disabled:opacity-60">
        {pending ? "Asking the AI assistant… (up to a minute)" : "Run my AI Visibility Check"}
      </button>
    </form>
  );
}
