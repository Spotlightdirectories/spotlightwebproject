"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Returns null while checking, then true if the visitor is logged in AND has a
// vendor account, otherwise false. Used to keep the launch-offer advert off the
// public pages for existing vendors (they see it from their dashboard instead).
export function useIsLoggedInVendor(): boolean | null {
  const [isVendor, setIsVendor] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (!cancelled) setIsVendor(false); return; }
        const { data: vendor } = await supabase
          .from("vendors")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();
        if (!cancelled) setIsVendor(!!vendor);
      } catch {
        if (!cancelled) setIsVendor(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return isVendor;
}
