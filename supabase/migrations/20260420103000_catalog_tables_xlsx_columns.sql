-- 集刻 public 业务架构（单文件可对照执行）：
--   · set_current_timestamp_updated_at
--   · 名录三表（列与 docs/data xlsx 一致）+ catalog_poi_nearby + nearby_pois
--   · user_collection / user_check_ins / user_journey / user_travel_logs / user_achievement_state / app_config
--   · 索引、updated_at 触发器、RLS、GRANT
-- 依赖：Supabase 已启用 Auth（存在 auth.users）。
-- 名录导入：pnpm run data:catalog-import -- --replace
--
-- 说明：若此前已应用 20260419130007/30008 中的同名策略，本文件对用户域策略使用 DROP POLICY IF EXISTS 后再建，避免重复执行冲突。

-- ---------------------------------------------------------------------------
-- 触发器：updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 名录：删除旧对象并重建（xlsx 对齐列）
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.catalog_poi_nearby CASCADE;

DROP FUNCTION IF EXISTS public.nearby_pois(double precision, double precision, double precision) CASCADE;

DROP TABLE IF EXISTS public.catalog_museums CASCADE;
DROP TABLE IF EXISTS public.catalog_heritage_sites CASCADE;
DROP TABLE IF EXISTS public.catalog_scenic_spots CASCADE;

CREATE TABLE public.catalog_scenic_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rating text,
  address text,
  provincial text,
  city text,
  full_address text,
  lng_wgs84 double precision,
  lat_wgs84 double precision,
  recommend text,
  sort integer,
  images text[]
);

CREATE TABLE public.catalog_heritage_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  category text,
  era text,
  batch text,
  address_1 text,
  provincial text,
  city text,
  county text,
  longitude double precision,
  latitude double precision,
  recommend text,
  sort integer,
  images text[]
);

CREATE TABLE public.catalog_museums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  tel text,
  pname text,
  cityname text,
  adname text,
  lng double precision,
  lat double precision,
  recommend text,
  sort integer,
  images text[]
);

CREATE INDEX catalog_scenic_spots_provincial_idx ON public.catalog_scenic_spots (provincial);
CREATE INDEX catalog_scenic_spots_rating_idx ON public.catalog_scenic_spots (rating);
CREATE INDEX catalog_scenic_spots_lng_lat_idx ON public.catalog_scenic_spots (lng_wgs84, lat_wgs84);

CREATE INDEX catalog_heritage_sites_provincial_idx ON public.catalog_heritage_sites (provincial);
CREATE INDEX catalog_heritage_sites_lng_lat_idx ON public.catalog_heritage_sites (longitude, latitude);
CREATE INDEX catalog_heritage_sites_name_idx ON public.catalog_heritage_sites (name);

CREATE INDEX catalog_museums_pname_idx ON public.catalog_museums (pname);
CREATE INDEX catalog_museums_lng_lat_idx ON public.catalog_museums (lng, lat);

CREATE OR REPLACE VIEW public.catalog_poi_nearby AS
SELECT
  'scenic'::text AS poi_type,
  s.id,
  s.name,
  s.lng_wgs84 AS lng,
  s.lat_wgs84 AS lat,
  btrim(s.rating) AS label,
  s.provincial AS province,
  s.recommend,
  s.sort,
  s.images
FROM public.catalog_scenic_spots s
WHERE s.lng_wgs84 IS NOT NULL
  AND s.lat_wgs84 IS NOT NULL
  AND btrim(replace(coalesce(s.rating, ''), ' ', '')) IN ('4A', '5A')
UNION ALL
SELECT
  'heritage'::text,
  h.id,
  h.name,
  h.longitude AS lng,
  h.latitude AS lat,
  coalesce(h.batch, h.category) AS label,
  h.provincial AS province,
  h.recommend,
  h.sort,
  h.images
FROM public.catalog_heritage_sites h
WHERE h.longitude IS NOT NULL
  AND h.latitude IS NOT NULL
