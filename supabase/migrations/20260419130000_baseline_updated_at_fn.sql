-- Baseline fragment (task 5). Do not reorder without adjusting downstream.

-- Baseline: catalog + user tables, indexes, updated_at triggers, RLS, catalog_poi_nearby view, nearby_pois RPC.
-- Aligns with docs/spec/data.md (v1.2) and requirements.md 需求 16.

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
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
