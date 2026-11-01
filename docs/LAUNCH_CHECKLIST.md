# Launch checklist

Status of each item for the public site, client portal and staff console, with how it was checked.
Last run: 1 November 2026, local production build (`next build` + `next start`).

| Item | Status | Evidence / notes |
|---|---|---|
| Mobile responsive | Pass | No horizontal overflow on all sitemap pages at 375px and 1440px (`scripts/check-overflow.mjs`), console and portal pages at 375px, and iPhone 13 / Pixel 7 emulation on key pages. |
| Form validation | Pass | Required fields, email format and consent enforced in the browser; every form re-validated on the server (zod). Console forms show the first problem as a toast and keep the user on the form. |
| Clear CTAs | Pass | One primary call to action per page ("Find Your Automation Opportunities" / "Assess my fit"), secondary actions styled as secondary; console has quick actions on the dashboard. |
| Error states | Pass | Branded error screens with "Try again" and a support reference for the site, console and portal; global fallback; inline form errors; toasts for failed actions; loading skeletons in console and portal. |
| SEO setup | Pass | Per-page titles, descriptions and canonicals; `sitemap.xml` (complete pages only), `robots.txt`, JSON-LD (Organization, Breadcrumb, Article, FAQ), `llms.txt`. Set `NEXT_PUBLIC_SITE_URL` in production. |
| Accessibility | Pass (automated) | axe-core WCAG 2.2 AA: zero violations on 15 public pages, 10 console pages and 6 portal pages. Fixed during the audit: labels wrapping dropdowns, a link distinguishable only by colour, keyboard access to sideways-scrolling tables and the pipeline board. Skip links, focus rings, `aria-live` toasts and chat. A manual screen-reader pass is still recommended before launch. |
| Meta tags | Pass | Title template, description, Open Graph and Twitter card with a 1200×630 image (`/og.png`), theme colour, manifest, `lang="en-GB"`. |
| Colour contrast | Pass | Tokens checked against WCAG AA (body 15:1, brand 12.4:1, accent text 8.6:1); axe colour-contrast check clean after fixing one low-contrast label on the home page. |
| Fast loading | Pass | Throttled mobile (Pixel 7, slow 4G, 4× CPU): main content (LCP) 0.7–1.0s on all tested pages; fonts self-hosted; pages pre-rendered or cached; chat widget loads when the browser is idle. |
| Analytics | Ready, off by default | Cookieless Plausible, loaded only after visitor consent (as the cookie policy states). Enable with `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. Internal funnel analytics in the console. |
| Image optimisation | Pass | The site uses SVG icons and logo (no raster photography); social image and app icons are compressed PNGs (largest 146 KB). Add `next/image` if photography is introduced. |
| Privacy policy | Pass | `/legal/privacy`, `/legal/cookies`, `/legal/dpa`, terms and acceptable use, linked in the footer and next to every consent checkbox. Counsel review still required (PLACEHOLDERS). |
| Alt text | Pass | The only raster images (sign-in QR codes) have descriptive alt text; decorative icons are hidden from screen readers; the logo has an accessible name. |
| Secure APIs | Pass | Rate limits on chat, forms, demo and the test payment endpoint (now refused unless M-Pesa is in mock mode); signed M-Pesa callback; server-side validation; RLS tenant isolation (tested); MFA for staff; CSP, HSTS (production), X-Frame-Options, nosniff, Referrer-Policy headers; audited exports and client access. |
| Core Web Vitals | Mostly pass | CLS 0.000 on all tested pages (fixed a 0.39 shift on /solutions); LCP 0.7–1.0s. Total blocking time 250–580ms on the throttled lab profile, above the 200ms lab target; most is the shared React/Next.js runtime (103 kB). Follow-up: reduce client components on the home page and catalogue; confirm with real-user INP once analytics is on. |
| Broken links | Pass | All 266 internal links from 259 pages return 200 (fixed 5 industry-pack links). No external links on the site. |
| 404 page | Pass | Branded 404 with routes onward; correct 404 status for unknown pages, categories and solutions. |
| Browser testing | Partial | Automated in Chromium (desktop) plus iPhone 13 and Pixel 7 emulation. Safari/WebKit and Firefox are not available in this environment; test on a real iPhone (Safari) and Firefox before launch. |
| Favicon | Pass | `favicon.ico` (16/32/48), SVG icon, 192/512 PNG app icons, Apple touch icon, web manifest. |
| Final QA | Pass | Typecheck clean; 35 unit, content and RLS tests; eTIMS eval; production build; console and portal workflows exercised end to end in the browser. |

## Before going live (not code)

1. Set production environment variables (see README → Deploying to Vercel) and confirm `/portal/demo` works on the live URL.
2. Manual checks on a real iPhone (Safari) and in Firefox; a screen-reader pass (VoiceOver or NVDA) on the home page, assessment and booking.
3. Turn on analytics (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) and Turnstile keys.
4. Counsel review of the legal pages; replace placeholders listed in `PLACEHOLDERS.md`.
