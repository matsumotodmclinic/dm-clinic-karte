-- 既往歴の和暦換算のずれ 確認用（読むだけ・何も変更しない）
-- 2026-10-15: 既往歴の AI 指示文の例が「今日がR8なら 10年前→H30、15年前→H25」（正: H28 / H23）だった。
-- 音声で「○年前」と話された既往が、2 年ずれて整形されていないかを見る。
--
-- 使い方: Supabase（karteplus-prod）→ SQL Editor に貼って Run。
-- 結果の「AI整形に正しい和暦あり」が false の行を、ai_summary と見比べてください。
-- 「正しい和暦_目安」は年だけで判定している（元号の境目 2019年5月 の前後は ±1 ずれることがある）。

-- ① 数字で「○年前」と話された既往（自動で答え合わせ）
with v as (
  select id, visit_code, created_at, form_type,
         form_data->'voicePastHistory'->>'transcript' as transcript,
         form_data->'voicePastHistory'->>'aiSummary'  as ai_summary,
         generated_karte
    from questionnaires
   where form_data->'voicePastHistory'->>'transcript' ~ '年'
),
m as (
  select v.*, (x[1])::int as n,
         extract(year from v.created_at)::int - (x[1])::int as 正しい西暦
    from v, regexp_matches(translate(v.transcript, '０１２３４５６７８９', '0123456789'),
                           '(\d+)\s*年\s*(?:くらい|ぐらい|ほど|位)?\s*前', 'g') as x
)
select visit_code,
       created_at::date as 受付日,
       form_type,
       n as 何年前,
       正しい西暦,
       case when 正しい西暦 >= 2019 then 'R' || (正しい西暦 - 2018)
            else 'H' || (正しい西暦 - 1988) end as 正しい和暦_目安,
       position((case when 正しい西暦 >= 2019 then 'R' || (正しい西暦 - 2018)
                      else 'H' || (正しい西暦 - 1988) end) in coalesce(ai_summary, '')) > 0 as AI整形に正しい和暦あり,
       ai_summary,
       transcript
  from m
 order by created_at;

-- ② 漢数字などで「年前」と話された既往（自動判定できないので目で確認）
select visit_code,
       created_at::date as 受付日,
       form_type,
       form_data->'voicePastHistory'->>'transcript' as transcript,
       form_data->'voicePastHistory'->>'aiSummary'  as ai_summary
  from questionnaires
 where form_data->'voicePastHistory'->>'transcript' ~ '年\s*(くらい|ぐらい|ほど|位)?\s*前'
   and translate(form_data->'voicePastHistory'->>'transcript', '０１２３４５６７８９', '0123456789')
       !~ '\d+\s*年\s*(くらい|ぐらい|ほど|位)?\s*前'
 order by created_at;
