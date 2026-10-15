// DM差分問診（採血で糖尿病が判明した後に、スタッフが追加聴取する項目）の共通処理。
//
// ■ 背景
// SAS / 高血圧・脂質異常症 / 反応性低血糖 は全例当院で事前採血を行う。
// その HbA1c が高値で糖尿病が判明することがあるが、
// これらの問診票は糖尿病の初期評価に必要な項目（体重減少・糖尿病の症状・
// 眼底検査・重要既往など）を聞いていない。
// そこで詳細画面で差分だけを追加聴取し、form_data.dmDiff に保存する。
// 「🔄 再生成」を押すと、元の主病名 ＋ ＃糖尿病 の統合カルテになる。
//
// ■ 経路A（初回生成）には無い
// dmDiff は採血結果が出た後にしか入力できないため、経路B（再生成）専用。
// カルテへの反映は lib/buildKarteTemplate.js。
// （旧方式用の buildDmDiffBlock / buildDmDiffRules は 2026-10-15 に旧方式ごと削除）

export function hasDmDiff(formData) {
  return formData?.dmDiff?.completed === true
}

