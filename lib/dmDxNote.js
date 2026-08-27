// 糖尿病診断グレーゾーン（HbA1c 6.3〜6.6前後）での医師確認結果を
// カルテの【事前聴取時 申し送り事項】に後から追記するための組み立て。
//
// ■ 背景
// GAD抗体・CPR は「糖尿病と診断された患者」でないと保険請求できない。
// 運用は 問診（スタッフ）→ 採血（GAD・CPR を含めて実施）→ HbA1c 確認 →
// グレーゾーンなら医師に確認 → 診断が付かなければ GAD・CPR を削除、という流れ。
// 医師の診察は全結果が揃う3日後以降なので、判断した時点では医師は患者を診ていない。
// 「何を根拠に診断した / しなかったか」がカルテに残らないと、
// 後から保険審査で問われたときに説明できない（実際に査定された事例あり）。
//
// ■ なぜ「過去の値」まで書くのか
// 糖尿病の診断基準は 空腹時血糖126 / 食後血糖200 / HbA1c6.5% のうち2項目
// （別項目2つ、または同一項目2回）を満たすこと。
// 今回のHbA1cが6.5%未満でも、過去の値と合わせれば診断が成立する。
// つまり「今回のHbA1cだけ」では診断根拠にならないので、
// どの値と組み合わせて判断したかを必ず残す。
//
// ■ 既存の「□血糖、HbA1cの結果により上段の診断を確定してください」とは別物
// あちらは主病名（＃糖尿病 / IGT / 正常耐糖能）を医師が選ぶための行。
// こちらは GAD・CPR の算定根拠。両方が並んで出てよい。

// カルテ本文から同種の行を見分けるための目印。
// 3つの選択肢すべてがこの文字列で始まるので、押し直しても重複しない。
const LINE_PREFIX = '□今回HbA1c'

export const DM_DX_DECISIONS = [
  { key: 'diagnosed', label: '糖尿病と診断',        note: 'GAD・CPRを追加', color: '#0f9668' },
  { key: 'deferred',  label: '診断は見送り',        note: 'GAD・CPRを削除', color: '#c53030' },
  { key: 'known',     label: '過去に糖尿病の診断歴', note: 'GAD・CPRを追加', color: '#1a5fa8' },
]

// 過去の値を「空腹時血糖 132mg/dl・HbA1c 6.6%」の形にまとめる。
// 入力のあった項目だけを並べる（「不明」等では埋めない）。
export function buildPastValuesText(past = {}) {
  const parts = []
  const fbs   = String(past.fbs   ?? '').trim()
  const ppbs  = String(past.ppbs  ?? '').trim()
  const hba1c = String(past.hba1c ?? '').trim()
  if (fbs)   parts.push(`空腹時血糖 ${fbs}mg/dl`)
  if (ppbs)  parts.push(`食後血糖 ${ppbs}mg/dl`)
  if (hba1c) parts.push(`HbA1c ${hba1c}%`)
  return parts.join('・')
}

// 申し送りに入れる1行を組み立てる。
// 今回のHbA1c が未入力なら空文字（＝挿入させない）。
export function buildDmDxNoteLine({ decision, hba1c, past } = {}) {
  const now = String(hba1c ?? '').trim()
  if (!decision || !now) return ''

  const pastText = buildPastValuesText(past)

  if (decision === 'diagnosed') {
    return pastText
      ? `${LINE_PREFIX} ${now}%と過去の${pastText}をあわせ、医師に確認し糖尿病の診断とした → GAD・CPRを追加`
      : `${LINE_PREFIX} ${now}% → 医師に確認し糖尿病の診断とした → GAD・CPRを追加`
  }
  if (decision === 'deferred') {
    return pastText
      ? `${LINE_PREFIX} ${now}%（過去の${pastText}）→ 医師に確認し糖尿病の診断は見送りとした → GAD・CPRを削除`
      : `${LINE_PREFIX} ${now}% → 医師に確認し糖尿病の診断は見送りとした → GAD・CPRを削除`
  }
  if (decision === 'known') {
    // 既に糖尿病の診断がついている患者なので、過去の個別の値は根拠として不要。
    return `${LINE_PREFIX} ${now}%（診断基準未満）だが過去に糖尿病の診断歴があるため、GAD・CPRを追加`
  }
  return ''
}

// カルテ本文の【事前聴取時 申し送り事項】の末尾
// （＝【診察にあたっての要望】の直前）に1行挿入する。
// 同種の行が既にあれば取り除いてから入れるので、選び直しても重複しない。
// line が空文字なら既存行の削除だけを行う。
export function insertDmDxNote(karte, line) {
  const src = String(karte ?? '')
  const eol = src.includes('\r\n') ? '\r\n' : '\n'
  const lines = src.split(/\r?\n/).filter(l => !l.startsWith(LINE_PREFIX))
  if (!line) return lines.join(eol)

  const idx = lines.findIndex(l => l.startsWith('【診察にあたっての要望】'))
  if (idx === -1) lines.push(line)
  else lines.splice(idx, 0, line)
  return lines.join(eol)
}
