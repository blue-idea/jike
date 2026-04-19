-- Baseline fragment (task 5). Do not reorder without adjusting downstream.

-- ---------------------------------------------------------------------------
-- RPC: 附近候选 + 球面距离（米）；SECURITY INVOKER，继承调用者 RLS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_pois(
  ref_lng double precision,
  ref_lat double precision,
  radius_m double precision DEFAULT 5000
)
RETURNS TABLE (
  poi_type text,
  id uuid,
  name text,
  lng double precision,
  lat double precision,
  distance_m double precision,
  province text,
  label text,
  recommend text,
  sort integer,
  rec_prio integer,
  images text[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT
      'scenic'::text AS poi_type,
      s.id,
      s.name,
      s.lng,
      s.lat,
      s.province,
      s.level AS label,
      s.recommend,
      s.sort,
      s.images,
      CASE WHEN s.recommend IS NULL OR btrim(s.recommend) = '' THEN 1 ELSE 0 END AS rec_prio,
      (
        6371000 * acos(
          least(
            1::double precision,
            greatest(
              -1::double precision,
              cos(radians(ref_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(ref_lng))
                + sin(radians(ref_lat)) * sin(radians(s.lat))
            )
          )
        )
      ) AS distance_m
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
      h.province,
      coalesce(h.batch, h.heritage_type) AS label,
      h.recommend,
      h.sort,
      h.images,
      CASE WHEN h.recommend IS NULL OR btrim(h.recommend) = '' THEN 1 ELSE 0 END,
      (
        6371000 * acos(
          least(
            1::double precision,
            greatest(
              -1::double precision,
              cos(radians(ref_lat)) * cos(radians(h.lat)) * cos(radians(h.lng) - radians(ref_lng))
                + sin(radians(ref_lat)) * sin(radians(h.lat))
            )
          )
        )
      )
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
      m.province,
      m.quality_level,
      m.recommend,
      m.sort,
      m.images,
      CASE WHEN m.recommend IS NULL OR btrim(m.recommend) = '' THEN 1 ELSE 0 END,
      (
        6371000 * acos(
          least(
            1::double precision,
            greatest(
              -1::double precision,
              cos(radians(ref_lat)) * cos(radians(m.lat)) * cos(radians(m.lng) - radians(ref_lng))
                + sin(radians(ref_lat)) * sin(radians(m.lat))
            )
          )
        )
      )
    FROM public.catalog_museums m
    WHERE m.lng IS NOT NULL
      AND m.lat IS NOT NULL
  )
  SELECT
    c.poi_type,
    c.id,
    c.name,
    c.lng,
    c.lat,
    c.distance_m,
    c.province,
    c.label,
    c.recommend,
    c.sort,
    c.rec_prio,
    c.images
  FROM candidates c
  WHERE c.distance_m <= radius_m
  ORDER BY c.rec_prio ASC, c.sort ASC NULLS LAST, c.distance_m ASC;
$$;
