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
// プロンプト同期チェッカーには「B のみ」の差分として記録される。

export function hasDmDiff(formData) {
  return formData?.dmDiff?.completed === true
}

// AI に渡す【DM差分問診】データブロック。dmDiff が無ければ空文字。
export function buildDmDiffBlock(dmDiff) {
  const dm = dmDiff || {}
  if (dm.completed !== true) return ''

  const symptoms = (dm.dmSymptoms?.selected || []).join('・') || 'なし'
  const symptomsOther = dm.dmSymptoms?.otherText ? `（その他: ${dm.dmSymptoms.otherText}）` : ''

  const onset = dm.diabetesOnsetUnknown
    ? '不明'
    : (dm.diabetesOnsetEra && dm.diabetesOnsetYear
        ? `${dm.diabetesOnsetEra}${dm.diabetesOnsetYear}年（${dm.diabetesOnsetNote || '今回判明'}）`
        : '今回採血で判明')

  const importantPast = [
    dm.importantPast?.gastricCancer  && '胃癌',
    dm.importantPast?.pancreasCancer && '膵癌',
    dm.importantPast?.ihd            && '虚血性心疾患',
    dm.importantPast?.stroke         && '脳梗塞',
  ].filter(Boolean).join('・') || 'なし'
  const importantPastDetail = dm.importantPast?.detail ? `（詳細: ${dm.importantPast.detail}）` : ''

  return `
【DM差分問診（採血で DM 判明後にスタッフが追加聴取）】
体重減少：${dm.weightLoss || '未入力'}
糖尿病の症状：${symptoms}${symptomsOther}
過去のHbA1c/血糖指摘歴：${dm.pastHbA1c || 'なし'}
糖尿病発症時期：${onset}
インスリン使用：${dm.insulinUse ? 'あり' : 'なし'}
家族歴(DM)：${dm.fhDm ? 'あり' : 'なし'}${dm.fhDmWho?.length ? `（${dm.fhDmWho.join('・')}）` : ''}
家族歴(HL)：${dm.fhHl ? 'あり' : 'なし'}
眼底検査：${dm.eyeFundusCheck || '未入力'}　糖尿病-眼科連携手帳：${dm.eyeNotebook || '未入力'}　眼科：${dm.eyeClinic || ''}　網膜症：${dm.retinopathy || '未入力'}
重要既往歴：${importantPast}${importantPastDetail}
治療希望：${dm.treatmentWish || '未入力'}
自由記載：${dm.freeText || ''}
`
}

// 【ルール】に足す指示文。
// mainDiseaseRule は ＃糖尿病 をどこに置くかがフォームごとに違うので呼び出し側で渡す。
export function buildDmDiffRules(mainDiseaseRule) {
  return `- 【DM差分問診】が下に提供されている: ${mainDiseaseRule}
- 【DM差分問診】の「糖尿病の症状」にチェックがある場合のみ【糖尿病の症状】セクションを追加し、「・」区切りで横一列に記載
- 【DM差分問診】の 眼底検査／糖尿病-眼科連携手帳／網膜症 から【眼科通院歴】を記載（眼底検査を受けていない場合は「未受診」）
- 【DM差分問診】の重要既往歴（胃癌・膵癌・IHD・脳梗塞）があれば♯行で記載。家族歴のDM/HLにも反映
- 申し送り事項に必ず「□採血で DM判明 → DM初期評価追加実施済」を含める
- 眼底検査=受けていない or 連携手帳=持っていない の場合は申し送りに「□糖尿病-眼科連携手帳をお渡し」も追加
- フッターの採血セットは「DM基本セット」にする`
}
