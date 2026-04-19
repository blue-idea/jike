-- Baseline fragment (task 5). Do not reorder without adjusting downstream.

-- ---------------------------------------------------------------------------
-- Grants（名录 / app_config 不对 authenticated 开放写权限）
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
