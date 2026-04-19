-- Baseline: read-only view, nearby RPC, RLS, grants (task 5 / requirements 16, data.md 3.1)

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
  s.sort
FROM public.catalog_scenic_spots s
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
  h.sort
FROM public.catalog_heritage_sites h
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
  m.sort
FROM public.catalog_museums m;

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
  rec_prio integer
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
    c.rec_prio
  FROM candidates c
  WHERE c.distance_m <= radius_m
  ORDER BY c.rec_prio ASC, c.sort ASC NULLS LAST, c.distance_m ASC;
$$;

ALTER TABLE public.catalog_scenic_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_heritage_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_museums ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalog_scenic_spots_select_authenticated
  ON public.catalog_scenic_spots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY catalog_heritage_sites_select_authenticated
  ON public.catalog_heritage_sites
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY catalog_museums_select_authenticated
  ON public.catalog_museums
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_travel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievement_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_collection_select_own
  ON public.user_collection FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_collection_insert_own
  ON public.user_collection FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_collection_update_own
  ON public.user_collection FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_collection_delete_own
  ON public.user_collection FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_check_ins_select_own
  ON public.user_check_ins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_check_ins_insert_own
  ON public.user_check_ins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_check_ins_update_own
  ON public.user_check_ins FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_check_ins_delete_own
  ON public.user_check_ins FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_journey_select_own
  ON public.user_journey FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_journey_insert_own
  ON public.user_journey FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_journey_update_own
  ON public.user_journey FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_journey_delete_own
  ON public.user_journey FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_travel_logs_select_own
  ON public.user_travel_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_travel_logs_insert_own
  ON public.user_travel_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_travel_logs_update_own
  ON public.user_travel_logs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_travel_logs_delete_own
  ON public.user_travel_logs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_achievement_state_select_own
  ON public.user_achievement_state FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY user_achievement_state_insert_own
  ON public.user_achievement_state FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_achievement_state_update_own
  ON public.user_achievement_state FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY user_achievement_state_delete_own
  ON public.user_achievement_state FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_config_select_authenticated
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.catalog_scenic_spots FROM PUBLIC;
REVOKE ALL ON public.catalog_heritage_sites FROM PUBLIC;
REVOKE ALL ON public.catalog_museums FROM PUBLIC;
REVOKE ALL ON public.user_collection FROM PUBLIC;
REVOKE ALL ON public.user_check_ins FROM PUBLIC;
REVOKE ALL ON public.user_journey FROM PUBLIC;
REVOKE ALL ON public.user_travel_logs FROM PUBLIC;
REVOKE ALL ON public.user_achievement_state FROM PUBLIC;
REVOKE ALL ON public.app_config FROM PUBLIC;

GRANT SELECT ON public.catalog_scenic_spots TO authenticated;
GRANT SELECT ON public.catalog_heritage_sites TO authenticated;
GRANT SELECT ON public.catalog_museums TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_collection TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_check_ins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_journey TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_travel_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_achievement_state TO authenticated;

GRANT SELECT ON public.app_config TO authenticated;

GRANT SELECT ON public.catalog_poi_nearby TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_pois(double precision, double precision, double precision) TO authenticated;

GRANT ALL ON public.catalog_scenic_spots TO service_role;
GRANT ALL ON public.catalog_heritage_sites TO service_role;
GRANT ALL ON public.catalog_museums TO service_role;
GRANT ALL ON public.app_config TO service_role;
GRANT ALL ON public.user_collection TO service_role;
GRANT ALL ON public.user_check_ins TO service_role;
GRANT ALL ON public.user_journey TO service_role;
GRANT ALL ON public.user_travel_logs TO service_role;
GRANT ALL ON public.user_achievement_state TO service_role;
GRANT SELECT ON public.catalog_poi_nearby TO service_role;
GRANT EXECUTE ON FUNCTION public.nearby_pois(double precision, double precision, double precision) TO service_role;
