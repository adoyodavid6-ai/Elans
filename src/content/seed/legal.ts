/** Draft legal documents. Placeholders are filled from site settings. Flagged for review by a Kenyan lawyer. */
export const LEGAL: Record<string, { title: string; updated: string; body: string }> = {
  privacy: {
    title: "Privacy notice",
    updated: "28 October 2026",
    body: `## Who we are
{{ENTITY}} ("Elans", "we") is the data controller for personal data collected through this website and our sales process, and a data processor for data we handle on behalf of clients. ODPC registration: {{ODPC}}.

## What we collect and why
- **Assessment answers and contact details:** to prepare and send your preliminary report (consent), and to follow up about it.
- **Marketing preferences:** only if you opt in separately. You can withdraw at any time.
- **Booking and payment details:** to schedule and confirm sessions (contract). Card details are handled by our payment provider; we do not store them.
- **Chat transcripts:** to answer your questions and hand over to a person (legitimate interest / consent).
- **Analytics:** only with your consent.

## How long we keep it
Leads that do not become clients: 24 months from last contact, then deleted. Client data: as set out in the client's data processing agreement.

## Who we share it with
Service providers who help us run Elans (hosting, email, messaging, payments, AI model providers) under contracts that protect your data. AI providers are not permitted to use your data to train models.

## International transfers
Some providers process data outside Kenya. We assess each transfer and apply safeguards required by the Data Protection Act, 2019.

## Your rights
You can ask to access, correct or erase your data, object to processing, or withdraw consent. Contact us via {{EMAIL}}. You may also complain to the Office of the Data Protection Commissioner.

## Automated decisions
We do not make decisions with legal or similarly significant effects about you based solely on automated processing. The assessment's scores are indicative suggestions, reviewed by a person before any proposal.`,
  },
  terms: {
    title: "Website terms of use",
    updated: "28 October 2026",
    body: `## Using this website
This website is provided by {{ENTITY}}. By using it you agree to these terms.

## Information, not advice
Content, calculators and assessment reports are general information and estimates. They are not legal, tax, financial or medical advice and do not guarantee results. Illustrative examples are labelled as such.

## Prices
Prices marked "from" or "indicative" are starting points. Your written quotation sets the actual price and scope.

## Acceptable behaviour
Do not misuse the site, attempt to access accounts or data that are not yours, or submit unlawful content.

## Liability
To the extent permitted by law, we are not liable for losses arising from reliance on general website content. Client engagements are governed by their own contracts.

## Governing law
These terms are governed by the laws of Kenya.`,
  },
  cookies: {
    title: "Cookie notice",
    updated: "28 October 2026",
    body: `## Essential cookies
We use a small number of essential cookies to keep you signed in (client portal and console) and to remember your assessment progress. These do not require consent.

## Analytics
We use privacy-respecting analytics only after you consent. You can change your choice at any time.

## Marketing cookies
We do not use third-party advertising cookies on this website.`,
  },
  dpa: {
    title: "Data processing terms (summary)",
    updated: "28 October 2026",
    body: `## Roles
When Elans runs automations for a client, the client is the data controller and Elans is the data processor.

## Our commitments
- Process personal data only on documented instructions
- Confidentiality obligations for everyone with access
- Security measures described on our Trust page, including tenant isolation, encryption and access controls
- Assist with data-subject requests and impact assessments
- Notify the client without undue delay, and within the time needed to meet the 72-hour ODPC requirement, of any personal data breach
- Delete or return data at the end of the engagement
- Never use client data to train AI models
- Maintain a list of sub-processors and notify changes

## International transfers
Transfers outside Kenya are documented, with safeguards and the data region recorded per client account. Health and public-sector data are assessed for in-country requirements before onboarding.

The full agreement is provided with each proposal.`,
  },
  "acceptable-use": {
    title: "Acceptable use policy",
    updated: "28 October 2026",
    body: `Clients may not use Elans automations or agents to:
- Send messages to people without a lawful basis, or ignore opt-outs
- Harass, threaten or deceive customers, including in debt collection, or contact third parties about a debt
- Make automated clinical, legal, credit, hiring or dismissal decisions without human review
- Impersonate people or organisations, or generate a real person's likeness without written consent
- Process data unlawfully or for discriminatory purposes

We may suspend automations that breach this policy, using the kill switch, and will explain why.`,
  },
};
