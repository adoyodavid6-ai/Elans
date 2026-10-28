import "server-only";
import { z } from "zod";
import type { Catalogue } from "@/lib/content";
import { keywordHit, tokens } from "@/lib/core/scoring";
import { aiAvailable, generateStructured } from "@/lib/ai";

/**
 * Elans' own web agent (Converse engine, narrow scope — DECISIONS D-018).
 * Order of operations: deterministic intents → grounded retrieval → optional model phrasing.
 * The model only ever sees our own approved content as context and the visitor's text as untrusted data.
 */

export type Lang = "en" | "sw";
export interface AgentLink {
  label: string;
  href: string;
}
export interface AgentTurn {
  reply: string;
  links: AgentLink[];
  intent: "greeting" | "handover" | "booking" | "pricing" | "assessment" | "answer" | "fallback" | "callback_details" | "privacy";
  handover: boolean;
  wantsCallbackDetails?: boolean;
  generator: string;
}

const SW_WORDS = ["habari", "bei", "ngapi", "nataka", "naomba", "asante", "sasa", "mambo", "je", "nini", "tafadhali", "kuongea", "mtu", "msaada", "biashara", "kampuni", "nisaidie", "ninahitaji"];
export function detectLang(text: string): Lang {
  const t = text.toLowerCase();
  return SW_WORDS.filter((w) => new RegExp(`\\b${w}\\b`).test(t)).length >= 1 ? "sw" : "en";
}

const T = {
  greeting: {
    en: "Hello! I'm the Elans assistant. I can explain our automation and growth solutions, prices, or help you book a call. What does your business do?",
    sw: "Habari! Mimi ni msaidizi wa Elans. Ninaweza kueleza huduma zetu za automation na ukuaji wa biashara, bei, au kukusaidia kupanga mazungumzo. Biashara yako inafanya nini?",
  },
  handoverOpen: {
    en: "I'm connecting you to a member of the Elans team now. They'll reply here shortly. You don't need to repeat anything; they can see this conversation.",
    sw: "Ninakuunganisha na mmoja wa timu ya Elans sasa. Watajibu hapa hivi punde, na wataona mazungumzo haya yote.",
  },
  handoverClosed: {
    en: "Our team is offline right now (support hours: {hours}). Leave your name and phone number or email and we'll call you back on the next working day.",
    sw: "Timu yetu haipo mtandaoni sasa hivi (saa za kazi: {hours}). Acha jina lako na namba ya simu au barua pepe, tutakupigia siku ya kazi inayofuata.",
  },
  callbackThanks: {
    en: "Thank you, we've booked a callback. Someone from Elans will contact you on the next working day.",
    sw: "Asante, tumepanga kukupigia. Mtu kutoka Elans atawasiliana nawe siku ya kazi inayofuata.",
  },
  booking: {
    en: "You can book a free 20-minute Discovery Call or a paid Strategy Session (pay by M-Pesa) here:",
    sw: "Unaweza kupanga Discovery Call ya bure ya dakika 20 au Strategy Session (lipa kwa M-Pesa) hapa:",
  },
  assessment: {
    en: "The quickest way to see where automation would help you is our free 10-minute AI Opportunity Assessment. It scores your opportunities and explains why.",
    sw: "Njia ya haraka ya kuona mahali automation itakusaidia ni tathmini yetu ya bure ya dakika 10 (AI Opportunity Assessment).",
  },
  fallback: {
    en: "I'm not certain I have the right answer to that. I'd rather not guess. Would you like me to connect you to a person, or would the free assessment help?",
    sw: "Sina uhakika na jibu sahihi la hilo, na sitaki kubahatisha. Ungependa nikuunganishe na mtu, au tathmini ya bure itakusaidia?",
  },
  privacy: {
    en: "Please don't share passwords, PINs or card numbers here. We'll never ask for them. For data-protection requests, use the contact form and choose 'Existing client support'.",
    sw: "Tafadhali usishiriki nywila, PIN au namba za kadi hapa. Hatutawahi kuziomba.",
  },
};

export function supportHoursOpen(now = new Date()) {
  const eat = new Date(now.getTime() + 3 * 3600_000);
  const dow = eat.getUTCDay();
  const h = eat.getUTCHours() + eat.getUTCMinutes() / 60;
  return dow >= 1 && dow <= 5 && h >= 8 && h < 18;
}

