"use client";

import { useEffect, useState } from "react";
import { isAnalyticsOptedOut, setAnalyticsOptOut } from "@/lib/analytics";

// Lets a visitor switch off the anonymous visitor code + approximate
// location on this browser. Shown on the Privacy Policy page.
export default function AnalyticsChoice() {
  const [off, setOff] = useState(false);
  useEffect(() => { setOff(isAnalyticsOptedOut()); }, []);

  function toggle() {
    const next = !off;
    setAnalyticsOptOut(next);
    setOff(next);
  }

  return (
    <div id="analytics-choice" style={{ scrollMarginTop: 80, border: "1px solid var(--line, #ddd)", borderRadius: 10, padding: 16, margin: "12px 0" }}>
      <p style={{ margin: "0 0 10px" }}>
        <strong>Visitor analytics on this device: {off ? "OFF" : "ON"}</strong>
        <br />
        {off
          ? "We no longer attach an anonymous visitor code or approximate location to your activity on this browser."
          : "We attach a random visitor code and your approximate state to listing views and searches so businesses can see anonymous totals."}
      </p>
      <button type="button" onClick={toggle} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid currentColor", background: "transparent", cursor: "pointer", fontWeight: 600 }}>
        {off ? "Turn analytics back on" : "Turn analytics off"}
      </button>
    </div>
  );
}
