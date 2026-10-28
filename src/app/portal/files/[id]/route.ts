import { NextResponse } from "next/server";
import { portal } from "@/lib/portal";
import { audit } from "@/lib/audit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const c = await portal();
  const doc = await c.db(async (tx) => {
    const [d] = await tx<{ name: string; mime: string | null; content: Buffer | null }[]>`select name, mime, content from documents where id = ${id}`;
    if (d) await audit(tx, { tenantId: c.tenantId, actorId: c.user.id, actorLabel: c.user.name, action: "document.downloaded", entity: "document", entityId: id });
    return d;
  });
  if (!doc?.content) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(doc.content), {
    headers: {
      "content-type": doc.mime ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${doc.name.replace(/[^\w.\- ]/g, "_")}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
