"use server";

import { requireStaff } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";

export interface SearchHit {
  group: string;
  label: string;
  hint?: string;
  href: string;
}

/** Console-wide search. Only internal (pre-sale) records and client names; client data needs an access grant. */
export async function consoleSearch(query: string): Promise<SearchHit[]> {
  const u = await requireStaff();
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  return asStaff(u, async (tx) => {
    const [leads, opps, quotes, clients, content, bookings] = await Promise.all([
      tx<{ id: string; name: string | null; organisation: string | null; email: string | null; stage: string }[]>`
        select l.id, c.name, c.organisation, c.email, l.stage from leads l left join contacts c on c.id = l.contact_id
        where c.name ilike ${like} or c.organisation ilike ${like} or c.email ilike ${like} or c.phone ilike ${like}
        order by l.created_at desc limit 6`,
      tx<{ id: string; name: string; stage: string }[]>`select id, name, stage from opportunities where name ilike ${like} order by updated_at desc limit 5`,
      tx<{ id: string; number: string; status: string }[]>`select id, number, status from quotes where number ilike ${like} order by created_at desc limit 5`,
      tx<{ id: string; name: string; kind: string }[]>`select id, name, kind from ops_client_list() where name ilike ${like} limit 5`,
      tx<{ type: string; slug: string; title: string }[]>`
        select type, slug, coalesce(data->>'name', data->>'title', slug) as title from content_items
        where slug ilike ${like} or data->>'name' ilike ${like} or data->>'title' ilike ${like} order by type limit 8`,
      tx<{ id: string; name: string; organisation: string; starts_at: Date }[]>`
        select b.id, c.name, c.organisation, b.starts_at from bookings b join contacts c on c.id = b.contact_id
        where c.name ilike ${like} or c.organisation ilike ${like} order by b.starts_at desc limit 4`,
    ]);
    return [
      ...leads.map((l) => ({ group: "Leads", label: l.organisation || l.name || l.email || "Unknown", hint: [l.name, l.email, l.stage].filter(Boolean).join(" · "), href: `/ops/leads/${l.id}` })),
      ...opps.map((o) => ({ group: "Opportunities", label: o.name, hint: o.stage, href: `/ops/opportunities/${o.id}` })),
      ...quotes.map((x) => ({ group: "Quotes", label: x.number, hint: x.status, href: `/ops/quotes/${x.id}` })),
      ...clients.map((c) => ({ group: "Clients", label: c.name, hint: c.kind, href: `/ops/clients/${c.id}` })),
      ...bookings.map((b) => ({ group: "Sessions", label: `${b.organisation} (${b.name})`, hint: b.starts_at.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" }), href: "/ops/bookings" })),
      ...content.map((c) => ({ group: "Content", label: c.title, hint: c.type, href: `/ops/content/${c.type}/${c.slug}` })),
    ];
  });
}
