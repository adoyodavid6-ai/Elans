import "server-only";
import { z } from "zod";
import type { Tx } from "@/lib/db";
import type { EngineInstance } from "@/lib/runtime/engine";
import { detectLang } from "@/lib/engines/conversation";
import { tokens } from "@/lib/core/scoring";
import { aiAvailable, generateStructured } from "@/lib/ai";

/**
 * WhatsApp Sales & Support Agent (Elans Converse) for a client tenant.
 * Grounded only in the client's approved catalogue and FAQs; verifies M-Pesa payments against
 * the tenant's real (reconciled) receipts, never against a screenshot; hands over on request.
 */
export interface CatalogueItem {
  sku: string;
  name: string;
  aliases: string[];
  price: number;
  unit: string;
  stock: number;
}
export interface ConverseConfig {
  businessName: string;
  catalogue: CatalogueItem[];
  faqs: { q: string; a: string }[];
  hours: string;
  location: string;
  paybill: string;
  account: string;
}
interface PendingOrder {
  sku: string;
  qty: number;
  total: number;
}
export interface AgentReply {
  body: string;
  intent: string;
  handover?: boolean;
  resolved?: boolean;
  pendingOrder?: PendingOrder | null;
}

const money = (n: number) => `KES ${n.toLocaleString("en-GB")}`;

function findItem(cfg: ConverseConfig, text: string): CatalogueItem | null {
  const t = tokens(text);
  let best: { item: CatalogueItem; s: number } | null = null;
  for (const item of cfg.catalogue) {
    const names = [item.name, ...item.aliases];
    const s = Math.max(...names.map((n) => [...tokens(n)].filter((x) => t.has(x)).length / Math.max(1, tokens(n).size)));
    if (s > 0 && (!best || s > best.s)) best = { item, s };
  }
  return best && best.s >= 0.5 ? best.item : null;
}

function parseQty(text: string): number | null {
  const m = text.match(/\b(\d{1,4})\b/);
  return m ? Number(m[1]) : null;
}

