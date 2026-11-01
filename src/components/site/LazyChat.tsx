"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ChatWidget = dynamic(() => import("./ChatWidget").then((m) => m.ChatWidget), { ssr: false });

/** Loads the chat widget once the browser is idle, keeping it out of the first-load critical path. */
export function LazyChat() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const go = () => setReady(true);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 3000 });
    else setTimeout(go, 1500);
  }, []);
  return ready ? <ChatWidget /> : null;
}