UNION ALL
SELECT
  'museum'::text,
  m.id,
  m.name,
  m.lng,
  m.lat,
  nullif(btrim(m.adname), '') AS label,
  m.pname AS province,
  m.recommend,
  m.sort,
  m.images
FROM public.catalog_museums m
WHERE m.lng IS NOT NULL
  AND m.lat IS NOT NULL;

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
      s.lng_wgs84 AS lng,
      s.lat_wgs84 AS lat,
      s.provincial AS province,
      btrim(s.rating) AS label,
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
              cos(radians(ref_lat)) * cos(radians(s.lat_wgs84)) * cos(radians(s.lng_wgs84) - radians(ref_lng))
                + sin(radians(ref_lat)) * sin(radians(s.lat_wgs84))
            )
          )
        )
      ) AS distance_m
    FROM public.catalog_scenic_spots s
    WHERE s.lng_wgs84 IS NOT NULL
      AND s.lat_wgs84 IS NOT NULL
      AND btrim(replace(coalesce(s.rating, ''), ' ', '')) IN ('4A', '5A')
    UNION ALL
    SELECT
      'heritage'::text,
      h.id,
      h.name,
      h.longitude,
      h.latitude,
      h.provincial,
      coalesce(h.batch, h.category) AS label,
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
              cos(radians(ref_lat)) * cos(radians(h.latitude)) * cos(radians(h.longitude) - radians(ref_lng))
                + sin(radians(ref_lat)) * sin(radians(h.latitude))
            )
          )
        )
      )
    FROM public.catalog_heritage_sites h
    WHERE h.longitude IS NOT NULL
      AND h.latitude IS NOT NULL
    UNION ALL
    SELECT
      'museum'::text,
      m.id,
      m.name,
      m.lng,
      m.lat,
      m.pname,
      nullif(btrim(m.adname), ''),
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

-- ---------------------------------------------------------------------------
-- 用户与全局配置表（与 20260419130003 一致；IF NOT EXISTS 便于与前置碎片迁移共存）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('favorite', 'want_to_go', 'visited')),
  poi_type text NOT NULL CHECK (poi_type IN ('scenic', 'heritage', 'museum')),
  poi_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_collection_user_poi_unique UNIQUE (user_id, kind, poi_type, poi_id)
);

CREATE TABLE IF NOT EXISTS public.user_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  poi_type text NOT NULL CHECK (poi_type IN ('scenic', 'heritage', 'museum')),
  poi_id uuid NOT NULL,
  lng double precision,
  lat double precision,
  checked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  double_confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_journey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text,
  status text NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_travel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_achievement_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rules_version integer NOT NULL DEFAULT 1,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_achievement_state_user_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS user_collection_user_id_idx ON public.user_collection (user_id);
CREATE INDEX IF NOT EXISTS user_check_ins_user_id_idx ON public.user_check_ins (user_id);
CREATE INDEX IF NOT EXISTS user_journey_user_id_idx ON public.user_journey (user_id);
CREATE INDEX IF NOT EXISTS user_travel_logs_user_id_idx ON public.user_travel_logs (user_id);

DROP TRIGGER IF EXISTS set_user_collection_updated_at ON public.user_collection;
CREATE TRIGGER set_user_collection_updated_at
  BEFORE UPDATE ON public.user_collection
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_user_check_ins_updated_at ON public.user_check_ins;
CREATE TRIGGER set_user_check_ins_updated_at
  BEFORE UPDATE ON public.user_check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_user_journey_updated_at ON public.user_journey;
CREATE TRIGGER set_user_journey_updated_at
  BEFORE UPDATE ON public.user_journey
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_user_travel_logs_updated_at ON public.user_travel_logs;
CREATE TRIGGER set_user_travel_logs_updated_at
  BEFORE UPDATE ON public.user_travel_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_user_achievement_state_updated_at ON public.user_achievement_state;
