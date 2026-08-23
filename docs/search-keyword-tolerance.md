# Search Keyword Matching — Full-Text Search (LIVE as of 2026-08-23)

## Current live system: Postgres full-text search + small backstop

`search_products`, `search_services`, `search_vendors` match keywords using
Postgres's built-in English dictionary/stemmer via a `search_vector` column on
each table (`vendor_products`, `vendor_services`, `vendors`) and a helper
function `to_prefix_tsquery(p_keyword)`.

**How it works:**
- `search_vector` is a `GENERATED ALWAYS ... STORED` column — Postgres computes
  and keeps it up to date automatically for every row, existing or future. No
  backfill script, no trigger to maintain.
- A GIN index on each `search_vector` keeps lookups fast as the catalog grows.
- `to_prefix_tsquery()` builds a dictionary-aware, prefix-matching query from
  what's typed (so "gener" while typing "Generator" still matches).
- A small backstop, using the `search_keyword_variants` table, corrects the
  rare words where Postgres's own stemmer falls short of the true root (see
  below). This is the ONLY thing that table is used for now.

**Why full-text search replaced the earlier hand-built rule system (same day):**
An earlier version of today's fix used a custom regex singular/plural rule.
That approach hit a real, unavoidable limitation: some English plurals are
ambiguous by spelling alone (`"gas"→"gases"` and `"case"→"cases"` both end in
identical "-ases"). Testing against the live catalog surfaced real false-
positive risks ("cases" matching "Cassava"/"Broadcasting"; "lens" matching
"Blenders"/"Silent Generator") before they reached production. Postgres's real
dictionary avoids this whole class of problem natively — confirmed via direct
testing against real catalog data before going live.

## The backstop, and why it's needed at all

Even the real dictionary isn't perfect for every word. Confirmed by direct
testing: Postgres stems "gases" to "gase" (not "gas") and "buses" to "buse"
(not "bus") — so someone searching the plural wouldn't find a listing that
only says the singular. `search_keyword_variants` corrects this for the
specific words already found: `boot/boots`, `gas/gases`, `glass/glasses`,
`bus/buses`, `aid/aids`.

**A real bug was caught and fixed while building this backstop (2026-08-23):**
the first version used prefix matching for the backstop's alternate word too,
which caused "buses" to also incorrectly match "**bus**iness" (since "bus" is
a literal prefix of "business"). Fixed by making the backstop's alternate word
match exactly, not as a prefix — confirmed via direct test before/after, and a
full regression pass (browsing counts, "safety boots", and the business false-
positive) after the fix.

**Adding a new backstop word later** — no code change, just a database row:
```sql
insert into search_keyword_variants (word, variant) values
  ('word', 'itsvariant'), ('itsvariant', 'word');
```
Test any new entry directly before trusting it — check both directions match
correctly AND that the exact-match backstop doesn't accidentally over-match
(the "business" lesson above).

## What's now fully unused (not yet deleted)

`get_keyword_search_patterns()` and `flip_word_number()` — the old ILIKE-based
approach's functions — are no longer called by anything. `search_keyword_variants`
IS still used (as the backstop above), so it stays either way.

**Do not delete the two unused functions until Cyril has tested real searches
on the live/Staging site and explicitly confirms it's safe to clean up.**

```sql
drop function if exists get_keyword_search_patterns(text);
drop function if exists flip_word_number(text);
```

## Known behavior change to be aware of

Matches by whole word/root, not raw substring. "boo" matches "Boot" or "Book"
(via prefix matching on real words), not an arbitrary fragment hidden inside
an unrelated compound word — this is what fixed the false-positive class of
problem above, and is intentional.
