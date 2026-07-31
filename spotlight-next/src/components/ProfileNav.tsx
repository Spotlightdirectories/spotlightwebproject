"use client";

// ===============================================================
// src/components/ProfileNav.tsx
//
// Shared "Profile" bottom-nav button for discover.html and
// discover-results.html — faithful port of production's
// profile-nav.js (item 54).
//
// Behavior (matches Cyril's confirmed spec):
// - Logged out -> customer login (these are shopper-facing search
//   pages, so logged-out defaults to customer, not vendor).
// - Logged in as vendor only -> small menu: "Vendor Dashboard" +
//   "Set Up Customer Profile" (same email can hold both, no logout
//   needed to add the other).
// - Logged in as customer only -> straight to customer profile, no
//   menu needed, no ambiguity.
// - Logged in as both -> small menu: "Vendor Dashboard" + "Customer
//   Profile".
// ===============================================================

import { useState, useRef, useEffect } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./ProfileNav.module.css";

interface MenuOption {
  label: string;
  href: string;
  icon: string;
}

export default function ProfileNav({ buttonClassName }: { buttonClassName: string }) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuOptions, setMenuOptions] = useState<MenuOption[] | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!menuOptions) return;
    function handleOutside(e: MouseEvent) {
      const menu = document.getElementById("profileNavMenu");
      if (
        menu &&
        !menu.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setMenuOptions(null);
      }
    }
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [menuOptions]);

  async function handleClick() {
    setMenuOptions(null);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/customer-login");
      return;
    }

    const userId = session.user.id;

    const [{ data: vendorRow }, { data: customerRow }] = await Promise.all([
      supabase.from("vendors").select("id").eq("auth_user_id", userId).maybeSingle(),
      supabase.from("customers").select("id").eq("auth_user_id", userId).maybeSingle(),
    ]);

    const hasVendor = !!vendorRow;
    const hasCustomer = !!customerRow;

    if (hasCustomer && !hasVendor) {
      router.push("/customer-profile");
      return;
    }

    if (hasVendor && !hasCustomer) {
      openMenu([
        { label: "Vendor Dashboard", href: "/vendordashboard", icon: "fa-solid fa-store" },
        { label: "Set Up Customer Profile", href: "/customer-signup", icon: "fa-regular fa-user" },
      ]);
      return;
    }

    if (hasVendor && hasCustomer) {
      openMenu([
        { label: "Vendor Dashboard", href: "/vendordashboard", icon: "fa-solid fa-store" },
        { label: "Customer Profile", href: "/customer-profile", icon: "fa-regular fa-user" },
      ]);
      return;
    }

    // Neither profile exists yet despite having a session — safety
    // net, shouldn't normally happen since signup always creates one.
    router.push("/customer-login");
  }

  function openMenu(options: MenuOption[]) {
    const rect = btnRef.current?.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      left: rect ? Math.max(12, rect.left - 60) : 12,
      bottom: rect ? window.innerHeight - rect.top + 8 : 90,
    });
    setMenuOptions(options);
  }

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={buttonClassName}
        onClick={handleClick}
      >
        <i className="fa-regular fa-user"></i>
        <span>Profile</span>
      </button>

      {/* Rendered via a portal straight onto document.body — matching
          production's own document.body.appendChild(menu) — because
          the bottom nav's `transform: translateX(-50%)` makes it a
          new containing block for any position:fixed descendant, so
          a fixed menu nested inside it renders relative to the nav
          bar's box instead of the actual screen. */}
      {menuOptions && createPortal(
        <div id="profileNavMenu" className={styles.profileNavMenu} style={menuStyle}>
          {menuOptions.map(opt => (
            <button
              key={opt.href}
              type="button"
              className={styles.profileNavMenuItem}
              onClick={() => router.push(opt.href)}
            >
              <i className={opt.icon}></i> {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
