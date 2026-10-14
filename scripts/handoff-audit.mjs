// 申し送り事項の棚卸し（2026-10-14 院長「選択の結果生じた内容が表示されているか確認して」）。
//
// ■ なぜ機械で出すか
// 「この選択をしたらこの申し送りが出る」は記憶や読みでは抜ける。1 項目ずつ実際に書き換えて
// 【事前聴取時 申し送り事項】の □ 行が変わるかを見れば、事実として一覧にできる。
// 取りこぼし検査（coverage.test.mjs）は「カルテのどこかに出るか」を見るが、
// こちらは「申し送りに出るか」だけを見る。本文に出ていても行動の指示になっていなければ意味が違う。
//
// ■ 読み方
//   【常に出る】    条件なしで必ず出る行
//   【条件つき】    どの項目を変えると出る／消えるか
//   【申し送りに出ない選択】 選択肢なのに □ 行が1つも動かないもの
//     → 本文に出ていれば正しいこともある（飲酒歴など）。**行動の指示が要るのに無い**ものを探す欄。
//
// 実行: node scripts/handoff-audit.mjs [フォーム名 ...]

import { buildKarteTemplate } from '../lib/buildKarteTemplate.js'
import { FIXTURES } from './golden/fixtures.mjs'

const HANDOFF_HEAD = '【事前聴取時　申し送り事項】'
const HANDOFF_END = '【診察にあたっての要望】'

/** カルテから □ 行だけを取り出す */
function handoffLines(karte) {
  if (!karte) return []
  const ls = String(karte).split('\n')
  const i = ls.findIndex(l => l.startsWith(HANDOFF_HEAD))
  const j = ls.findIndex(l => l.startsWith(HANDOFF_END))
  if (i < 0) return []
  return ls.slice(i + 1, j < 0 ? ls.length : j).filter(l => l.startsWith('□'))
}

const getAt = (o, p) => p.split('.').reduce((a, k) => a?.[k], o)
const setAt = (o, p, v) => {
  const ks = p.split('.')
  const last = ks.pop()
  const parent = ks.reduce((a, k) => a?.[k], o)
  if (parent) parent[last] = v
}

/** 葉のパスを全部集める（配列は丸ごと 1 つの葉として扱う） */
function leafPaths(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj || {})) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leafPaths(v, p))
    else out.push(p)
  }
  return out
}

/**
 * 走査の対象にする値。
 * ★数値も対象に含める（2026-10-14 院長指摘）。身長・体重から計算する BMI のように
 *   **数値が条件になっている分岐**があり、除外していると「常に出る」と誤って分類される。
 *   実際そのせいで簡易PSG（BMI 25以上）を「常に出る」と報告して院長に訂正された。
 */
function isChoice(v) {
  if (typeof v === 'boolean') return true
  if (Array.isArray(v)) return true
  if (typeof v === 'string') return v !== '' && v.length <= 24
  return false
}

const isNumeric = (v) => typeof v === 'string' && /^\d+(\.\d+)?$/.test(v)

// ★列挙値は「コードが見ている値」を踏まないと動かない。空文字と適当な文字列だけで探ると
//   「変えても動かない」と誤判定する（2026-09-07 の「効果の出ない対照」と同じ罠）。
//   当院の問診で実際に使われている選択肢を候補として総当たりする。
const ENUM_PROBES = [
  '', 'ZZ',
  'あり', 'なし', '不明',
  '持参あり', '持参なし',
  '受けている', '受けていない', '今後受ける予定',
  '持っている', '持っていない', '忘れた',
  'インスリン使用中', 'インスリン未使用',
  '申請済', '申請未', '申請中',
  '希望あり', '希望なし',
  'していない',
  '女性医師希望', '男性医師希望', '院長（初回のみ）', '指定なし',
  '○患者疑い（話が長い方）', '●患者疑い（出禁対象）', '通常',
  // ★英語キーの列挙値もある（SAS の区分・甲状腺の formType）。日本語だけだと踏めず
  //   「変えても動かない」と誤判定する。実際 SAS の「□SAS 簡易PSG発送手配 要」を
  //   取りこぼしかけた（2026-10-14）。
  'screening', 'cpap',
]

