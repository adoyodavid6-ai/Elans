"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  answersSchema, BUDGETS, COMPANY_SIZES, contactSchema, CUSTOMER_IMPACTS, ERROR_FREQUENCIES, ERROR_IMPACTS, FREQUENCIES, FUNCTIONS,
  GROWTH_GOALS, SOFTWARE, STEP_FIELDS, TOTAL_STEPS, URGENCY,
} from "@/lib/core/assessment";
import { saveAssessmentProgress, submitAssessment } from "@/app/actions/assessment";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { Turnstile } from "@/components/forms/Turnstile";

type Answers = Record<string, unknown>;
interface IndustryOpt {
  slug: string;
  name: string;
  tasks: string[];
}

const FUNCTION_TASKS: Record<string, string[]> = {
  finance: ["Keying supplier invoices", "Month-end reconciliations", "Preparing management reports"],
  tax: ["Checking supplier invoices for eTIMS", "Preparing VAT returns", "Tracking statutory deadlines"],
  payments: ["Matching M-Pesa payments", "Sending receipts", "Confirming customer payments"],
  collections: ["Chasing unpaid invoices", "Calling customers in arrears", "Tracking promises to pay"],
  sales: ["Following up leads", "Preparing quotes", "Booking meetings"],
  marketing: ["Compiling campaign reports", "Posting on social media", "Sending broadcasts"],
  service: ["Answering WhatsApp questions", "Answering phone calls", "Order status questions"],
  bookings: ["Booking appointments", "Reminder calls", "Rescheduling no-shows"],
  hr: ["Screening CVs", "Answering staff HR questions", "Processing leave"],
  documents: ["Typing up forms and documents", "Checking documents for completeness"],
  records: ["Finding old files", "Filing and archiving"],
  procurement: ["Approving purchases", "Matching invoices to orders"],
  inventory: ["Stock counts", "Reordering stock"],
  logistics: ["Answering delivery status calls", "Collecting proof of delivery"],
  operations: ["Shift and production reports", "Maintenance requests"],
  it: ["Password resets", "IT support requests"],
  reporting: ["Building weekly KPI reports", "Pulling numbers from several systems"],
  compliance: ["Handling data-protection requests", "Collecting audit evidence"],
  admin: ["Email triage", "Meeting notes and follow-ups"],
  custom: [],
};

const STEP_TITLES = [
  "About your business",
  "Where to look",
  "Your current tools",
  "Repetitive work",
  "Volume and time",
  "Errors and rework",
  "Customer impact",
  "Growth goals",
  "Outcome and timing",
  "Where to send your report",
];

