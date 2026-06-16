-- ============================================================================
-- 20260617_questionnaires_enable_rls.sql
--
-- ★★ 未適用 / 院長作業: prod (karteplus-prod = ozixfpqokjgeykuxzlqa = dm-clinic-karte
--    の Supabase) の Studio で実行すること。
--
-- 目的 (Critical): questionnaires (患者の問診テーブル) の RLS が無効だったため、
--   anon (= 公開 ANON_KEY) で全患者の問診データを 読取/編集/削除 できる状態だった。
--   Supabase Security Advisor が rls_disabled_in_public として検出 (2026-06-12)。
--
-- 安全性 (壊れない根拠):
--   dm-clinic-karte は Supabase クライアントを service_role 一本で構築している
--   (lib/supabase.js = SUPABASE_SERVICE_KEY)。 anon クライアントは存在しない
--   (2026-06-17 grep 確認: createClient は lib/supabase.js の 1 箇所のみ)。
--   service_role は RLS をバイパスするため、 RLS を有効化しても問診アプリ
--   (入力/保存/一覧/詳細、 すべて API route 経由) は影響を受けない。
--   患者問診に anon の直接アクセスは不要 → anon は default deny で遮断してよい。
-- ============================================================================

-- 1. RLS を有効化 (ポリシー無し = anon は全操作 default deny。 service_role は bypass)
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;

-- 2. 二重防御: anon の直接権限も剥がす (RLS が将来 toggle されても anon に grant が無い)
REVOKE ALL ON TABLE public.questionnaires FROM anon;

-- PostgREST のスキーマ/権限キャッシュを即時リロード
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- ★ 実行後の検証 (Studio SQL Editor で role=anon に切替):
--   set role anon; select * from public.questionnaires limit 1; reset role;
--   → 期待: permission denied (anon は読めない = 露出が閉じた証拠)
--
-- ★ 実機スモーク (dm-clinic-karte 問診アプリ、 service_role 経由なので無影響のはず):
--   患者問診の 入力→保存 / 問診一覧 (/list) 表示 / 詳細表示 が従来どおり動くこと。
--
-- ★ Advisor 再チェック: Supabase → karteplus-prod → Advisors → Security で
--   rls_disabled_in_public が解消されていること。
--
-- ロールバック (万一問診アプリが壊れた場合のみ。 ただし service_role 利用なので不要のはず):
--   ALTER TABLE public.questionnaires DISABLE ROW LEVEL SECURITY;
--   GRANT ALL ON TABLE public.questionnaires TO anon;  -- ※露出が戻るので原則しない
-- ============================================================================
