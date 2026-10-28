"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

export function ThemeToggle({ current }: { current: "light" | "dark" }) {
  const router = useRouter();
  const next = current === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => {
        document.cookie = `elans_theme=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-heading"
    >
      <Icon name={current === "dark" ? "spark" : "eye"} size={17} />
    </button>
  );
}
