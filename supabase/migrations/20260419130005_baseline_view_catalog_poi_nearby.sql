-- Baseline fragment (task 5). Do not reorder without adjusting downstream.


-- ---------------------------------------------------------------------------
-- Read-only union view: rows eligible for「附近」类展示（有坐标；景区仅 4A/5A）
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.catalog_poi_nearby AS
SELECT
  'scenic'::text AS poi_type,
  s.id,
  s.name,
  s.lng,
  s.lat,
  s.level AS label,
  s.province,
  s.recommend,
  s.sort,
  s.images
FROM public.catalog_scenic_spots s
WHERE s.lng IS NOT NULL
  AND s.lat IS NOT NULL
  AND s.level IN ('4A', '5A')
UNION ALL
SELECT
  'heritage'::text,
  h.id,
  h.name,
  h.lng,
  h.lat,
  coalesce(h.batch, h.heritage_type) AS label,
  h.province,
  h.recommend,
  h.sort,
  h.images
FROM public.catalog_heritage_sites h
WHERE h.lng IS NOT NULL
  AND h.lat IS NOT NULL
UNION ALL
SELECT
  'museum'::text,
  m.id,
  m.name,
  m.lng,
  m.lat,
  m.quality_level AS label,
  m.province,
  m.recommend,
  m.sort,
  m.images
FROM public.catalog_museums m
WHERE m.lng IS NOT NULL
  AND m.lat IS NOT NULL;
