"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function PaymentPoller({ bookingId, testMode, message }: { bookingId: string; testMode: boolean; message: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);
  async function simulate(outcome: "success" | "fail") {
    setBusy(true);
    await fetch(`/api/payments/mock/${bookingId}?outcome=${outcome}`, { method: "POST" });
    router.refresh();
    setBusy(false);
  }
  return (
    <div className="space-y-4">
      <div role="status" className="flex items-center gap-3 rounded-2xl bg-sand/50 p-4 text-sm">
        <span className="h-3 w-3 animate-pulse rounded-full bg-copper" aria-hidden /> {message}
      </div>
      {testMode && (
        <div className="rounded-2xl border border-dashed border-warning/60 bg-warning-bg p-4 text-sm text-warning">
          <p className="font-semibold">Test mode: M-Pesa is not connected yet</p>
          <p className="mt-1">No money will be taken. Use these buttons to simulate the customer approving or declining the STK push.</p>
          <div className="mt-3 flex gap-2">
            <button disabled={busy} onClick={() => simulate("success")} className="rounded-full bg-success px-4 py-2 font-semibold text-white">Simulate approval</button>
            <button disabled={busy} onClick={() => simulate("fail")} className="rounded-full bg-white px-4 py-2 font-semibold text-danger ring-1 ring-danger/30">Simulate decline</button>
          </div>
        </div>
      )}
    </div>
  );
}
