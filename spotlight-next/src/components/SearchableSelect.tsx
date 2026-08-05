"use client";

// ===============================================================
// src/components/SearchableSelect.tsx
//
// A single reusable "searchable dropdown" used everywhere a vendor
// or customer has to pick a category/subcategory — Products tab,
// Services tab, Discover filters, Discover Results filters, and the
// Marketplace Ranking "Change Category" modal.
//
// Why this exists: with the new taxonomy, some of these lists run to
// 90-180 categories or 40-70 subcategories. A plain <select> makes
// someone scroll through a giant native dropdown to find one entry.
// This renders as a text box with a visible magnifying-glass icon —
// clicking it opens a real text input you can type into, which
// filters the option list live, so it's obvious at a glance that you
// can search instead of just scroll.
//
// Deliberately dependency-free (no external combobox library) so it
// drops into any existing page without adding a new package. Options
// can be individually marked `disabled` with their own label (used by
// ServicesTab to show "(already added)" subcategories as picked-but-
// unselectable, matching its existing behavior with plain <select>).
// ===============================================================

import { useEffect, useRef, useState } from "react";
import styles from "./SearchableSelect.module.css";

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Type to search...",
  emptyMessage = "No matches found",
  disabled = false,
  className = "",
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const selected = options.find((o) => o.value === value) || null;

  // Close on outside click — the panel is absolutely positioned, so a
  // click anywhere else on the page needs to dismiss it.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // Focus the search box the instant the panel opens, so typing works
  // immediately without an extra click.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      setHighlightIndex(0);
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    optionRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  function selectOption(opt: SearchableSelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlightIndex];
      if (opt) selectOption(opt);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div className={`${styles.wrap} ${className}`} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className={`${styles.control} ${open ? styles.controlOpen : ""} ${disabled ? styles.disabled : ""}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <i className={`fa-solid fa-magnifying-glass ${styles.icon}`} aria-hidden="true" />
        <span className={selected ? styles.valueText : styles.placeholderText}>
          {selected ? selected.label : placeholder}
        </span>
        <i className={`fa-solid fa-chevron-down ${styles.chevron} ${open ? styles.chevronOpen : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <div className={styles.panel} role="listbox">
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className={styles.optionsList}>
            {filtered.length === 0 && <div className={styles.emptyState}>{emptyMessage}</div>}
            {filtered.map((opt, i) => (
              <div
                key={opt.value}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                role="option"
                aria-selected={opt.value === value}
                className={[
                  styles.option,
                  opt.disabled ? styles.optionDisabled : "",
                  i === highlightIndex ? styles.optionHighlighted : "",
                  opt.value === value ? styles.optionSelected : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                // Prevent the search input from blurring (which would
                // close the panel via the outside-click handler) before
                // the click's onClick actually fires.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(opt)}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <span>{opt.label}</span>
                {opt.value === value && <i className={`fa-solid fa-check ${styles.checkIcon}`} aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
