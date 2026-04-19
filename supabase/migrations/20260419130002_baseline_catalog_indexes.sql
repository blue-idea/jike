-- Baseline fragment (task 5). Do not reorder without adjusting downstream.


CREATE INDEX catalog_scenic_spots_province_idx ON public.catalog_scenic_spots (province);
CREATE INDEX catalog_scenic_spots_level_idx ON public.catalog_scenic_spots (level);
CREATE INDEX catalog_scenic_spots_lng_lat_idx ON public.catalog_scenic_spots (lng, lat);

CREATE INDEX catalog_heritage_sites_province_idx ON public.catalog_heritage_sites (province);
CREATE INDEX catalog_heritage_sites_search_name_idx ON public.catalog_heritage_sites (search_name);
CREATE INDEX catalog_heritage_sites_lng_lat_idx ON public.catalog_heritage_sites (lng, lat);

CREATE INDEX catalog_museums_province_idx ON public.catalog_museums (province);
CREATE INDEX catalog_museums_quality_level_idx ON public.catalog_museums (quality_level);
CREATE INDEX catalog_museums_lng_lat_idx ON public.catalog_museums (lng, lat);
