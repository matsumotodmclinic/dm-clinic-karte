-- 勤怠アプリの audit_logs に残っている「問診の中身」を消す（2026-10-15 院長判断）
--
-- 背景: 2026-04-25〜10-15 の間、問診アプリの更新ログ（app='dm-clinic-karte', action='update'）が
-- new_value に更新内容を丸ごと入れていた（form_data・カルテ本文 = 医療情報の写し）。
-- 10-15 のコード修正で今後は status だけになった。ここでは過去分を同じ形に揃える。
--
-- 消すのは new_value の中身だけ。ログの行（いつ・誰が・どの問診を・何の項目を更新したか）は残る。
--   status を含んでいた行 → {"status":"done"} だけ残す
--   それ以外              → new_value を空（NULL）にする
-- ★元に戻せません。①で件数を確かめてから②を実行してください。
--
-- 使い方: Supabase（karteplus-prod）→ SQL Editor に貼り、①だけ選択して Run → 件数確認 → ②を Run。

-- ① 対象の件数（読むだけ）
select count(*) as 対象件数,
       min(modified_at) as 最古,
       max(modified_at) as 最新
  from audit_logs
 where app = 'dm-clinic-karte'
   and new_value is not null
   and (new_value like '%"form_data"%' or new_value like '%"generated_karte"%');

-- ② 実行（対象件数と「更新しました」の件数が一致することを確認）
update audit_logs
   set new_value = case
         when new_value::jsonb ? 'status'
           then jsonb_build_object('status', new_value::jsonb->>'status')::text
         else null
       end
 where app = 'dm-clinic-karte'
   and new_value is not null
   and (new_value like '%"form_data"%' or new_value like '%"generated_karte"%');

-- ③ 確認（0 件になっていれば完了）
select count(*) as 残り
  from audit_logs
 where app = 'dm-clinic-karte'
   and (new_value like '%"form_data"%' or new_value like '%"generated_karte"%');