// ⚠️ この走査の限界: 候補値の総当たりなので、**ここに無い値でしか動かない分岐は見つからない**。
//   「選択しても申し送りが動かない項目」に出たものは、まず候補値の不足を疑うこと。

function probesFor(cur) {
  if (typeof cur === 'boolean') return [!cur]
  if (Array.isArray(cur)) return [[], [...cur, 'ZZ']]
  // 数値は閾値をまたぐように散らす（BMI 25 の境目などを踏むため）
  if (isNumeric(cur)) return ['', '0', '40', '100', '200'].filter(v => v !== cur)
  return ENUM_PROBES.filter(v => v !== cur)
}

const forms = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FIXTURES)
const out = []

for (const formType of forms) {
  const base = FIXTURES[formType]
  if (!base) { out.push(`\n## ${formType}\n(フィクスチャ無し)`); continue }
  const baseline = handoffLines(buildKarteTemplate(formType, base))

  const always = new Set(baseline)
  const triggers = new Map()   // 行 → それを動かす項目
  const silent = []            // 変えても □ 行が動かない選択項目

  for (const p of leafPaths(base)) {
    const cur = getAt(base, p)
    if (!isChoice(cur)) continue
    let moved = false
    for (const v of probesFor(cur)) {
      const clone = structuredClone(base)
      setAt(clone, p, v)
      const after = handoffLines(buildKarteTemplate(formType, clone))
      const gone = baseline.filter(l => !after.includes(l))
      const added = after.filter(l => !baseline.includes(l))
      // 選択値がそのまま行に入る項目（□医師希望：女性医師 等）は、探った値の数だけ
      // 別の行に見えてしまう。値の部分を「…」に畳んで 1 行にまとめる。
      const norm = (l0) => {
        // 数値由来の行は括弧の中身が毎回変わる（□簡易PSG…（体重過多 BMI 35.4））ので畳む
        const l = isNumeric(cur) ? l0.replace(/（[^）]*\d[^）]*）/g, '（…）') : l0
        const i = l.indexOf('：')
        if (i < 0) return l
        const tail = l.slice(i + 1)
        // 値がそのまま入る行（□医師希望：女性医師）も、値＋後置き（□薬剤アレルギー：○○（処方時に確認））も畳む
        const hit = probesFor(cur).some(v => typeof v === 'string' && v !== '' && tail.startsWith(v))
        return hit ? `${l.slice(0, i)}：…（入力値）` : l
      }
      for (const raw of [...gone, ...added].filter(l => !l.includes('ZZ'))) {
        // 畳む前の形（＝土台に出ている行そのもの）も「常に出る」から外す。
        // 外さないと「常に出る」と「条件つき」の両方に同じ行が載る。
        always.delete(raw)
        const l = norm(raw)
        always.delete(l)
        if (!triggers.has(l)) triggers.set(l, new Set())
        triggers.get(l).add(p)
        moved = true
      }
    }
    if (!moved) silent.push(p)
  }

  // 行ごとでなく「項目ごと」にまとめる。入力値がそのまま行に入る項目（CGM の機種名など）は
  // 値の数だけ行が増えて読めなくなるため、3 行を超えたら 1 行に畳む。
  const byField = new Map()
  for (const [line, fields] of triggers) {
    for (const f of fields) {
      if (!byField.has(f)) byField.set(f, new Set())
      byField.get(f).add(line)
    }
  }

  out.push(`\n## ${formType}`)
  out.push('\n### 常に出る')
  out.push(baseline.filter(l => always.has(l)).map(l => `- ${l}`).join('\n') || '- （なし）')
  out.push('\n### 条件つきで出る（項目ごと）')
  out.push([...byField].map(([f, ls]) => {
    const list = [...ls]
    const body = list.length > 3
      ? `  → ${list[0]}\n  → ほか ${list.length - 1} 通り（入力値がそのまま行に入る項目）`
      : list.map(l => `  → ${l}`).join('\n')
    return `- ${f}\n${body}`
  }).join('\n') || '- （なし）')
  out.push('\n### 選択しても申し送りが動かない項目')
  out.push(silent.map(p => `- ${p}`).join('\n') || '- （なし）')
}

console.log(out.join('\n'))
