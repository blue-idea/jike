-- Baseline fragment (task 5). Do not reorder without adjusting downstream.

CREATE POLICY user_check_ins_delete_own
  ON public.user_check_ins FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

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

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_config_select_authenticated
  ON public.app_config
  FOR SELECT
  TO authenticated
  USING (true);
