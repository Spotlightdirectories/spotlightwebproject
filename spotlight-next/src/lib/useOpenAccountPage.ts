"use client";

// Opens a dashboard page from the account menu without ever leaving the
// person wondering whether the click worked:
//  1. the pages are prepared in the background (prefetch),
//  2. the menu stays open and shows "Opening...", and
//  3. if the normal navigation has not finished after 4 seconds, the page
//     is loaded directly.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useOpenAccountPage(paths: string[]) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = paths.join("|");

  useEffect(() => {
    paths.forEach((p) => { try { router.prefetch(p); } catch { /* ignore */ } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, router]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const open = useCallback((e: React.MouseEvent, path: string) => {
    // Let the browser handle ctrl/cmd/shift/middle clicks (open in new tab).
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    if (opening) return;
    setOpening(path);
    router.push(path);
    timer.current = setTimeout(() => { window.location.assign(path); }, 4000);
  }, [opening, router]);

  return { opening, open };
}
