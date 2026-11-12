"use client";

// ===============================================================
// Vendor referral card (free vendors).
// Shows the vendor's own referral link and how many of the vendors
// they referred have fully onboarded. 5 fully onboarded vendors earns
// 6 months of Standard, approved by the Spotlight team.
// ===============================================================

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SITE_URL } from "@/lib/siteUrl";

type Progress = { code: string | null; signed_up: number; qualified: number; reward_granted: boolean; eligible_plan: boolean };

export default function ReferralCard() {
  const [p, setP] = useState<Progress | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("get_my_referral_progress").maybeSingle();
      if (alive && data) setP(data as Progress);
    })();
    return () => { alive = false; };
  }, []);

  if (!p || !p.code) return null;
  if (!p.eligible_plan && !p.reward_granted) return null; // paid vendors do not see this

  const link = `${SITE_URL}/getlisted?vref=${p.code}`;
  const shown = Math.min(p.qualified, 5);
  const waiting = Math.max(p.signed_up - p.qualified, 0);

  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="vd-card" style={{ marginBottom: 16 }}>
      <p className="vd-card-label">Invite vendors, earn Standard</p>
      {p.reward_granted ? (
        <p style={{ margin: "8px 0 0" }}>🎉 Your reward has been approved. Thank you for helping Spotlight grow.</p>
      ) : (
        <>
          <h3 style={{ margin: "6px 0" }}>{shown} of 5 fully onboarded</h3>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            Invite 5 vendors who complete all their onboarding steps and stay active for 30 days, and earn
            <strong> 6 months of the Standard plan free</strong>.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input readOnly value={link} className="vd-input" style={{ flex: 1, minWidth: 200 }} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="vd-trial-upgrade-btn" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          </div>
          {p.signed_up > 0 && (
            <p style={{ margin: "10px 0 0", fontSize: 13, opacity: 0.8 }}>
              {p.signed_up} signed up with your link{waiting > 0 ? `, ${waiting} still completing onboarding or within their first 30 days` : ""}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
