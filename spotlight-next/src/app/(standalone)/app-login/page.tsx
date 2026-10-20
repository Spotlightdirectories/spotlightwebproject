"use client";

// /app-login -- lets the Spotlight mobile app open a page here with the
// person already signed in. The app asks our backend (app-web-handoff)
// for a ONE-TIME sign-in token and opens this page with it. We exchange
// the token for a session and forward to the requested page. If anything
// is wrong (expired/used token, no token), the person simply lands on the
// normal login page, exactly as before.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Must match the backend's list: only these pages can be reached this way.
const ALLOWED_PATHS = ["/getsponsored", "/verify-badge", "/getlisted", "/payment", "/vendordashboard", "/dashboard-branches"];

function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  const path = next.split("?")[0].split("#")[0];
  return ALLOWED_PATHS.includes(path) ? next : null;
}

export default function AppLoginPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in\u2026");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const next = safeNext(params.get("next")) || "/vendordashboard";

    // Take the one-time token out of the address bar straight away.
    window.history.replaceState(null, "", "/app-login");

    async function run() {
      if (tokenHash) {
        // Supabase has used both names for this kind of token; try the current one first.
        const first = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
        let error = first.error;
        let second: string | null = null;
        if (error) {
          const r2 = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
          error = r2.error;
          second = r2.error ? r2.error.message : null;
        }
        if (!error) {
          // Make sure the session really is stored before moving on.
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            router.replace(next);
            return;
          }
          setMsg("We couldn't sign you in automatically. Taking you to the login page\u2026");
        } else {
          console.error("app-login failed:", first.error?.message, second);
          setMsg("We couldn't sign you in automatically. Taking you to the login page\u2026");
        }
      } else {
        setMsg("We couldn't sign you in automatically. Taking you to the login page\u2026");
      }
      // Brief pause so the message can be read before the login page appears.
      await new Promise((r) => setTimeout(r, 1500));
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
    run();
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <p style={{ padding: 24, textAlign: "center" }}>{msg}</p>
    </main>
  );
}
