-- Baseline fragment (task 5). Do not reorder without adjusting downstream.


-- ---------------------------------------------------------------------------
-- Row Level Security（data.md §3.1）
-- ---------------------------------------------------------------------------
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
