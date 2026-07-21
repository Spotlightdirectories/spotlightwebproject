"use client";

// ===============================================================
// src/components/ThemeProvider.tsx
//
// Ported from the original theme-toggle.js. Manages light/dark
// mode app-wide by setting data-theme="dark" on <html>, and
// remembers the choice in localStorage (same "spotlight-theme"
// key as the original, so behaviour is identical).
//
// Any component can read or flip the theme via the useTheme() hook.
// The no-flash-on-load script (in layout.tsx) applies the saved
// theme BEFORE the page paints, exactly like the original did.
// ===============================================================

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // On mount, read whatever the no-flash script already applied to
  // <html> so React's state matches the real DOM state.
  useEffect(() => {
    const current =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    setTheme(current);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (next === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      localStorage.setItem("spotlight-theme", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
