"use client";

// ===============================================================
// src/components/AccountButton.tsx
//
// Top-right account control for the focused, standalone pages that
// bring their own header (Discover, Discover Results) and so don't
// get the main site Navbar.
//  - Logged out: a "Log In" link (customer login, since these are
//    shopper-facing pages).
//  - Logged in: the user's picture (vendor logo, or gold initials);
//    clicking opens a dropdown with their dashboard link(s) and
//    Log Out. Same behaviour as the main Navbar and the app.
// Login is saved in the browser and only ends on Log Out.
// ===============================================================

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import styles from "./AccountButton.module.css";

export default function AccountButton({ placement = "auto" }: { placement?: "auto" | "absolute" }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [isCustomer, setIsCustomer] = useState(false);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function resolveIdentity(userId: string | undefined) {
      if (!userId) {
        setLoggedIn(false); setIsVendor(false); setIsCustomer(false); setName(""); setLogo(null);
        return;
      }
      setLoggedIn(true);
      const [{ data: vendor }, { data: customer }] = await Promise.all([
        supabase.from("vendors").select("id, name, logo_url").eq("auth_user_id", userId).maybeSingle(),
        supabase.from("customers").select("id, name").eq("auth_user_id", userId).maybeSingle(),
      ]);
      setIsVendor(!!vendor);
      setIsCustomer(!!customer);
      setName(vendor?.name || customer?.name || "My account");
      setLogo(vendor?.logo_url || null);
    }

    supabase.auth.getSession().then(({ data: { session } }) => resolveIdentity(session?.user.id));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveIdentity(session?.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await supabase.auth.signOut();
  }

  const slot = placement === "absolute" ? styles.slotAbsolute : styles.slotAuto;

  if (!loggedIn) {
    return (
      <div className={slot}>
        <Link href="/customer-login" className={styles.loginLink}>Log In</Link>
      </div>
    );
  }

  const initials =
    name.trim().split(/\s+/).map(p => p.charAt(0)).join("").substring(0, 2).toUpperCase() || "?";

  return (
    <div className={slot} ref={wrapRef}>
      <button
        type="button"
        className={styles.avatarBtn}
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" />
        ) : (
          <span>{initials}</span>
        )}
      </button>
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelName}>{name}</div>
          {isVendor && (
            <Link href="/vendordashboard" onClick={() => setOpen(false)}>
              <i className="fa-solid fa-gauge"></i> Vendor Dashboard
            </Link>
          )}
          {isCustomer && (
            <Link href="/customer-profile" onClick={() => setOpen(false)}>
              <i className="fa-solid fa-user"></i> My Account
            </Link>
          )}
          <button type="button" className={styles.logout} onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket"></i> Log Out
          </button>
        </div>
      )}
    </div>
  );
}