export function AssessmentWizard({ industries, initial }: { industries: IndustryOpt[]; initial: { answers: Answers; step: number; id?: string; token?: string } }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(initial.step || 1, 1), TOTAL_STEPS));
  const [answers, setAnswers] = useState<Answers>({ country: "Kenya", software: [], tasks: [], customerImpact: [], growthGoals: [], functions: [], budget: "unsure", people: 1, ...initial.answers });
  const [ids, setIds] = useState<{ id?: string; token?: string }>({ id: initial.id, token: initial.token });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ name: "", email: "", phone: "", organisation: "", role: "", consentReport: false, consentMarketing: false });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    try {
      if (ids.token) localStorage.setItem("elans_assessment", JSON.stringify(ids));
    } catch {}
  }, [ids]);

  const set = (k: string, v: unknown) => setAnswers((p) => ({ ...p, [k]: v }));
  const toggle = (k: string, v: string, max = 99) =>
    setAnswers((p) => {
      const cur = (p[k] as string[]) ?? [];
      return { ...p, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : cur.length >= max ? cur : [...cur, v] };
    });

  const industry = industries.find((i) => i.slug === answers.industry);
  const taskSuggestions = useMemo(() => {
    const fromFns = ((answers.functions as string[]) ?? []).flatMap((f) => FUNCTION_TASKS[f] ?? []);
    return [...new Set([...(industry?.tasks ?? []), ...fromFns])].slice(0, 14);
  }, [industry, answers.functions]);

  function validateStep(n: number) {
    if (n === TOTAL_STEPS) return true;
    const fields = STEP_FIELDS[n];
    const shape = Object.fromEntries(fields.map((f) => [f, answersSchema.shape[f]]));
    const r = (answersSchema.pick(shape as never) as typeof answersSchema).safeParse(answers);
    if (r.success) {
      setErrors({});
      return true;
    }
    const e: Record<string, string> = {};
    for (const i of r.error.issues) e[String(i.path[0])] = friendly(String(i.path[0]));
    setErrors(e);
    return false;
  }

  function next() {
    if (!validateStep(step)) return;
    const nextStep = step + 1;
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
    saveAssessmentProgress({ id: ids.id, token: ids.token, step: nextStep, answers }).then((r) => {
      if (r.ok && r.token) setIds({ id: r.id, token: r.token });
    });
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const c = contactSchema.safeParse(contact);
    if (!c.success) {
      const errs: Record<string, string> = {};
      for (const i of c.error.issues) errs[String(i.path[0])] = i.path[0] === "consentReport" ? "Please agree so we can prepare and send your report." : i.path[0] === "email" ? "Enter a valid email address." : "Please complete this field.";
      setErrors(errs);
      return;
    }
    const fd = new FormData(e.currentTarget);
    setSubmitError(null);
    start(async () => {
      const r = await submitAssessment({ id: ids.id, token: ids.token, answers, contact, turnstile: (fd.get("cf-turnstile-response") as string) ?? undefined, honeypot: (fd.get("company_website") as string) ?? "" });
      if (r.ok) {
        try {
          localStorage.removeItem("elans_assessment");
        } catch {}
        router.push(r.reportUrl);
      } else {
        setSubmitError(r.message);
        if (r.errors) setErrors(r.errors);
      }
    });
  }

  const resumeUrl = ids.token && typeof window !== "undefined" ? `${window.location.origin}/assessment/resume/${ids.token}` : null;
  const pct = Math.round(((step - 1) / TOTAL_STEPS) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold text-heading">
            Step {step} of {TOTAL_STEPS}
          </p>
          <p className="text-muted">{pct}% complete</p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Assessment progress">
          <div className="h-full rounded-full bg-brown transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>
      </div>

      <div className="rounded-[2rem] border border-line bg-white p-6 shadow-[var(--shadow-soft)] sm:p-10">
        <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-bold outline-none sm:text-3xl">
          {STEP_TITLES[step - 1]}
        </h2>

        {step < TOTAL_STEPS ? (
          <form
            className="mt-6 space-y-7"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
            noValidate
          >
            {step === 1 && (
              <>
                <Q label="Which industry are you in?" error={errors.industry} htmlFor="industry">
                  <select id="industry" value={(answers.industry as string) ?? ""} onChange={(e) => set("industry", e.target.value)} className={inputCls}>
                    <option value="">Select…</option>
                    {industries.map((i) => (
                      <option key={i.slug} value={i.slug}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </Q>
                <Q label="How many people work in your organisation?" error={errors.companySize}>
                  <Choices options={COMPANY_SIZES} value={answers.companySize as string} onPick={(v) => set("companySize", v)} name="companySize" />
                </Q>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Q label="Country" htmlFor="country" error={errors.country}>
                    <input id="country" value={(answers.country as string) ?? ""} onChange={(e) => set("country", e.target.value)} className={inputCls} />
                  </Q>
                  <Q label="County / city" htmlFor="county" optional>
                    <input id="county" value={(answers.county as string) ?? ""} onChange={(e) => set("county", e.target.value)} className={inputCls} placeholder="e.g. Nairobi" />
                  </Q>
                </div>
              </>
            )}
            {step === 2 && (
              <Q label="Which departments or functions should we look at? Choose up to 8." error={errors.functions}>
                <Chips options={FUNCTIONS} values={answers.functions as string[]} onToggle={(v) => toggle("functions", v, 8)} />
              </Q>
            )}
            {step === 3 && (
              <>
                <Q label="Which tools do you use today? Choose all that apply." optional>
                  <Chips options={SOFTWARE} values={answers.software as string[]} onToggle={(v) => toggle("software", v)} />
                </Q>
                <Q label="Anything else?" htmlFor="softwareOther" optional>
                  <input id="softwareOther" value={(answers.softwareOther as string) ?? ""} onChange={(e) => set("softwareOther", e.target.value)} className={inputCls} placeholder="e.g. a custom system, Tally, Kobo…" />
                </Q>
              </>
            )}
            {step === 4 && (
              <>
                <Q label="Which tasks are the most repetitive? Pick up to 6." optional>
                  {taskSuggestions.length ? (
                    <Chips options={taskSuggestions.map((t) => ({ key: t, label: t }))} values={answers.tasks as string[]} onToggle={(v) => toggle("tasks", v, 6)} />
                  ) : (
                    <p className="text-sm text-muted">Describe them below.</p>
                  )}
                </Q>
                <Q label="Describe the work in your own words" htmlFor="tasksOther" optional hint="What happens, who does it and where it goes wrong. The more specific, the better the report.">
                  <textarea id="tasksOther" value={(answers.tasksOther as string) ?? ""} onChange={(e) => set("tasksOther", e.target.value)} className={cx(inputCls, "min-h-28 py-3")} maxLength={600} />
                </Q>
              </>
            )}
            {step === 5 && (
              <>
                <Q label="How often does the main task happen?" error={errors.frequency}>
                  <Choices options={FREQUENCIES} value={answers.frequency as string} onPick={(v) => set("frequency", v)} name="frequency" />
                </Q>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Q label="Times per month" htmlFor="volumePerMonth" error={errors.volumePerMonth} hint="A rough figure is fine">
                    <input id="volumePerMonth" type="number" inputMode="numeric" min={0} value={(answers.volumePerMonth as number) ?? ""} onChange={(e) => set("volumePerMonth", e.target.value === "" ? undefined : Number(e.target.value))} className={inputCls} />
                  </Q>
                  <Q label="Minutes each time" htmlFor="minutesPerTask" error={errors.minutesPerTask}>
                    <input id="minutesPerTask" type="number" inputMode="numeric" min={0} value={(answers.minutesPerTask as number) ?? ""} onChange={(e) => set("minutesPerTask", e.target.value === "" ? undefined : Number(e.target.value))} className={inputCls} />
                  </Q>
                  <Q label="People involved" htmlFor="people" error={errors.people}>
                    <input id="people" type="number" inputMode="numeric" min={1} value={(answers.people as number) ?? ""} onChange={(e) => set("people", e.target.value === "" ? undefined : Number(e.target.value))} className={inputCls} />
                  </Q>
                </div>
              </>
            )}
            {step === 6 && (
              <>
                <Q label="How often do mistakes or rework happen?" error={errors.errorFrequency}>
                  <Choices options={ERROR_FREQUENCIES} value={answers.errorFrequency as string} onPick={(v) => set("errorFrequency", v)} name="errorFrequency" />
                </Q>
                <Q label="When they happen, how serious is the impact?" error={errors.errorImpact}>
                  <Choices options={ERROR_IMPACTS} value={answers.errorImpact as string} onPick={(v) => set("errorImpact", v)} name="errorImpact" />
                </Q>
                <Q label="Example of a recent mistake" htmlFor="errorNotes" optional>
                  <textarea id="errorNotes" value={(answers.errorNotes as string) ?? ""} onChange={(e) => set("errorNotes", e.target.value)} className={cx(inputCls, "min-h-24 py-3")} maxLength={600} />
                </Q>
              </>
            )}
            {step === 7 && (
              <>
                <Q label="How are your customers affected today?" optional>
                  <Chips options={CUSTOMER_IMPACTS} values={answers.customerImpact as string[]} onToggle={(v) => toggle("customerImpact", v)} />
                </Q>
                <Q label="Anything else about customer experience?" htmlFor="customerNotes" optional>
                  <textarea id="customerNotes" value={(answers.customerNotes as string) ?? ""} onChange={(e) => set("customerNotes", e.target.value)} className={cx(inputCls, "min-h-24 py-3")} maxLength={600} />
                </Q>
              </>
            )}
            {step === 8 && (
              <Q label="Which growth goals matter to you?" optional>
                <Chips options={GROWTH_GOALS} values={answers.growthGoals as string[]} onToggle={(v) => toggle("growthGoals", v)} />
              </Q>
            )}
            {step === 9 && (
              <>
                <Q label="What would a great outcome look like in six months?" htmlFor="outcome" optional>
                  <textarea id="outcome" value={(answers.outcome as string) ?? ""} onChange={(e) => set("outcome", e.target.value)} className={cx(inputCls, "min-h-24 py-3")} maxLength={600} placeholder="e.g. Month-end done in two days, every enquiry answered within five minutes" />
                </Q>
                <Q label="How urgent is this?" error={errors.urgency}>
                  <Choices options={URGENCY} value={answers.urgency as string} onPick={(v) => set("urgency", v)} name="urgency" />
                </Q>
                <Q label="Budget band for a first project" optional hint="Optional. It helps us suggest the right package.">
                  <Choices options={BUDGETS} value={answers.budget as string} onPick={(v) => set("budget", v)} name="budget" />
                </Q>
              </>
            )}

            {Object.keys(errors).length > 0 && (
              <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">
                Please answer the highlighted questions to continue.
              </p>
            )}
            <Nav step={step} onBack={back} />
          </form>
        ) : (
          <form onSubmit={submit} className="relative mt-6 space-y-5" noValidate>
            <p className="text-muted">We ask for contact details only now, so your report can be prepared and sent to you.</p>
            <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
              <label htmlFor="company_website">Leave empty</label>
              <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {(
                [
                  ["name", "Your name", "name", "text"],
                  ["email", "Work email", "email", "email"],
                  ["organisation", "Organisation", "organization", "text"],
                  ["role", "Your role", "organization-title", "text"],
                  ["phone", "Phone or WhatsApp", "tel", "tel"],
                ] as const
              ).map(([k, l, ac, type]) => (
                <Q key={k} label={l} htmlFor={`c-${k}`} error={errors[k]} optional={k === "role" || k === "phone"}>
                  <input id={`c-${k}`} type={type} autoComplete={ac} value={contact[k]} onChange={(e) => setContact((c) => ({ ...c, [k]: e.target.value }))} className={inputCls} aria-invalid={Boolean(errors[k])} />
                </Q>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl bg-surface-2/70 p-4 text-sm">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={contact.consentReport} onChange={(e) => setContact((c) => ({ ...c, consentReport: e.target.checked }))} className="mt-0.5 h-5 w-5 accent-brown" />
                <span>
                  I agree that Elans may use my answers and contact details to prepare and send my report and to follow up about it, as described in the{" "}
                  <a href="/legal/privacy" target="_blank" className="underline">
                    privacy notice
                  </a>
                  . <span className="text-danger">*</span>
                </span>
              </label>
              {errors.consentReport && <p className="ml-8 text-xs font-medium text-danger">{errors.consentReport}</p>}
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={contact.consentMarketing} onChange={(e) => setContact((c) => ({ ...c, consentMarketing: e.target.checked }))} className="mt-0.5 h-5 w-5 accent-brown" />
                <span>Also send me occasional insights and offers (optional; unsubscribe any time).</span>
              </label>
            </div>
            <p className="text-xs text-muted">Scores are indicative suggestions, not decisions about you. A person reviews any proposal before it is sent.</p>
            <Turnstile />
            {submitError && (
              <p role="alert" className="rounded-xl bg-danger-bg p-3 text-sm text-danger">
                {submitError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
              <button type="button" onClick={back} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 font-semibold text-espresso hover:bg-sand/60">
                <Icon name="arrow-left" size={18} /> Back
              </button>
              <button type="submit" disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brown px-6 font-semibold text-white hover:bg-brown-hover disabled:opacity-60">
                {pending ? "Preparing your report…" : "See my report"} {!pending && <Icon name="arrow-right" size={18} />}
              </button>
            </div>
          </form>
        )}
      </div>

      {resumeUrl && step < TOTAL_STEPS && (
        <div className="mt-4 flex flex-col items-start gap-2 rounded-2xl border border-line bg-white/70 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted">
            <Icon name="clock" size={15} className="mr-1 inline" />
            Progress saved. Continue later from this private link.
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(resumeUrl).then(() => setCopied(true));
            }}
            className="font-semibold text-copper-ink hover:underline"
          >
            {copied ? "Link copied" : "Copy resume link"}
          </button>
        </div>
      )}
    </div>
  );
}

const inputCls = "block h-12 w-full rounded-xl border border-line bg-white px-3.5 text-[0.95rem] focus:border-brown focus:outline-none focus:ring-2 focus:ring-copper/40";

function friendly(field: string) {
  const m: Record<string, string> = {
    industry: "Choose your industry.",
    companySize: "Choose a company size.",
    functions: "Choose at least one function.",
    frequency: "Choose how often it happens.",
    volumePerMonth: "Enter a number (a rough estimate is fine).",
    minutesPerTask: "Enter the minutes per task.",
    people: "Enter at least 1.",
    errorFrequency: "Choose an option.",
    errorImpact: "Choose an option.",
    urgency: "Choose an option.",
    country: "Enter your country.",
  };
  return m[field] ?? "Please check this answer.";
}

function Q({ label, children, error, htmlFor, optional, hint }: { label: string; children: React.ReactNode; error?: string; htmlFor?: string; optional?: boolean; hint?: string }) {
  const Tag = htmlFor ? "label" : "p";
  return (
    <div role={htmlFor ? undefined : "group"} aria-label={htmlFor ? undefined : label}>
      <Tag {...(htmlFor ? { htmlFor } : {})} className="mb-2 block font-semibold text-heading">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </Tag>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-danger">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </div>
  );
}

function Choices({ options, value, onPick, name }: { options: readonly { key: string; label: string }[]; value?: string; onPick: (v: string) => void; name: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => (
        <label key={o.key} className={cx("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[0.95rem] transition", value === o.key ? "border-brown bg-brown/5 ring-1 ring-brown" : "border-line hover:border-sand-strong")}>
          <input type="radio" name={name} value={o.key} checked={value === o.key} onChange={() => onPick(o.key)} className="h-4 w-4 accent-brown" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function Chips({ options, values = [], onToggle }: { options: readonly { key: string; label: string }[]; values?: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = values.includes(o.key);
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onToggle(o.key)} className={cx("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition", on ? "border-brown bg-brown text-white" : "border-line bg-white text-espresso hover:border-sand-strong")}>
            {on && <Icon name="check" size={14} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Nav({ step, onBack }: { step: number; onBack: () => void }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-between">
      {step > 1 ? (
        <button type="button" onClick={onBack} className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 font-semibold text-espresso hover:bg-sand/60">
          <Icon name="arrow-left" size={18} /> Back
        </button>
      ) : (
        <span />
      )}
      <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brown px-6 font-semibold text-white hover:bg-brown-hover">
        Continue <Icon name="arrow-right" size={18} />
      </button>
    </div>
  );
}