interface Doc {
  title: string;
  body: string;
  href: string;
  tokens: Set<string>;
  weight?: number;
  keywords?: string[];
}
function corpus(cat: Catalogue): Doc[] {
  const docs: Doc[] = [];
  for (const s of cat.solutions)
    docs.push({ title: s.name, body: `${s.summary} Typical timeline ${s.timeline}; status: ${s.status}.`, href: `/solutions/${s.category}/${s.slug}`, tokens: tokens([s.name, s.name, s.summary, ...s.keywords].join(" ")), weight: 1.3, keywords: s.keywords });
  for (const i of cat.industries) docs.push({ title: `${i.name}`, body: `${i.summary} ${i.context}`, href: `/industries/${i.slug}`, tokens: tokens([i.name, i.short, i.summary, ...i.repetitiveTasks].join(" ")) });
  for (const g of cat.growthServices) docs.push({ title: g.name, body: `${g.summary} ${g.problem}`, href: `/growth/${g.slug}`, tokens: tokens([g.name, g.summary, g.problem].join(" ")) });
  for (const r of cat.resources) docs.push({ title: r.title, body: r.summary, href: `/resources/${r.slug}`, tokens: tokens([r.title, r.summary, r.category].join(" ")) });
  for (const s of cat.solutions) for (const f of s.faqs) docs.push({ title: `${s.name}: ${f.q}`, body: f.a, href: `/solutions/${s.category}/${s.slug}#faqs`, tokens: tokens(`${f.q} ${s.name}`), weight: 0.6 });
  return docs;
}