CREATE TRIGGER set_user_achievement_state_updated_at
  BEFORE UPDATE ON public.user_achievement_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS set_app_config_updated_at ON public.app_config;
CREATE TRIGGER set_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ---------------------------------------------------------------------------
-- RLS：名录 + 用户表 + app_config
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalog_scenic_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_heritage_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_museums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_travel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievement_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_scenic_spots_select_authenticated ON public.catalog_scenic_spots;
CREATE POLICY catalog_scenic_spots_select_authenticated
  ON public.catalog_scenic_spots FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS catalog_heritage_sites_select_authenticated ON public.catalog_heritage_sites;
CREATE POLICY catalog_heritage_sites_select_authenticated
  ON public.catalog_heritage_sites FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS catalog_museums_select_authenticated ON public.catalog_museums;
CREATE POLICY catalog_museums_select_authenticated
  ON public.catalog_museums FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS user_collection_select_own ON public.user_collection;
DROP POLICY IF EXISTS user_collection_insert_own ON public.user_collection;
DROP POLICY IF EXISTS user_collection_update_own ON public.user_collection;
DROP POLICY IF EXISTS user_collection_delete_own ON public.user_collection;
CREATE POLICY user_collection_select_own
  ON public.user_collection FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_collection_insert_own
  ON public.user_collection FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_collection_update_own
  ON public.user_collection FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_collection_delete_own
  ON public.user_collection FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_check_ins_select_own ON public.user_check_ins;
DROP POLICY IF EXISTS user_check_ins_insert_own ON public.user_check_ins;
DROP POLICY IF EXISTS user_check_ins_update_own ON public.user_check_ins;
DROP POLICY IF EXISTS user_check_ins_delete_own ON public.user_check_ins;
CREATE POLICY user_check_ins_select_own
  ON public.user_check_ins FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_check_ins_insert_own
  ON public.user_check_ins FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_check_ins_update_own
  ON public.user_check_ins FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_check_ins_delete_own
  ON public.user_check_ins FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_journey_select_own ON public.user_journey;
DROP POLICY IF EXISTS user_journey_insert_own ON public.user_journey;
DROP POLICY IF EXISTS user_journey_update_own ON public.user_journey;
DROP POLICY IF EXISTS user_journey_delete_own ON public.user_journey;
CREATE POLICY user_journey_select_own
  ON public.user_journey FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_journey_insert_own
  ON public.user_journey FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_journey_update_own
  ON public.user_journey FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_journey_delete_own
  ON public.user_journey FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_travel_logs_select_own ON public.user_travel_logs;
DROP POLICY IF EXISTS user_travel_logs_insert_own ON public.user_travel_logs;
DROP POLICY IF EXISTS user_travel_logs_update_own ON public.user_travel_logs;
DROP POLICY IF EXISTS user_travel_logs_delete_own ON public.user_travel_logs;
CREATE POLICY user_travel_logs_select_own
  ON public.user_travel_logs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_travel_logs_insert_own
  ON public.user_travel_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_travel_logs_update_own
  ON public.user_travel_logs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_travel_logs_delete_own
  ON public.user_travel_logs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS user_achievement_state_select_own ON public.user_achievement_state;
DROP POLICY IF EXISTS user_achievement_state_insert_own ON public.user_achievement_state;
DROP POLICY IF EXISTS user_achievement_state_update_own ON public.user_achievement_state;
DROP POLICY IF EXISTS user_achievement_state_delete_own ON public.user_achievement_state;
CREATE POLICY user_achievement_state_select_own
  ON public.user_achievement_state FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY user_achievement_state_insert_own
  ON public.user_achievement_state FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_achievement_state_update_own
  ON public.user_achievement_state FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY user_achievement_state_delete_own
  ON public.user_achievement_state FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS app_config_select_authenticated ON public.app_config;
CREATE POLICY app_config_select_authenticated
  ON public.app_config FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- GRANT（与 20260419130009 一致）
-- ---------------------------------------------------------------------------
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
