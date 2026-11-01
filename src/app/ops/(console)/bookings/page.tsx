import Link from "next/link";
import { isSuper, requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { sendReminderNow, setBookingStatus, setMeetingLink } from "@/app/ops/actions";
import { formatMoney } from "@/lib/core/money";
import { channelReady } from "@/lib/outbox";
import { REMINDER_MINUTES } from "@/lib/reminders";
import { Badge, Kpi, PageTitle, Panel, Table } from "@/components/app/AppShell";
import { SubmitButton } from "@/components/app/Form";
import { AskSuper } from "@/components/app/AskSuper";
import { Icon } from "@/components/ui/Icon";

export const metadata = { title: "Sessions calendar" };

type Row = { id: string; type: string; starts_at: Date; ends_at: Date; status: string; topic: string | null; meeting_link: string | null; reminded_at: Date | null; name: string | null; email: string | null; organisation: string | null; pay: string | null; amount: number | null; receipt: string | null };

const TZ = "Africa/Nairobi";
const TYPE: Record<string, string> = { strategy: "Strategy Session", discovery: "Discovery Call", support: "Support session", diagnostic: "Diagnostic" };
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const hm = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const longDay = (key: string) => new Date(`${key}T12:00:00+03:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const statusTone = (s: string) => (s === "confirmed" ? "good" : s === "completed" ? "info" : s === "pending_payment" ? "warn" : "neutral") as "good" | "info" | "warn" | "neutral";
const dot: Record<string, string> = { confirmed: "bg-success", pending_payment: "bg-warning", completed: "bg-info", cancelled: "bg-muted", no_show: "bg-danger" };
const live = (s: string) => s === "confirmed" || s === "pending_payment";

function monthInfo(m?: string) {
  const today = dayKey(new Date());
  const [y, mo] = (m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7)).split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday-first grid
  const key = (d: number) => `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const shift = (n: number) => { const t = new Date(Date.UTC(y, mo - 1 + n, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`; };
  return { y, mo, days, lead, key, today, label: first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), prev: shift(-1), next: shift(1), month: `${y}-${String(mo).padStart(2, "0")}` };
}

export default async function Bookings({ searchParams }: { searchParams: Promise<{ view?: string; m?: string; d?: string }> }) {
  const sp = await searchParams;
  const u = await requireStaff();
  const sup = isSuper(u);
  const view = sp.view === "list" ? "list" : "calendar";
  const cal = monthInfo(sp.m);
  const selected = sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : cal.today.startsWith(cal.month) ? cal.today : cal.key(1);

  const { rows, stats } = await asStaff(u, async (tx) => {
    const rows = view === "list"
      ? await tx<Row[]>`select b.id, b.type, b.starts_at, b.ends_at, b.status, b.topic, b.meeting_link, b.reminded_at, c.name, c.email, c.organisation, p.status as pay, p.amount, p.provider_ref as receipt
          from bookings b left join contacts c on c.id = b.contact_id left join payments p on p.id = b.payment_id order by b.starts_at desc limit 300`
      : await tx<Row[]>`select b.id, b.type, b.starts_at, b.ends_at, b.status, b.topic, b.meeting_link, b.reminded_at, c.name, c.email, c.organisation, p.status as pay, p.amount, p.provider_ref as receipt
          from bookings b left join contacts c on c.id = b.contact_id left join payments p on p.id = b.payment_id
          where b.starts_at >= ${`${cal.key(1)}T00:00:00+03:00`}::timestamptz - interval '1 day' and b.starts_at < ${`${cal.key(cal.days)}T00:00:00+03:00`}::timestamptz + interval '2 days'
          order by b.starts_at`;
    const [stats] = await tx<{ today: number; week: number; unpaid: number; month_done: number; soon: number; next_at: Date | null; next_org: string | null; missing_links: number }[]>`
      select
        (select count(*)::int from bookings where status in ('confirmed','pending_payment') and (starts_at at time zone 'Africa/Nairobi')::date = (now() at time zone 'Africa/Nairobi')::date) as today,
        (select count(*)::int from bookings where status in ('confirmed','pending_payment') and starts_at between now() and now() + interval '7 days') as week,
        (select count(*)::int from bookings where status = 'pending_payment' and starts_at > now()) as unpaid,
        (select count(*)::int from bookings where status = 'completed' and starts_at > now() - interval '30 days') as month_done,
        (select count(*)::int from bookings where status = 'confirmed' and starts_at between now() and now() + make_interval(mins => ${REMINDER_MINUTES})) as soon,
        (select starts_at from bookings where status = 'confirmed' and starts_at > now() order by starts_at limit 1) as next_at,
        (select coalesce(c.organisation, c.name) from bookings b left join contacts c on c.id = b.contact_id where b.status = 'confirmed' and b.starts_at > now() order by b.starts_at limit 1) as next_org,
        (select count(*)::int from bookings where status = 'confirmed' and meeting_link is null and starts_at between now() and now() + interval '7 days') as missing_links`;
    return { rows, stats };
  });

  const byDay = new Map<string, Row[]>();
  for (const r of rows) { const k = dayKey(r.starts_at); byDay.set(k, [...(byDay.get(k) ?? []), r]); }
  const dayRows = byDay.get(selected) ?? [];
  const upcoming = rows.filter((r) => live(r.status) && r.starts_at.getTime() > Date.now()).slice(0, 8);
  const emailOn = channelReady("email");
  const qs = (o: Record<string, string>) => `/ops/bookings?${new URLSearchParams({ m: cal.month, ...o }).toString()}`;

  return (
    <>
      <PageTitle
        title="Sessions calendar"
        description={`Strategy Sessions and Discovery Calls booked from the website. Times in EAT. Clients and the team get a reminder ${REMINDER_MINUTES} minutes before each confirmed session.`}
        actions={
          <div className="inline-flex rounded-lg ring-1 ring-line" role="group" aria-label="View">
            <Link href={qs({ view: "calendar" })} aria-current={view === "calendar" ? "page" : undefined} className={`inline-flex h-10 items-center gap-1.5 rounded-l-lg px-3 text-sm font-semibold ${view === "calendar" ? "bg-brown text-white" : "hover:bg-surface-2"}`}><Icon name="calendar" size={16} /> Calendar</Link>
            <Link href="/ops/bookings?view=list" aria-current={view === "list" ? "page" : undefined} className={`inline-flex h-10 items-center gap-1.5 rounded-r-lg px-3 text-sm font-semibold ${view === "list" ? "bg-brown text-white" : "hover:bg-surface-2"}`}><Icon name="layers" size={16} /> List</Link>
          </div>
        }
      />


      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Today" value={stats.today} hint={stats.next_at ? `next: ${stats.next_org ?? "client"}, ${stats.next_at.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })}` : "nothing upcoming"} />
        <Kpi label="Next 7 days" value={stats.week} hint={stats.missing_links ? `${stats.missing_links} without a meeting link` : "all have meeting links"} tone={stats.missing_links ? "warn" : undefined} />
        <Kpi label="Awaiting payment" value={stats.unpaid} hint="upcoming, not yet confirmed" tone={stats.unpaid ? "warn" : undefined} />
        <Kpi label="Reminders" value={`${REMINDER_MINUTES} min`} hint={emailOn ? "email delivery on" : "email delivery not set up: reminders are logged only"} tone={emailOn ? "good" : "warn"} />
      </div>

      {view === "list" ? (
        <Panel>
          <Table head={["When", "Type", "Client", "Payment", "Status", "Reminder", "Actions"]} empty="No sessions booked yet.">
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap px-3 py-2.5">{b.starts_at.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })}</td>
                <td className="px-3 py-2.5">{TYPE[b.type] ?? b.type}</td>
                <td className="px-3 py-2.5"><p className="font-medium">{b.organisation}</p><p className="text-xs text-muted">{b.name} · {b.email}</p></td>
                <td className="px-3 py-2.5">{b.pay ? <><Badge tone={b.pay === "succeeded" ? "good" : b.pay === "failed" ? "bad" : "warn"}>{b.pay}</Badge><p className="text-xs text-muted">{b.amount ? formatMoney(Number(b.amount)) : ""} {b.receipt}</p></> : <span className="text-xs text-muted">free / invoice</span>}</td>
                <td className="px-3 py-2.5"><Badge tone={statusTone(b.status)}>{b.status.replace("_", " ")}</Badge></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">{b.reminded_at ? `sent ${hm(b.reminded_at)}` : b.status === "confirmed" && b.starts_at.getTime() > Date.now() ? `due ${hm(new Date(b.starts_at.getTime() - REMINDER_MINUTES * 60000))}` : "—"}</td>
                <td className="px-3 py-2.5"><Link href={`/ops/bookings?m=${dayKey(b.starts_at).slice(0, 7)}&d=${dayKey(b.starts_at)}`} className="text-sm text-copper-ink hover:underline">Open</Link></td>
              </tr>
            ))}
          </Table>
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Panel
            title={<span className="flex items-center gap-2">{cal.label}</span>}
            actions={
              <span className="flex items-center gap-1">
                <Link href={qs({ m: cal.prev })} aria-label="Previous month" className="inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-line hover:bg-surface-2">‹</Link>
                <Link href={`/ops/bookings?d=${cal.today}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold ring-1 ring-line hover:bg-surface-2">Today</Link>
                <Link href={qs({ m: cal.next })} aria-label="Next month" className="inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-line hover:bg-surface-2">›</Link>
              </span>
            }
          >
            {/* Month grid (tablet and up) */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 gap-px text-center text-xs font-semibold uppercase tracking-wide text-muted">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="pb-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: cal.lead }).map((_, i) => <div key={`l${i}`} />)}
                {Array.from({ length: cal.days }, (_, i) => i + 1).map((d) => {
                  const k = cal.key(d);
                  const list = byDay.get(k) ?? [];
                  const isSel = k === selected;
                  const isToday = k === cal.today;
                  return (
                    <Link key={k} href={qs({ d: k })} aria-current={isSel ? "date" : undefined} aria-label={`${longDay(k)}: ${list.length ? `${list.length} session${list.length > 1 ? "s" : ""}` : "no sessions"}`}
                      className={`flex min-h-24 flex-col rounded-lg border p-1.5 text-left transition hover:border-copper/50 ${isSel ? "border-brown bg-wine-50" : "border-line bg-surface"} ${k < cal.today ? "opacity-75" : ""}`}>
                      <span className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-brown text-white" : "text-heading"}`}>{d}</span>
                      {list.slice(0, 3).map((r) => (
                        <span key={r.id} className={`mb-0.5 flex items-center gap-1 truncate rounded px-1 text-[11px] leading-5 ${live(r.status) ? "bg-surface-2 text-ink" : "text-muted line-through decoration-muted/50"}`}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot[r.status] ?? "bg-muted"}`} aria-hidden="true" />
                          <span className="font-semibold tabular-nums">{hm(r.starts_at)}</span> <span className="truncate">{r.organisation ?? r.name}</span>
                        </span>
                      ))}
                      {list.length > 3 && <span className="text-[11px] text-muted">+{list.length - 3} more</span>}
                    </Link>
                  );
                })}
              </div>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {[["confirmed", "Confirmed"], ["pending_payment", "Awaiting payment"], ["completed", "Completed"], ["no_show", "No-show"], ["cancelled", "Cancelled"]].map(([k, l]) => <span key={k} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${dot[k]}`} aria-hidden="true" />{l}</span>)}
              </p>
            </div>
            {/* Agenda (phones) */}
            <ul className="divide-y divide-line md:hidden">
              {[...byDay.entries()].filter(([k]) => k.startsWith(cal.month)).length === 0 && <li className="py-3 text-sm text-muted">No sessions this month.</li>}
              {[...byDay.entries()].filter(([k]) => k.startsWith(cal.month)).map(([k, list]) => (
                <li key={k} className="py-2">
                  <Link href={qs({ d: k })} className="block">
                    <p className={`text-sm font-semibold ${k === cal.today ? "text-copper-ink" : "text-heading"}`}>{longDay(k)}{k === cal.today ? " · today" : ""}</p>
                    {list.map((r) => <p key={r.id} className="flex items-center gap-1.5 text-sm"><span className={`h-1.5 w-1.5 rounded-full ${dot[r.status] ?? "bg-muted"}`} aria-hidden="true" /><span className="tabular-nums">{hm(r.starts_at)}</span> {r.organisation ?? r.name} <span className="text-xs text-muted">({TYPE[r.type] ?? r.type})</span></p>)}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="space-y-6">
            <Panel title={<span>{longDay(selected)}{selected === cal.today ? " · today" : ""}</span>}>
              {dayRows.length === 0 ? <p className="text-sm text-muted">No sessions on this day.</p> : (
                <ul className="space-y-4">
                  {dayRows.map((b) => {
                    const future = b.starts_at.getTime() > Date.now();
                    const remindAt = new Date(b.starts_at.getTime() - REMINDER_MINUTES * 60000);
                    return (
                      <li key={b.id} className="rounded-xl border border-line p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-heading"><span className="tabular-nums">{hm(b.starts_at)}–{hm(b.ends_at)}</span> · {TYPE[b.type] ?? b.type}</p>
                            <p className="text-sm">{b.organisation}{b.name ? ` · ${b.name}` : ""}</p>
                            {b.email && <p className="text-xs text-muted">{b.email}</p>}
                          </div>
                          <Badge tone={statusTone(b.status)}>{b.status.replace("_", " ")}</Badge>
                        </div>
                        {b.topic && <p className="mt-2 rounded-lg bg-surface-2 p-2 text-sm">{b.topic}</p>}
                        <p className="mt-2 text-xs text-muted">
                          {b.pay ? <>Payment: {b.pay}{b.amount ? ` · ${formatMoney(Number(b.amount))}` : ""}{b.receipt ? ` · ${b.receipt}` : ""} · </> : "Free or invoiced · "}
                          Reminder: {b.reminded_at ? `sent ${b.reminded_at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })}` : b.status === "confirmed" && future ? `goes out at ${hm(remindAt)}` : b.status === "pending_payment" ? "after payment confirms" : "none"}
                        </p>
                        {live(b.status) && future && (
                          <form action={setMeetingLink.bind(null, b.id)} className="mt-3 flex gap-2">
                            <label htmlFor={`ml-${b.id}`} className="sr-only">Meeting link</label>
                            <input id={`ml-${b.id}`} name="link" type="url" defaultValue={b.meeting_link ?? ""} placeholder="https://meet.google.com/… (sent with the reminder)" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm" />
                            <SubmitButton tone="secondary" className="h-9 px-3 text-sm" pendingText="…">Save link</SubmitButton>
                          </form>
                        )}
                        {b.meeting_link && <p className="mt-1 truncate text-xs"><a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="text-copper-ink underline">{b.meeting_link}</a></p>}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {b.status === "confirmed" && future && <form action={sendReminderNow.bind(null, b.id)}><SubmitButton tone="secondary" className="h-8 px-2.5 text-xs" pendingText="Sending…">Send reminder now</SubmitButton></form>}
                          {b.status === "pending_payment" && (sup
                            ? <form action={setBookingStatus.bind(null, b.id, "confirmed")}><SubmitButton tone="success" className="h-8 px-2.5 text-xs" pendingText="…">Mark paid &amp; confirm</SubmitButton></form>
                            : <AskSuper compact kind="booking.confirm" title={`Confirm ${b.organisation ?? b.name}'s ${TYPE[b.type] ?? "session"} on ${longDay(selected)} as paid`} link={qs({ d: selected })} payload={{ bookingId: b.id }} label="Mark paid & confirm" />)}
                          {live(b.status) && !future && <form action={setBookingStatus.bind(null, b.id, "completed")}><SubmitButton tone="secondary" className="h-8 px-2.5 text-xs" pendingText="…">Completed</SubmitButton></form>}
                          {live(b.status) && !future && <form action={setBookingStatus.bind(null, b.id, "no_show")}><SubmitButton tone="secondary" className="h-8 px-2.5 text-xs" pendingText="…">No-show</SubmitButton></form>}
                          {live(b.status) && <form action={setBookingStatus.bind(null, b.id, "cancelled")}><SubmitButton tone="secondary" className="h-8 px-2.5 text-xs" pendingText="…">Cancel</SubmitButton></form>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Panel title="Coming up">
              {upcoming.length === 0 ? <p className="text-sm text-muted">Nothing else booked this month.</p> : (
                <ul className="divide-y divide-line">
                  {upcoming.map((r) => (
                    <li key={r.id}>
                      <Link href={qs({ d: dayKey(r.starts_at) })} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-copper-ink">
                        <span className="min-w-0 truncate"><span className="font-medium text-heading">{r.organisation ?? r.name}</span> <span className="text-muted">· {TYPE[r.type] ?? r.type}</span></span>
                        <span className="shrink-0 text-xs text-muted">{r.starts_at.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })}{!r.meeting_link && r.status === "confirmed" ? " · no link" : ""}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
