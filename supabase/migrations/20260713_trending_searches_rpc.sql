-- ===============================================================
-- Migration: trending_searches_rpc
--
-- Replaces the hardcoded 50-keyword trending searches list on
-- discover.html with real data from actual searches performed on
-- the platform (analytics_events.search_keyword). Normalizes case
-- so "Video Editor" / "video editor" / "VIDEO EDITOR" all count as
-- the same search instead of fragmenting into separate entries.
-- ===============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_trending_searches(
  p_limit integer DEFAULT 15
)
RETURNS TABLE (
  keyword text,
  search_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    INITCAP(LOWER(TRIM(search_keyword))) AS keyword,
    COUNT(*) AS search_count
  FROM analytics_events
  WHERE search_keyword IS NOT NULL
    AND TRIM(search_keyword) <> ''
  GROUP BY LOWER(TRIM(search_keyword))
  ORDER BY search_count DESC
  LIMIT p_limit;
$$;

COMMIT;
