-- 名录公开只读：发现页查询使用与 App 相同的 anon 密钥时须能 SELECT（原策略仅 authenticated）。
-- 景区表补充 county，与导入/筛选一致。

ALTER TABLE public.catalog_scenic_spots
  ADD COLUMN IF NOT EXISTS county text;

CREATE INDEX IF NOT EXISTS catalog_scenic_spots_county_idx
  ON public.catalog_scenic_spots (county);

-- anon：三类名录只读
DROP POLICY IF EXISTS catalog_scenic_spots_select_anon ON public.catalog_scenic_spots;
CREATE POLICY catalog_scenic_spots_select_anon
  ON public.catalog_scenic_spots FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS catalog_heritage_sites_select_anon ON public.catalog_heritage_sites;
CREATE POLICY catalog_heritage_sites_select_anon
  ON public.catalog_heritage_sites FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS catalog_museums_select_anon ON public.catalog_museums;
CREATE POLICY catalog_museums_select_anon
  ON public.catalog_museums FOR SELECT TO anon USING (true);

GRANT SELECT ON public.catalog_scenic_spots TO anon;
GRANT SELECT ON public.catalog_heritage_sites TO anon;
GRANT SELECT ON public.catalog_museums TO anon;
