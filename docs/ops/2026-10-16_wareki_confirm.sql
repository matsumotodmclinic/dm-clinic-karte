-- 和暦ずれ 確定用（読むだけ・何も変更しない）。2026-10-16
--
-- ■ なぜもう 1 本要るか
-- 10-15 のクエリ①の「AI整形に正しい和暦あり」は、**false でもずれたとは限らない**:
--   ・AI が「平成28年」と長い形で書いた（カルテの書式としては正しい。H28 と探すと外れる）
--   ・その既往の時期を書かなかった（時期不明・既往なし）
--   ・元号の切り替わり（2019年5月）をまたいで ±1 年ずれた
-- そこで **「誤った値（＋2年）が実際に書かれているか」を直接見る**。
--
-- 誤っていた指示文（2026-10-15 に修正済）:
--   「今日がR8なら 10年前→H30、15年前→H25」（正: H28 / H23）＝ すべて +2 年
--
-- ■ 読み方
--   正しい和暦あり = false かつ 誤った和暦あり = true  → 🔴 直す対象（電子カルテを手で修正）
--   正しい和暦あり = true                               → 問題なし
--   どちらも false かつ 年号を書いている = false        → その既往の時期を書かなかっただけ
--   西暦のまま = true                                   → 別の問題（和暦統一ルール違反）
--
-- ■ 注意
--   ・1 レコードに「○年前」が複数あると **その数だけ行が出る**（行数＝レコード数ではない）
--   ・文字列の部分一致なので、同じ和暦が別の疾患に出ていると true になりうる。
--     最後は visit_code で現物を見て決めること
with v as (
  select visit_code, created_at, form_type,
         form_data->'voicePastHistory'->>'transcript' as transcript,
         coalesce(form_data->'voicePastHistory'->>'aiSummary', '') as ai_summary
    from questionnaires
   where form_data->'voicePastHistory'->>'transcript' ~ '年'
),
m as (
  select v.*, (x[1])::int as n,
         extract(year from v.created_at)::int - (x[1])::int as y_ok
    from v, regexp_matches(translate(v.transcript, '０１２３４５６７８９', '0123456789'),
                           '(\d+)\s*年\s*(?:くらい|ぐらい|ほど|位)?\s*前', 'g') as x
),
w as (
  select m.*,
         case when y_ok >= 2019 then 'R' || (y_ok - 2018)
              when y_ok >= 1989 then 'H' || (y_ok - 1988)
              else 'S' || (y_ok - 1925) end as ok_s,
         case when y_ok >= 2019 then '令和' || (y_ok - 2018) || '年'
              when y_ok >= 1989 then '平成' || (y_ok - 1988) || '年'
              else '昭和' || (y_ok - 1925) || '年' end as ok_l,
         case when y_ok + 2 >= 2019 then 'R' || (y_ok + 2 - 2018)
              when y_ok + 2 >= 1989 then 'H' || (y_ok + 2 - 1988)
              else 'S' || (y_ok + 2 - 1925) end as ng_s,
         case when y_ok + 2 >= 2019 then '令和' || (y_ok + 2 - 2018) || '年'
              when y_ok + 2 >= 1989 then '平成' || (y_ok + 2 - 1988) || '年'
              else '昭和' || (y_ok + 2 - 1925) || '年' end as ng_l
    from m
)
select visit_code                                       as 受付コード,
       created_at::date                                 as 受付日,
       form_type,
       n                                                as 何年前,
       ok_s                                             as 正しい和暦,
       (position(ok_s in ai_summary) > 0
        or position(ok_l in ai_summary) > 0)            as 正しい和暦あり,
       ng_s                                             as ずれていればこの値,
       (position(ng_s in ai_summary) > 0
        or position(ng_l in ai_summary) > 0)            as 誤った和暦あり,
       (ai_summary ~ '[HRS][0-9]|平成|令和|昭和')        as 年号を書いている,
       (ai_summary ~ '(19|20)[0-9]{2}年')               as 西暦のまま
  from w
 order by created_at, n;
