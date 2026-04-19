-- Baseline fragment (task 5). Do not reorder without adjusting downstream.


CREATE INDEX user_collection_user_id_idx ON public.user_collection (user_id);
CREATE INDEX user_check_ins_user_id_idx ON public.user_check_ins (user_id);
CREATE INDEX user_journey_user_id_idx ON public.user_journey (user_id);
CREATE INDEX user_travel_logs_user_id_idx ON public.user_travel_logs (user_id);

CREATE TRIGGER set_user_collection_updated_at
  BEFORE UPDATE ON public.user_collection
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_check_ins_updated_at
  BEFORE UPDATE ON public.user_check_ins
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_journey_updated_at
  BEFORE UPDATE ON public.user_journey
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_travel_logs_updated_at
  BEFORE UPDATE ON public.user_travel_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_user_achievement_state_updated_at
  BEFORE UPDATE ON public.user_achievement_state
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

CREATE TRIGGER set_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();
