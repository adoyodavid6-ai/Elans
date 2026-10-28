"use client";

import { useActionState } from "react";
import { addStaff } from "@/app/ops/team-actions";

const f = "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm";
export function AddStaffForm() {
  const [state, action, pending] = useActionState(addStaff, null as null | { ok: boolean; message: string });
  return (
    <form action={action} className="space-y-3">
      <input name="name" placeholder="Full name" aria-label="Full name" className={f} />
      <input name="email" type="email" placeholder="Email" aria-label="Email" className={f} />
      <select name="role" aria-label="Role" className={f} defaultValue="consultant">
        <option value="consultant">Consultant (sales & delivery)</option>
        <option value="engineer">Engineer</option>
        <option value="support">Support</option>
        <option value="content_editor">Content editor</option>
        <option value="admin">Admin</option>
      </select>
      {state && <p role="status" className={`rounded-lg p-2 text-sm ${state.ok ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>{state.message}</p>}
      <button disabled={pending} className="rounded-lg bg-brown px-4 py-2 text-sm font-semibold text-white">Add staff member</button>
    </form>
  );
}