export async function converseRespond(tx: Tx, inst: EngineInstance, conversationId: string, message: string): Promise<AgentReply> {
  const cfg = inst.config as unknown as ConverseConfig;
  const lang = detectLang(message);
  const m = message.toLowerCase();
  const [conv] = await tx<{ meta: { pendingOrder?: PendingOrder } }[]>`select meta from conversations where id = ${conversationId}`;
  const pending = conv?.meta?.pendingOrder ?? null;
  const sw = lang === "sw";

  if (/\b(human|person|agent|manager|mtu|meneja|complain|complaint|lalamika)\b/.test(m)) {
    return { body: sw ? "Sawa, ninakuunganisha na mmoja wa timu yetu sasa hivi. Watajibu hapa." : "Of course, I'm passing you to a member of our team now. They'll reply here shortly.", intent: "handover", handover: true };
  }

  const code = message.toUpperCase().match(/\b([A-Z]{2,3}[A-Z0-9]{7,8})\b/);
  if (code && /\d/.test(code[1])) {
    const [txn] = await tx<{ amount: number; status: string }[]>`select amount, status from recon_transactions where tenant_id = ${inst.tenant_id} and upper(txn_ref) = ${code[1]}`;
    if (!txn) return { body: sw ? `Bado sijaona malipo ya ${code[1]} kwenye akaunti yetu. Malipo yanaweza kuchukua dakika chache, tafadhali jaribu tena baadaye au subiri timu yetu ikague.` : `I can't see payment ${code[1]} on our account yet. It can take a few minutes to arrive. Please try again shortly, or I can ask the team to check.`, intent: "payment_not_found" };
    const [used] = await tx<{ id: string }[]>`select id from conversations where tenant_id = ${inst.tenant_id} and id <> ${conversationId} and meta->>'paidWith' = ${code[1]} limit 1`;
    if (used) return { body: sw ? `Msimbo ${code[1]} tayari umetumika kwa oda nyingine. Ninaipeleka kwa timu kwa uhakiki.` : `Payment ${code[1]} has already been used for another order. I'm passing this to the team to check.`, intent: "payment_reused", handover: true };
    if (pending && Math.abs(Number(txn.amount) - pending.total) > 1) return { body: sw ? `Nimeona ${money(Number(txn.amount))}, lakini oda yako ni ${money(pending.total)}. Ninaipeleka kwa timu kwa uhakiki.` : `I can see ${money(Number(txn.amount))}, but your order total is ${money(pending.total)}. I'm passing this to the team to check.`, intent: "payment_mismatch", handover: true };
    await tx`update conversations set meta = meta || jsonb_build_object('paidWith', ${code[1]}::text) where id = ${conversationId}`;
    return { body: sw ? `Asante! Malipo ya ${money(Number(txn.amount))} (${code[1]}) yamethibitishwa. Oda yako imepokelewa na tutakujulisha ikitumwa.` : `Thank you! Payment of ${money(Number(txn.amount))} (${code[1]}) is confirmed. Your order is in and we'll let you know when it's dispatched.`, intent: "payment_confirmed", resolved: true, pendingOrder: null };
  }

  const item = findItem(cfg, message);
  const qty = parseQty(message);
  const wantsOrder = /\b(want|need|order|buy|send|deliver|nataka|naomba|nitumie|leta)\b/.test(m);
  if (item && qty && wantsOrder) {
    if (qty > item.stock) return { body: sw ? `Samahani, tuna ${item.stock} ${item.unit} za ${item.name} kwa sasa. Ungependa hizo?` : `Sorry, we have ${item.stock} ${item.unit} of ${item.name} in stock right now. Would you like those?`, intent: "stock_short" };
    const order = { sku: item.sku, qty, total: qty * item.price };
    return {
      body: sw
        ? `Sawa: ${qty} ${item.unit} × ${item.name} = ${money(order.total)}. Lipa kwa M-Pesa Paybill ${cfg.paybill}, akaunti ${cfg.account}, kisha nitumie msimbo wa M-Pesa hapa nithibitishe.`
        : `Great: ${qty} ${item.unit} × ${item.name} = ${money(order.total)}. Pay via M-Pesa Paybill ${cfg.paybill}, account ${cfg.account}, then send me the M-Pesa confirmation code here and I'll confirm your order.`,
      intent: "order_captured",
      pendingOrder: order,
    };
  }
  if (item) {
    return { body: sw ? `${item.name}: ${money(item.price)} kwa ${item.unit.replace(/s$/, "")}. Tuna ${item.stock} kwenye stoo. Ungependa ngapi?` : `${item.name} is ${money(item.price)} per ${item.unit.replace(/s$/, "")}. We have ${item.stock} in stock. How many would you like?`, intent: "price" };
  }
  if (/\b(open|hours|close|saa|kufungua|location|where|wapi|located)\b/.test(m)) {
    return { body: sw ? `Tuko ${cfg.location}. Saa za kazi: ${cfg.hours}.` : `We're at ${cfg.location}. Opening hours: ${cfg.hours}.`, intent: "hours" };
  }
  const faq = cfg.faqs.map((f) => ({ f, s: [...tokens(f.q)].filter((x) => tokens(message).has(x)).length })).sort((a, b) => b.s - a.s)[0];
  if (faq && faq.s >= 2) return { body: faq.f.a, intent: "faq" };
  if (/^(hi|hello|hey|habari|mambo|sasa|niaje)\b/.test(m)) {
    return { body: sw ? `Habari! Karibu ${cfg.businessName}. Unaweza kuuliza bei, kuagiza, au kuthibitisha malipo.` : `Hello and welcome to ${cfg.businessName}! You can ask for prices, place an order, or confirm a payment.`, intent: "greeting" };
  }

  if (aiAvailable()) {
    const r = await generateStructured({
      promptKey: "converse.whatsapp_agent",
      promptVersion: "1",
      budgetScope: "tenant",
      model: "fast",
      maxTokens: 500,
      instructions: `You are the WhatsApp assistant for ${cfg.businessName}. Answer ONLY from the catalogue and FAQs provided. Never invent prices, stock, discounts or delivery promises. If unsure, say you'll ask the team (set handover true). Reply in the customer's language (English or Swahili), briefly.`,
      task: `Catalogue: ${JSON.stringify(cfg.catalogue.map((c) => ({ name: c.name, price: c.price, unit: c.unit, stock: c.stock })))}\nFAQs: ${JSON.stringify(cfg.faqs)}\nHours: ${cfg.hours}. Location: ${cfg.location}.`,
      untrusted: { customer_message: message },
      schema: z.object({ reply: z.string(), handover: z.boolean() }),
    });
    if (r.ok) return { body: r.data.reply, intent: "ai_answer", handover: r.data.handover };
  }
  return { body: sw ? "Sina uhakika na hilo. Ninaweza kukuunganisha na timu yetu?" : "I'm not sure about that one, and I don't want to guess. Shall I pass you to our team?", intent: "fallback" };
}
