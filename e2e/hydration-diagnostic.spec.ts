import { test } from "@playwright/test";

/**
 * Diagnostic (not a pass/fail check): loads pages repeatedly and, when React reports a hydration mismatch,
 * prints the document state at that moment and how the server's HTML differs from what the browser shows.
 * Runs only when E2E_DIAGNOSE=1.
 */
test.skip(!process.env.E2E_DIAGNOSE, "diagnostic only");

const PAGES = ["/", "/resources", "/roi/master", "/assessment", "/case-studies", "/growth/ai-visibility-check", "/solutions", "/pricing", "/portal", "/portal/automations", "/portal/conversations"];

test("hydration mismatch diagnostic", async ({ page, context }) => {
  test.setTimeout(600_000);
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
  await page.addInitScript(() => {
    (window as unknown as { __diag: unknown[] }).__diag = [];
    const rec = (msg: string) => (window as unknown as { __diag: unknown[] }).__diag.push({
      msg: msg.slice(0, 3000), readyState: document.readyState, bodyChildren: document.body?.children.length ?? -1,
      headMetas: document.head?.querySelectorAll("meta").length ?? -1, scripts: document.scripts.length,
    });
    window.addEventListener("error", (e) => rec(String(e.message)));
    const orig = console.error; console.error = (...a: unknown[]) => { rec(a.map(String).join(" ")); orig(...a); };
  });
  await page.goto("/portal/demo"); // sign in to the demo workspace before intercepting documents
  let html = "";
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const r = await route.fetch(); html = await r.text(); await route.fulfill({ response: r, body: html });
  });
  let found = 0;
  for (let round = 0; round < 6 && found < 3; round++) {
    for (const path of PAGES) {
      await page.goto(path); await page.waitForTimeout(1500);
      const diag = await page.evaluate(() => (window as unknown as { __diag: { msg: string }[] }).__diag);
      if (!diag.some((d) => /418|Hydration/.test(d.msg))) continue;
      found++;
      const diff = await page.evaluate((serverHtml) => {
        const parsed = new DOMParser().parseFromString(serverHtml, "text/html");
        // Elements (with attributes) and text, in document order, skipping scripts, hidden streaming buffers
        // and the chat button (it is added in the browser on purpose).
        const sig = (root: Element) => { const out: string[] = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
          let n: Node | null; while ((n = w.nextNode())) { const el = n.nodeType === 1 ? (n as Element) : n.parentElement!;
            if (!el || el.closest("script,template,[hidden],style,next-route-announcer") || el.closest('[aria-label="Open chat with Elans"]')) continue;
            if (n.nodeType === 3) { const t = n.textContent!.trim(); if (t) out.push("T:" + t.slice(0, 80)); }
            else { const e = n as Element; out.push(`<${e.tagName.toLowerCase()} ${[...e.attributes].filter((x) => !["class", "style"].includes(x.name)).map((x) => `${x.name}=${x.value.slice(0, 40)}`).join(" ")}>`); } }
          return out; };
        const a = sig(parsed.body), b = sig(document.body);
        let i = 0; while (i < a.length && a[i] === b[i]) i++;
        return { serverCount: a.length, clientCount: b.length, firstDiffAt: i, server: a.slice(Math.max(0, i - 2), i + 5), client: b.slice(Math.max(0, i - 2), i + 5),
          head: { server: [...parsed.head.children].map((e) => e.tagName).join(","), client: [...document.head.children].map((e) => e.tagName).join(",") } };
      }, html);
      const stack = diag.map((d) => d.msg).find((m) => m.includes("@@STACK@@"))?.split("@@STACK@@")[1] ?? "(no component stack)";
      console.log(`DIAG ${test.info().project.name} ${path} round ${round}: STACK ${stack}`);
      console.log(`DIAG ${test.info().project.name} ${path} round ${round}: ${JSON.stringify({ events: diag.slice(0, 3).map((d) => ({ ...d, msg: d.msg.slice(0, 100) })), diff })}`);
    }
  }
  console.log(`DIAG ${test.info().project.name}: ${found} mismatches found`);
});
