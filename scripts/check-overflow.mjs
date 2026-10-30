/**
 * Layout regression check: finds elements that extend past the bottom of their container
 * (e.g. cards stretched by `h-full` spilling over the footer) on every sitemap page.
 *   node scripts/check-overflow.mjs [baseUrl]        (dev server must be running)
 * Exits 1 if anything spills. Closed <details> content is ignored (laid out but not painted).
 */
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const xml = await (await fetch(`${base}/sitemap.xml`)).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
urls.push("/assessment", "/roi", "/sessions", "/contact");

const browser = await chromium.launch();
const found = {};
for (const width of [1440, 375]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.setDefaultNavigationTimeout(180_000);
  for (const u of urls) {
    await page.goto(base + u);
    const bad = await page.evaluate(() => {
      const out = [];
      const footer = document.querySelector("footer");
      const footerTop = footer ? footer.getBoundingClientRect().top : Infinity;
      for (const el of document.querySelectorAll("main *")) {
        const cs = getComputedStyle(el);
        const details = el.closest("details");
        if (cs.position === "fixed" || cs.position === "absolute" || el.closest("footer")) continue;
        if (details && !details.open && !el.closest("summary")) continue;
        const r = el.getBoundingClientRect();
        if (!r.height || !el.parentElement) continue;
        const pcs = getComputedStyle(el.parentElement);
        if (/(auto|hidden|scroll|clip)/.test(pcs.overflow + pcs.overflowY)) continue;
        const pr = el.parentElement.getBoundingClientRect();
        if (r.bottom > pr.bottom + 8 || r.bottom > footerTop + 4) out.push(`${el.tagName}.${String(el.className).slice(0, 60)} +${Math.round(r.bottom - pr.bottom)}px`);
        if (out.length > 3) break;
      }
      return out;
    });
    if (bad.length) found[`${width}px ${u}`] = bad;
  }
  await page.close();
}
await browser.close();
console.log(Object.keys(found).length ? JSON.stringify(found, null, 2) : `No spilling sections on ${urls.length} pages at 1440px and 375px.`);
process.exitCode = Object.keys(found).length ? 1 : 0;
