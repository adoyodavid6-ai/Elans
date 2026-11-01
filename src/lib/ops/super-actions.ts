import "server-only";
import type { SessionUser } from "@/lib/auth";
import { asStaff } from "@/lib/ops/data";
import { audit } from "@/lib/audit";
import { INTERNAL_TENANT_ID } from "@/lib/db";
import { invalidateContent } from "@/lib/content";

/** The super admin's email (configurable; the default is the owner's account). */
export const superAdminEmail = () => (process.env.ELANS_SUPER_ADMIN_EMAIL || "adoyodavid6@gmail.com").trim().toLowerCase();

/** Super-admin actions that an admin's request can trigger with one "Approve & do it" click. */
export const PERFORMABLE = ["invoice.paid", "invoice.void", "invoice.issued", "document.void", "content.publish", "partner.workspace", "booking.confirm"];

export async function performSuperAction(u: SessionUser, kind: string, p: Record<string, any>): Promise<{ ok: boolean; message: string }> {
  try {
    if (kind.startsWith("invoice.")) {
      const status = kind.slice(8);
      await asStaff(u, (tx) => tx`select ops_set_invoice_status(${p.invoiceId}, ${status}, ${`Elans · ${u.name}`})`);
      return { ok: true, message: `invoice ${status === "issued" ? "reopened" : status === "paid" ? "marked paid" : "voided"}` };
    }
    if (kind === "document.void") {
      await asStaff(u, async (tx) => {
        await tx`update issued_documents set status = 'void', updated_at = now() where id = ${p.documentId} and status in ('issued','accepted','draft')`;
        await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "document.voided", entity: "issued_document", entityId: p.documentId });
      });
      return { ok: true, message: "document voided" };
    }
    if (kind === "content.publish") {
      await asStaff(u, async (tx) => {
        if (p.data && typeof p.data === "object") {
          // Apply the admin's proposed edit, keeping the current version as a revision.
          const [cur] = await tx<{ data: unknown; version: number }[]>`select data, version from content_items where type = ${p.type} and slug = ${p.slug}`;
          if (cur) await tx`insert into content_revisions (type, slug, version, data, created_by) values (${p.type}, ${p.slug}, ${cur.version}, ${tx.json(cur.data as never)}, ${u.email})`;
          await tx`update content_items set data = ${tx.json(p.data as never)}, edited = true, version = version + 1, publish_state = 'published', updated_at = now(), updated_by = ${u.email} where type = ${p.type} and slug = ${p.slug}`;
        } else {
          await tx`update content_items set publish_state = 'published', updated_at = now(), updated_by = ${u.email} where type = ${p.type} and slug = ${p.slug}`;
        }
        await audit(tx, { tenantId: INTERNAL_TENANT_ID, actorId: u.id, actorLabel: u.email, action: "content.published", entity: p.type, entityId: p.slug });
      });
      invalidateContent();
      return { ok: true, message: "content published" };
    }
    if (kind === "booking.confirm") {
      const { setBookingStatus } = await import("@/app/ops/actions");
      await setBookingStatus(p.bookingId, "confirmed");
      return { ok: true, message: "session confirmed" };
    }
    if (kind === "partner.workspace") {
      const { createPartnerWorkspace } = await import("@/app/ops/console-actions");
      await createPartnerWorkspace(p.partnerId);
      return { ok: true, message: "partner workspace created" };
    }
    return { ok: false, message: "unknown action" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
