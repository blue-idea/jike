-- Baseline DDL: catalog + user tables, indexes, updated_at triggers (task 5)

CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TABLE public.catalog_scenic_spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text,
  province text,
  address_code text,
  lng double precision,
  lat double precision,
  recommend text,
  sort integer,
  source_batch text NOT NULL DEFAULT '',
  data_version integer NOT NULL DEFAULT 1,
  imported_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.catalog_heritage_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_code text,
  address text,
  heritage_type text,
  era text,
  batch text,
  remark text,
  province text,
  city text,
  district text,
  lng double precision,
  lat double precision,
  search_name text,
  dynasty_tag text[],
  category_tag text[],
  recommend text,
  sort integer,
  source_batch text NOT NULL DEFAULT '',
  data_version integer NOT NULL DEFAULT 1,
  imported_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.catalog_museums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  province text,
  name text NOT NULL,
  quality_level text,
  museum_nature text,
  free_admission boolean,
  lng double precision,
  lat double precision,
  recommend text,
  sort integer,
  source_batch text NOT NULL DEFAULT '',
  data_version integer NOT NULL DEFAULT 1,
  imported_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX catalog_scenic_spots_province_idx ON public.catalog_scenic_spots (province);
CREATE INDEX catalog_scenic_spots_level_idx ON public.catalog_scenic_spots (level);
CREATE INDEX catalog_scenic_spots_lng_lat_idx ON public.catalog_scenic_spots (lng, lat);

CREATE INDEX catalog_heritage_sites_province_idx ON public.catalog_heritage_sites (province);
CREATE INDEX catalog_heritage_sites_search_name_idx ON public.catalog_heritage_sites (search_name);
CREATE INDEX catalog_heritage_sites_lng_lat_idx ON public.catalog_heritage_sites (lng, lat);

CREATE INDEX catalog_museums_province_idx ON public.catalog_museums (province);
CREATE INDEX catalog_museums_quality_level_idx ON public.catalog_museums (quality_level);
CREATE INDEX catalog_museums_lng_lat_idx ON public.catalog_museums (lng, lat);

CREATE TABLE public.user_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('favorite', 'want_to_go', 'visited')),
  poi_type text NOT NULL CHECK (poi_type IN ('scenic', 'heritage', 'museum')),
  poi_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_collection_user_poi_unique UNIQUE (user_id, kind, poi_type, poi_id)
);

CREATE TABLE public.user_check_ins (
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

CREATE TABLE public.user_journey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text,
  status text NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.user_travel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.user_achievement_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  rules_version integer NOT NULL DEFAULT 1,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_achievement_state_user_unique UNIQUE (user_id)
);

CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX user_collection_user_id_idx ON public.user_collection (user_id);
CREATE INDEX user_check_ins_user_id_idx ON public.user_check_ins (user_id);
CREATE INDEX user_journey_user_id_idx ON public.user_journey (user_id);
CREATE INDEX user_travel_logs_user_id_idx ON public.user_travel_logs (user_id);

CREATE TRIGGER set_user_collection_updated_at
  BEFORE UPDATE ON public.user_collection
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_check_ins_updated_at
  BEFORE UPDATE ON public.user_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_journey_updated_at
  BEFORE UPDATE ON public.user_journey
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_travel_logs_updated_at
  BEFORE UPDATE ON public.user_travel_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_achievement_state_updated_at
  BEFORE UPDATE ON public.user_achievement_state
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
