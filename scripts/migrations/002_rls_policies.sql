-- scripts/migrations/002_rls_policies.sql
-- 启用 RLS 并配置行级安全策略
-- 前置: 001_initial_schema.sql 已创建表结构

-- ============================================================
-- 用户数据（users）RLS
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 用户只能读写自己的数据
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 收藏/想去/已去 RLS
-- ============================================================
ALTER TABLE public.favorites_favorite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites_want_to_visit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites_visited ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fav_favorite_select_own" ON public.favorites_favorite
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fav_favorite_insert_own" ON public.favorites_favorite
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fav_favorite_delete_own" ON public.favorites_favorite
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "fav_want_select_own" ON public.favorites_want_to_visit
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fav_want_insert_own" ON public.favorites_want_to_visit
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fav_want_delete_own" ON public.favorites_want_to_visit
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "fav_visited_select_own" ON public.favorites_visited
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "fav_visited_insert_own" ON public.favorites_visited
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fav_visited_delete_own" ON public.favorites_visited
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 打卡记录 RLS
-- ============================================================
ALTER TABLE public.checkin_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkin_select_own" ON public.checkin_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "checkin_insert_own" ON public.checkin_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 用户印章 RLS
-- ============================================================
ALTER TABLE public.user_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stamp_select_own" ON public.user_stamps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "stamp_insert_own" ON public.user_stamps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stamp_update_own" ON public.user_stamps
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 用户成就 RLS
-- ============================================================
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ach_select_own" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ach_insert_own" ON public.user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ach_update_own" ON public.user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- 游记 RLS
-- ============================================================
ALTER TABLE public.travel_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_select_own" ON public.travel_journals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "journal_insert_own" ON public.travel_journals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "journal_update_own" ON public.travel_journals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "journal_delete_own" ON public.travel_journals
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 名录表（只读，公开）
-- ============================================================
ALTER TABLE public.catalog_scenic_spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_heritage_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_museums ENABLE ROW LEVEL SECURITY;

-- 所有用户可读取名录
CREATE POLICY "scenic_select_all" ON public.catalog_scenic_spots
  FOR SELECT USING (true);

CREATE POLICY "heritage_select_all" ON public.catalog_heritage_sites
  FOR SELECT USING (true);

CREATE POLICY "museum_select_all" ON public.catalog_museums
  FOR SELECT USING (true);

-- 仅服务端应用角色可写入（通过 service_role key，客户端不使用）
