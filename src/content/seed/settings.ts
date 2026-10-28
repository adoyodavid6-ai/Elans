/**
 * Site-wide settings. Unconfirmed values keep their {{TOKEN}} and are listed in PLACEHOLDERS.md.
 * Editable in the ops console (Settings) once the database is connected.
 */
export interface SiteSettings {
  brand: string;
  descriptor: string;
  tagline: string;
  domain: string; // {{DOMAIN}}
  legalEntity: string | null;
  registrationNo: string | null;
  odpcRegistration: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  supportHours: string;
  supportHoursConfirmed: boolean;
  marketScope: string;
  caseStudyDate: string | null;
  defaultCurrency: string;
  discoveryCallFree: boolean;
  marginFloor: number; // fraction
  minTermMonths: number;
}

export const defaultSettings: SiteSettings = {
  brand: "Elans",
  descriptor: "Elans — AI Automation & Growth",
  tagline: "Intelligent Systems. Measurable Results.",
  domain: "{{DOMAIN}}",
  legalEntity: null,
  registrationNo: null,
  odpcRegistration: null,
  email: null,
  phone: null,
  whatsapp: null,
  address: "Nairobi, Kenya",
  supportHours: "Monday–Friday, 08:00–18:00 EAT",
  supportHoursConfirmed: false,
  marketScope: "Launching in Kenya, serving East Africa, built for international clients.",
  caseStudyDate: null,
  defaultCurrency: "KES",
  discoveryCallFree: true,
  marginFloor: 0.65,
  minTermMonths: 6,
};
