-- 問診データの自動削除（保存から 90 日）を有効にする前に、何件消えるかを見る。
-- Supabase の SQL Editor で実行する。★読むだけ（何も消さない）。
--
-- 有効にする手順（lib/retention.js）:
--   1. この SQL で件数を見る
--   2. 和暦ずれ 6 件の修正（docs/ops/2026-10-16_wareki_confirm.sql）が済んでいることを確かめる
--      ← 90 日より前の回が含まれていると、直す前に DB から消える
--   3. Vercel → Settings → Environment Variables に QUESTIONNAIRE_RETENTION_DAYS = 90 を足して再デプロイ
--   4. 次にスタッフが一覧を開いたときに消える。件数は勤怠アプリの操作ログ（purge_expired）に残る

-- ① 消える件数（状態別）
select status, count(*) as 件数, min(created_at)::date as 最古, max(created_at)::date as 最新
from questionnaires
where created_at < now() - interval '90 days'
group by status
order by status;

-- ② 残る件数
select count(*) as 残る件数
from questionnaires
where created_at >= now() - interval '90 days';

-- ③ 月ごとの内訳（どこまで遡って消えるか）
select date_trunc('month', created_at)::date as 月, count(*) as 件数,
       count(*) filter (where created_at < now() - interval '90 days') as 消える
from questionnaires
group by 1
order by 1;
