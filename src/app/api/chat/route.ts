import { NextResponse } from "next/server";
import { z } from "zod";
import { internal } from "@/lib/db";
import { getCatalogue } from "@/lib/content";
import { respond, detectLang } from "@/lib/engines/conversation";
import { rateLimit, sha256 } from "@/lib/security";
import { captureLead } from "@/lib/leads";
import { queueMessage } from "@/lib/outbox";

const postSchema = z.object({
  conversationId: z.uuid().optional(),
  visitor: z.string().min(16).max(64),
  message: z.string().trim().min(1).max(1000),
  page: z.string().max(200).optional(),
});

function ipOf(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
}

export async function POST(req: Request) {
  const body = postSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const { visitor, message, page } = body.data;
  if (!rateLimit(`chat:${ipOf(req)}`, 30, 10 * 60_000).ok) return NextResponse.json({ error: "You're sending messages quickly. Please wait a moment." }, { status: 429 });
  const visitorHash = sha256(visitor);
  const cat = await getCatalogue();

  try {
    const result = await internal(async (tx) => {
      let convId = body.data.conversationId;
      let status = "open";
      let meta: Record<string, unknown> = {};
      if (convId) {
        const [c] = await tx<{ id: string; status: string; meta: Record<string, unknown> }[]>`select id, status, meta from conversations where id = ${convId} and visitor_ref = ${visitorHash}`;
        if (!c) convId = undefined;
        else {
          status = c.status;
          meta = c.meta ?? {};
        }
      }
      if (!convId) {
        const [c] = await tx<{ id: string }[]>`insert into conversations (tenant_id, channel, visitor_ref, language, meta) values (app_tenant(), 'web', ${visitorHash}, ${detectLang(message)}, ${tx.json({ firstPage: page ?? null })}) returning id`;
        convId = c.id;
      }
      await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (app_tenant(), ${convId}, 'in', 'customer', ${message}, ${tx.json({ page: page ?? null, untrusted: true })})`;
      // Once a person has taken over, the agent stays silent.
      if (status === "handed_off") {
        await tx`update conversations set updated_at = now() where id = ${convId}`;
        return { conversationId: convId, replies: [], handedOff: true };
      }
      const history = await tx<{ author: string; body: string }[]>`select author, body from messages where conversation_id = ${convId} order by created_at desc limit 8`;
      const turn = await respond(cat, message, { awaitingCallback: Boolean(meta.awaitingCallback), history: history.reverse() });
      await tx`insert into messages (tenant_id, conversation_id, direction, author, body, meta) values (app_tenant(), ${convId}, 'out', 'agent', ${turn.reply}, ${tx.json({ links: turn.links, intent: turn.intent, generator: turn.generator } as never)})`;

      if (turn.intent === "callback_details") {
        const email = message.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
        const phone = message.match(/\+?\d[\d\s-]{7,}/)?.[0]?.replace(/\s+/g, "");
        await tx`insert into handoffs (tenant_id, conversation_id, reason, callback_requested) values (app_tenant(), ${convId}, 'Callback requested outside support hours', true)`;
        await tx`update conversations set meta = meta - 'awaitingCallback', status = 'handed_off', updated_at = now() where id = ${convId}`;
        if (email) await captureLead({ name: message.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).slice(0, 3).join(" ") || "Chat visitor", email, phone, source: "chat", sourceDetail: "callback request", consentContact: true, consentMarketing: false, consentPurpose: "enquiry" }, tx);
        else await queueMessage(tx, { channel: "email", to: "team@elans", subject: "Chat callback requested", body: `Callback requested: ${phone ?? message}` });
      } else if (turn.wantsCallbackDetails) {
        await tx`update conversations set meta = meta || '{"awaitingCallback": true}'::jsonb, updated_at = now() where id = ${convId}`;
      } else if (turn.handover) {
        await tx`insert into handoffs (tenant_id, conversation_id, reason) values (app_tenant(), ${convId}, ${`Visitor asked for a person: "${message.slice(0, 120)}"`})`;
        await tx`update conversations set status = 'handed_off', resolution = 'handed_off', updated_at = now() where id = ${convId}`;
        await queueMessage(tx, { channel: "email", to: "team@elans", subject: "Live chat handover waiting", body: `A visitor is waiting in live chat: ${message.slice(0, 200)}` });
      } else {
        await tx`update conversations set updated_at = now() where id = ${convId}`;
      }
      return { conversationId: convId, replies: [{ body: turn.reply, links: turn.links, author: "agent" }], handedOff: turn.handover || turn.intent === "callback_details" };
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "The chat is unavailable right now. Please use the contact form." }, { status: 503 });
  }
}

/** Poll for messages after a given time (used while a person is handling the conversation). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const id = u.searchParams.get("conversationId") ?? "";
  const visitor = u.searchParams.get("visitor") ?? "";
  const after = u.searchParams.get("after") ?? "1970-01-01T00:00:00Z";
  if (!/^[0-9a-f-]{36}$/.test(id) || visitor.length < 16) return NextResponse.json({ messages: [] });
  try {
    const out = await internal(async (tx) => {
      const [c] = await tx<{ status: string }[]>`select status from conversations where id = ${id} and visitor_ref = ${sha256(visitor)}`;
      if (!c) return { messages: [], status: "unknown" };
      const msgs = await tx<{ author: string; body: string; created_at: Date; meta: { links?: unknown } }[]>`
        select author, body, created_at, meta from messages where conversation_id = ${id} and direction = 'out' and created_at > ${new Date(after)} order by created_at`;
      return { status: c.status, messages: msgs.map((m) => ({ author: m.author, body: m.body, at: m.created_at.toISOString(), links: m.meta?.links ?? [] })) };
    });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
