-- Baseline fragment (task 5). Do not reorder without adjusting downstream.


-- ---------------------------------------------------------------------------
-- Catalog tables (read via PostgREST; writes via service_role / ETL only)
-- ---------------------------------------------------------------------------
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
  images text[],
  source_batch text,
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
  images text[],
  source_batch text,
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
  images text[],
  source_batch text,
  data_version integer NOT NULL DEFAULT 1,
  imported_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