export function retrieve(cat: Catalogue, query: string, k = 4) {
  const q = tokens(query);
  if (!q.size) return [];
  return corpus(cat)
    .map((d) => {
      const titleTokens = tokens(d.title);
      const hits = [...q].filter((t) => d.tokens.has(t)).length;
      const titleHits = [...q].filter((t) => titleTokens.has(t)).length;
      const phraseHits = (d.keywords ?? []).filter((k) => keywordHit(k, q)).length;
      return { d, s: ((d.weight ?? 1) * (hits + 1.5 * titleHits)) / Math.sqrt(d.tokens.size + 4) + 0.35 * phraseHits };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => ({ ...x.d, score: x.s }));
}

const agentSchema = z.object({
  reply: z.string().describe("The reply to the visitor, under 90 words, in their language (English or Swahili)."),
  handover: z.boolean().describe("True if the visitor should speak to a person: complaint, negotiation, legal/tax/medical question, or the context does not answer the question."),
  links: z.array(z.object({ label: z.string(), href: z.string() })).describe("Up to 2 links, only hrefs from the provided context."),
});

export async function respond(cat: Catalogue, message: string, ctx: { awaitingCallback: boolean; history: { author: string; body: string }[] }): Promise<AgentTurn> {
  const lang = detectLang(message);
  const m = message.toLowerCase().trim();
  const hours = cat.settings.supportHours;

  if (ctx.awaitingCallback) {
    const hasContact = /\+?\d[\d\s-]{7,}/.test(m) || /@/.test(m);
    if (hasContact) return { reply: T.callbackThanks[lang], links: [], intent: "callback_details", handover: true, generator: "rules" };
  }
  if (/\b(password|pin|cvv|card number)\b/.test(m) || /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/.test(m)) {
    return { reply: T.privacy[lang], links: [{ label: "Contact form", href: "/contact" }], intent: "privacy", handover: false, generator: "rules" };
  }
  if (/\b(human|person|agent|someone|real person|staff|talk to|speak to|call me|mtu|kuongea na)\b/.test(m)) {
    const open = supportHoursOpen();
    return {
      reply: open ? T.handoverOpen[lang] : T.handoverClosed[lang].replace("{hours}", hours),
      links: [],
      intent: "handover",
      handover: open,
      wantsCallbackDetails: !open,
      generator: "rules",
    };
  }
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|habari|mambo|sasa|niaje)\b/.test(m) && m.length < 30) {
    return { reply: T.greeting[lang], links: [{ label: "Take the free assessment", href: "/assessment" }, { label: "Browse solutions", href: "/solutions" }], intent: "greeting", handover: false, generator: "rules" };
  }
  if (/\b(book|booking|appointment|meeting|call|demo|session|panga)\b/.test(m) && !/\bmissed call/.test(m)) {
    return { reply: T.booking[lang], links: [{ label: "Book a session", href: "/sessions" }], intent: "booking", handover: false, generator: "rules" };
  }
  if (/\b(price|prices|pricing|cost|costs|how much|charge|charges|bei|ngapi)\b/.test(m)) {
    const s = cat.pricePoints.find((p) => p.key === "launch.setup");
    const mo = cat.pricePoints.find((p) => p.key === "launch.monthly");
    const txt =
      lang === "sw"
        ? `Bei zinaanzia KES ${s?.amount?.toLocaleString("en-GB")} kwa usanidi na KES ${mo?.amount?.toLocaleString("en-GB")} kwa mwezi (Elans Launch), kulingana na upeo. Bei zote ziko kwenye ukurasa wa bei.`
        : `Packages start from KES ${s?.amount?.toLocaleString("en-GB")} setup and KES ${mo?.amount?.toLocaleString("en-GB")} a month (Elans Launch) for one solution, with larger packages for connected workflows. ${s && !s.confirmed ? "These are indicative starting prices; your quote confirms the final price." : ""}`;
    return { reply: txt.trim(), links: [{ label: "See pricing", href: "/pricing" }, { label: "Request a quote", href: "/contact?topic=quote" }], intent: "pricing", handover: false, generator: "rules" };
  }
  if (/\b(where (do|should) (i|we) start|not sure|which solution|recommend|assessment)\b/.test(m)) {
    return { reply: T.assessment[lang], links: [{ label: "Start the assessment", href: "/assessment" }], intent: "assessment", handover: false, generator: "rules" };
  }

  const hits = retrieve(cat, message);
  if (aiAvailable()) {
    const r = await generateStructured({
      promptKey: "web_agent.reply",
      promptVersion: "1",
      budgetScope: "public",
      model: "fast",
      maxTokens: 800,
      instructions: [
        "You are the Elans website assistant. Elans is an AI automation and growth company in Nairobi, Kenya.",
        "Answer ONLY from the CONTEXT provided. If the context does not answer the question, say so and set handover=true.",
        "Never invent prices, timelines, clients, case studies, statistics or certifications. Never give legal, tax, medical or credit advice.",
        "Reply in the visitor's language: English (UK spelling) or Swahili. Tolerate Sheng and mixed language.",
        "Be warm, concise and practical. Suggest the free assessment or a session when helpful.",
      ].join(" "),
      task: `CONTEXT (approved Elans content):\n${hits.map((h) => `- ${h.title} (${h.href}): ${h.body}`).join("\n") || "(no matching content)"}\n\nRecent conversation:\n${ctx.history.slice(-6).map((h) => `${h.author}: ${h.body.slice(0, 300)}`).join("\n")}`,
      untrusted: { visitor_message: message },
      schema: agentSchema,
    });
    if (r.ok) {
      const allowed = new Set([...hits.map((h) => h.href), "/assessment", "/sessions", "/pricing", "/contact", "/solutions"]);
      return { reply: r.data.reply, links: r.data.links.filter((l) => allowed.has(l.href)).slice(0, 2), intent: r.data.handover ? "fallback" : "answer", handover: false, wantsCallbackDetails: false, generator: `${r.meta.model} · ${r.meta.promptKey}@${r.meta.promptVersion}` };
    }
  }
  if (hits.length && hits[0].score > 0.18) {
    const top = hits[0];
    const reply = lang === "sw" ? `Hii inaweza kusaidia: ${top.title}. ${top.body.split(". ")[0]}.` : `This may help: **${top.title}**. ${top.body.split(". ").slice(0, 2).join(". ")}.`;
    return { reply, links: hits.slice(0, 2).map((h) => ({ label: h.title, href: h.href })), intent: "answer", handover: false, generator: "rules" };
  }
  return { reply: T.fallback[lang], links: [{ label: "Talk to a person", href: "#handover" }, { label: "Free assessment", href: "/assessment" }], intent: "fallback", handover: false, generator: "rules" };
}
