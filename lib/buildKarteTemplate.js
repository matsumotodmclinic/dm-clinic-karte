// カルテ記載文を form_data から組み立てる（テンプレート版）。**全 14 フォーム対応**。
//
// 背景 (2026-09-06 → 2026-09-07):
//   従来は「出力フォーマットの雛形を含む長いプロンプト」を Claude に投げて全文を書かせていた。
//   だが問診で集めているデータはほぼ全てが構造化されており、AI は判断でなく整形をしていた。
//   ・条件分岐の判定（体重減少 → □行 等）→ JS でできる
//   ・チェック項目の書式化・数値の配置・定型の申し送り  → JS でできる
//   ・非構造データ（音声）と構造化データの **統合**   → ここだけ AI が要る
//
//   決定論にすると 5 つ同時に良くなる:
//     ①出力が決定論的（欠落が原理的に起きない） ②ユニットテストで固められる
//     ③API コスト激減 ④速い ⑤医療機器該当性の議論が軽くなる
//
// ★「AI 呼び出しゼロ」ではない（2026-09-06 の実測で分かった）
//   今のプロンプトは音声テキストを構造化データと **統合** せよと指示していて、
//   そこを JS で素朴に置き換えると 受診理由の紹介元・自由記入が落ち、♯既往に重複が出る。
//   ⇒ **統合の 2 点だけ AI に頼み、残り（書式・条件分岐・申し送り）は JS が確定させる**。
//
//     buildKarteTemplate(form_type, d)             → 統合なし版（音声が無いときの本番経路）
//     buildKarteTemplate(form_type, d, { merged }) → AI の統合結果を差し込んだ版
//     buildMergePrompt(form_type, d)               → 統合だけを頼む小さいプロンプト
//                                                    ★音声が無ければ null（AI を呼ばない）
//
//   音声入力が無い問診は **AI 呼び出しゼロで完結する**。当院の運用では音声はそこまで使われない
//   ため、実際にはほとんどの初診が決定論的に組み上がる。
//
// ⚠️ 空行の扱いはフォームによらず【空行ルール5条件】(CLAUDE.md) に統一してある。
//    旧プロンプトの「出力フォーマット」の雛形には、ルールと矛盾する空行が残っている箇所が
//    あったが（AI がどちらを採るかは毎回変わっていた）、ここでは常にルール側を採る。

import { buildOtherDiseasesText, pickOtherDiseases } from './otherDiseases.js'
import { buildEchoLine } from './echo.js'
import { buildStaffFlagLines } from './handoffNotes.js'
import { hasDmDiff } from './dmDiff.js'
import {
  getCurrentMonth, buildAlcohol, buildSmoking, buildLiving, buildChildInfo,
  buildJobStr, dmOnsetText, buildWeekday, buildBmi, buildDmSymptoms,
} from './karteFields.js'

const DIVIDER = '---------------------------------------------'

// 体重減少あり判定。
// ★問診票（DM基本 / 1型）のボタンは「あり / なし / 不明」で、画面上で
//   「3ヶ月以内に3kg以上」と定義しているため “あり” がそのまま 3kg 以上を意味する。
//   DM差分問診（DmDiffEditor）だけが「あり（軽度）/ あり（3kg以上）」の 2 段階を持つ。
function hasWeightLoss(v) {
  return v === 'あり' || v === 'あり（3kg以上）'
}

// ── 受診理由の材料（構造化データ側）───────────────────────
// AI に統合させるとき「何を渡したか」をテストで固定できるよう、materialize しておく。
export function buildReasonFacts(d) {
  const r = d?.reason || {}
  const facts = []
  if (r.type) facts.push(['受診区分', r.type])
  const ref = [r.referralFrom, r.referralDept].filter(Boolean).join(' ')
  if (ref) facts.push(['紹介元', ref])
  if (r.referralDetail) facts.push(['紹介の経緯', r.referralDetail])
  if (r.transferFrom) facts.push(['転院元', r.transferFrom])
  if (r.transferDetail) facts.push(['転院理由', r.transferDetail])
  if (r.checkupType) facts.push(['健診の種類', r.checkupType])
  if (r.dmConcern) facts.push(['糖尿病が気になる理由', [r.dmConcernReason, r.dmConcernNote].filter(Boolean).join('・') || '記載なし'])
  if (r.concern) facts.push(['気になって受診', r.concernType || '記載なし'])
  // SAS 固有
  if (r.purposes?.length) facts.push(['受診理由', [...r.purposes, r.purposeOther].filter(Boolean).join('、')])
  if (r.currentClinic) facts.push(['現通院先', r.currentClinic])
  if (r.sasCategory) facts.push(['SAS区分', sasCategoryLabel(r.sasCategory)])
  // 反応性低血糖 固有（reason セクションを持たないフォーム）
  const s = d?.symptom || {}
  if (s.timing?.length) facts.push(['低血糖が生じるタイミング', joinNote(s.timing, s.timingNote)])
  if (s.symptoms?.length) facts.push(['症状', joinNote(s.symptoms, s.symptomsNote)])
  if (s.cause?.length) facts.push(['思い当たる原因', joinNote(s.cause, s.causeNote)])
  if (r.summary) facts.push(['本人の自由記入', r.summary.trim()])
  return facts
}

const joinNote = (arr, note) => `${(arr || []).join('、')}${note ? `（${note}）` : ''}`

// ── 受診理由サマリー ───────────────────────────────────────
// 音声入力があれば入力時点で AI 整形済みなのでそれを使う。
// なければ構造化データから組み立てる（ここが唯一「文章を作る」ところ）。
export function buildReasonSummary(d) {
  const voice = (d?.voiceMemo?.aiSummary || '').trim()
  if (voice) return voice

  const r = d?.reason || {}
  const parts = []
  if (r.type === '紹介') {
    const from = [r.referralFrom, r.referralDept].filter(Boolean).join(' ')
    parts.push(from ? `${from}より紹介にて受診。` : '紹介にて受診。')
    if (r.referralDetail) parts.push(`${r.referralDetail}。`)
  } else if (r.type === '検診異常') {
    parts.push(`${r.checkupType || '健診'}で異常を指摘され受診。`)
  } else if (r.type === '自主転院') {
    parts.push(r.transferFrom ? `${r.transferFrom}より自主転院。` : '自主転院。')
    if (r.transferDetail) parts.push(`${r.transferDetail}。`)
  }
  if (r.dmConcern) {
    const why = [r.dmConcernReason, r.dmConcernNote].filter(Boolean).join('・')
    parts.push(why ? `糖尿病が気になり受診（${why}）。` : '糖尿病が気になり受診。')
  }
  if (r.concern) {
    parts.push(r.concernType ? `${r.concernType}が気になり受診。` : '気になることがあり受診。')
  }
  // SAS: 受診理由サマリーに SAS区分（CPAP継続 / 検査希望）を必ず含める
  if (r.purposes?.length) {
    const others = r.purposes.includes('その他') ? [r.purposeOther] : []
    parts.push(`受診理由：${[...r.purposes.filter(x => x !== 'その他'), ...others].filter(Boolean).join('・')}。`)
  }
  if (r.sasCategory === 'cpap') {
    parts.push(`CPAP治療の継続を希望${r.cpapPriorClinic ? `（前医：${r.cpapPriorClinic}）` : ''}。`)
  } else if (r.sasCategory === 'screening') {
    parts.push('睡眠時無呼吸症候群の検査を希望（簡易PSG予定）。')
  }
  if (r.currentClinic) parts.push(`現通院先：${r.currentClinic}。`)
  // 反応性低血糖: reason セクションを持たないフォームなので症状から1文を作る
  const s = d?.symptom || {}
  if (!parts.length && (s.timing?.length || s.symptoms?.length)) {
    const when = (s.timing || []).join('・')
    const what = (s.symptoms || []).join('・')
    parts.push(`${[when, what].filter(Boolean).join('の')}${what ? 'を主訴に' : 'の症状で'}受診。`)
  }
  if (r.summary) parts.push(r.summary.trim())
  return parts.join('')
}

// ── ♯重要既往（胃癌・膵臓癌・IHD・脳梗塞）────────────────────
// DetailBox の構造化入力から「♯病名（治療内容・時期・治療病院→通院先・内服薬）」を作る
function hospitalName(sel, other) {
  const v = sel === 'その他' ? (other || '').trim() : (sel || '').trim()
  return v || ''
}
function periodText(x) {
  if (x?.surgeryUnknown) return '時期不明'
  if (!x?.surgeryYear) return ''
  return `${x.surgeryEra || '平成'}${x.surgeryYear}年`
}
function careText(x) {
  const treated = hospitalName(x?.treatedHospital, x?.treatedHospitalOther)
  const visiting = hospitalName(x?.visitingHospital, x?.visitingHospitalOther)
  if (treated && visiting) return `${treated}→${visiting}${x?.visitFreq ? `（${x.visitFreq}）` : ''}`
  const one = treated || visiting
  return one ? `${one}${x?.visitFreq ? `（${x.visitFreq}）` : ''}` : ''
}
// 「手術で切除」「手術＋抗がん剤」のときだけ 胃切除後 / 術後 の前置きを付ける
function surgicalPrefix(x, label) {
  const t = x?.surgeryType || ''
  return (t === '手術で切除' || t === '手術＋抗がん剤') ? label : ''
}

function detailLine(name, x, { prefix = '', extras = [] } = {}) {
  if (!x?.selected) return ''
  const inner = [...extras, periodText(x), careText(x), x.meds ? `${x.meds} 内服中` : '']
    .filter(Boolean).join('、')
  const body = prefix ? (inner ? `${prefix}：${inner}` : prefix) : inner
  return body ? `♯${name}（${body}）` : `♯${name}`
}

// ＃IHD は病名側に治療法が付く（プロンプトの指示形: ♯IHD：PCI後（時期・…））
function ihdName(x) {
  const t = x?.treatment || ''
  if (t.startsWith('PCI')) return 'IHD：PCI後'
  if (t === 'バイパス手術') return 'IHD：バイパス手術後'
  if (t === '薬物療法のみ') return 'IHD：薬物療法'
  return 'IHD'
}

export function buildImportantHistoryLines(d) {
  const dis = d?.disease || {}
  const g = dis.gastricCancer, pa = dis.pancreasCancer
  return [
    detailLine('胃癌', g, {
      prefix: surgicalPrefix(g, '胃切除後'),
      // 前置きで「切除後」と言っているので「手術で切除」は重複。「手術＋抗がん剤」は情報なので残す
      extras: [g?.surgeryType === '手術で切除' ? '' : g?.surgeryType, g?.resection].filter(Boolean),
    }),
    detailLine('膵臓癌', pa, {
      prefix: surgicalPrefix(pa, '術後'),
      extras: [pa?.surgeryType === '手術で切除' ? '' : pa?.surgeryType, pa?.resection].filter(Boolean),
    }),
    detailLine(ihdName(dis.ihd), dis.ihd),
    detailLine('脳梗塞後', dis.stroke),
  ].filter(Boolean)
}

// DM差分問診の重要既往（採血で DM 判明後にスタッフが追記）。
// ★チェックは 4 つ独立だが詳細（detail）は 1 つしか無い。1 つだけ選ばれていれば
//   その疾患の詳細と断定できるので ♯行に入れる。複数選択のときは誤って結び付けず、
//   申し送りに「□重要既往の詳細：…」として出す（buildDmDiffHandoffLines 側）。
export function buildDmDiffImportantLines(d) {
  if (!hasDmDiff(d)) return []
  const p = d.dmDiff?.importantPast || {}
  const names = [
    p.gastricCancer && '胃癌',
    p.pancreasCancer && '膵臓癌',
    p.ihd && 'IHD',
    p.stroke && '脳梗塞後',
  ].filter(Boolean)
  const detail = (p.detail || '').trim()
  if (names.length === 1 && detail) return [`♯${names[0]}（${detail}）`]
  return names.map(n => `♯${n}`)
}

// ── ♯既往疾患のリスト全体 ─────────────────────────────────
export function buildPastHistoryLines(d) {
  const lines = [...buildImportantHistoryLines(d), ...buildDmDiffImportantLines(d)]

  // その他の病名・既往歴（1疾患1行。通院先「その他」は自由入力の病院名を使う）
  const otherText = buildOtherDiseasesText(pickOtherDiseases(d))
  if (otherText && otherText !== 'なし') {
    for (const item of otherText.split('、')) lines.push(`♯${item}`)
  }

  // 音声入力からの既往歴（入力時点で ♯病名（時期・病院・薬）形式に整形済み）
  const voice = (d?.voicePastHistory?.aiSummary || '').trim()
  if (voice) {
    for (const l of voice.split('\n').map(s => s.trim()).filter(Boolean)) {
      lines.push(l.startsWith('♯') || l.startsWith('＃') ? l : `♯${l}`)
    }
  }
  return lines
}

// merged（AI の統合結果）があればそちらを優先する
function pastHistoryLines(d, merged) {
  return Array.isArray(merged?.pastHistory) && merged.pastHistory.length
    ? merged.pastHistory.map(l => String(l).trim()).filter(Boolean)
    : buildPastHistoryLines(d)
}

// ── アレルギー薬の警告 ───────────────────────────────────
// 今のプロンプトの指示は「**アレルギー薬**がある場合のみ ⚠️○○アレルギー⚠️」。
// 花粉・食物・金属は薬剤ではないので警告を出さない（出すと投薬禁忌の誤認を招く）。
// 判定できない自由入力は薬剤側に倒す（警告を出す方が安全側）。
const NON_DRUG_ALLERGY = ['花粉', 'フルーツ', '果物', '金属', 'ハウスダスト', 'ダニ', '動物', 'ラテックス', '食物']

export function buildDrugAllergyWarning(d) {
  const h = d?.history || {}
  if (h.allergy === 'なし') return ''
  const items = String(h.allergyDetail || '').split(/[・、,／\/]/).map(x => x.trim()).filter(Boolean)
  const drugs = items.filter(x => !NON_DRUG_ALLERGY.some(n => x.includes(n)))
  if (!drugs.length) return ''
  return `⚠️${drugs.join('・')}アレルギー⚠️`
}

// ── 【FH】 ────────────────────────────────────────────────
// 枠を作らない = 聞いていないことを (-) と断定しない（院長判断 2026-09-06）。
// DM基本 / 1型 / 妊娠糖尿病 のフォームは家族歴に HL を持たない（HTHL/RH/内分泌/SAS は持つ）。
export function buildFhLine(d, { hl = false } = {}) {
  const fh = d?.history?.fh || {}
  // DM差分問診（採血で DM 判明後の追加聴取）でも家族歴を聞き直すので取り込む
  const diff = hasDmDiff(d) ? (d.dmDiff || {}) : {}
  const hasDmFh = fh.dm || diff.fhDm
  const who = [...new Set([...(fh.dmWho || []), ...(diff.fhDmWho || [])])].join('・')
  const dm = hasDmFh ? (who ? `(+：${who})` : '(+)') : '(-)'
  const cells = [`DM${dm}`, `HT(${fh.ht ? '+' : '-'})`]
  if (hl) cells.push(`HL(${fh.hl || diff.fhHl ? '+' : '-'})`)
  cells.push(`APO(${fh.apo ? '+' : '-'})`, `IHD(${fh.ihd ? '+' : '-'})`)
  return `【FH】${cells.join(' ')}`
}

// 小児1型は 1型糖尿病・膠原病 の枠を追加で持つ
function buildPedFhLine(d) {
  const fh = d?.history?.fh || {}
  const withWho = (on, who) => (on ? ((who || []).length ? `(+：${(who || []).join('・')})` : '(+)') : '(-)')
  const collagen = fh.collagen
    ? (() => {
        const items = (fh.collagenItems || [])
          .map(x => [x?.who, x?.disease].filter(Boolean).join(' ')).filter(Boolean)
        return items.length ? `(+：${items.join('・')})` : '(+)'
      })()
    : '(-)'
  return `【FH】DM${withWho(fh.dm, fh.dmWho)} 1型糖尿病${withWho(fh.dm1, fh.dm1Who)} 膠原病${collagen} ` +
    `HT(${fh.ht ? '+' : '-'}) APO(${fh.apo ? '+' : '-'}) IHD(${fh.ihd ? '+' : '-'})`
}

// 甲状腺フォームは 甲状腺・DM の 2 枠だけ
function buildThyroidFhLine(d) {
  const fh = d?.history?.fh || {}
  const withWho = (on, who) => (on ? ((who || []).length ? `(+：${(who || []).join('・')})` : '(+)') : '(-)')
  return `【FH】甲状腺${withWho(fh.thyroid, fh.thyroidWho)} DM${withWho(fh.dm, fh.dmWho)}`
}

// 内分泌のみ: 家族歴の自由記入（誰が／病気名、複数組）を【FH】行の末尾に全角スペースで足す
function fhOtherText(d) {
  const pair = (who, dis) => {
    const w = (who || '').trim(), s = (dis || '').trim()
    if (w && s) return `${w}：${s}`
    return w || s || ''
  }
  const rows = (d?.history?.fhOthers || []).map(f => pair(f.who, f.disease)).filter(Boolean)
  if (rows.length) return rows.join('、')
  return pair(d?.history?.fhOtherWho, d?.history?.fhOtherDisease) || (d?.history?.fhOther || '').trim()
}

// ── 【眼科通院歴】 ────────────────────────────────────────
export function buildEyeLine(d) {
  const h = d?.history || {}
  const v = h.eyeFundusCheck || ''
  // 未入力は空欄にする（院長判断 2026-09-06）。「未受診」と書くと聞いていないことを断定してしまう
  if (!v) return '【眼科通院歴】'
  if (v === '受けていない') return '【眼科通院歴】未受診'
  if (v === '今後受ける予定') return '【眼科通院歴】今後受ける予定'
  const parts = [h.eye, h.retinopathy, h.glaucoma].filter(Boolean)
  return `【眼科通院歴】${parts.join('・')}`
}

// DM差分問診（採血で DM 判明）側の眼科情報から組み立てる
function buildEyeLineFromDmDiff(d) {
  const dm = d?.dmDiff || {}
  const v = dm.eyeFundusCheck || ''
  if (!v) return '【眼科通院歴】'
  if (v === '受けていない') return '【眼科通院歴】未受診'
  if (v === '今後受ける予定') return '【眼科通院歴】今後受ける予定'
  const parts = [dm.eyeClinic, dm.retinopathy].filter(Boolean)
  return `【眼科通院歴】${parts.join('・')}`
}

// ── 【仕事】 ──────────────────────────────────────────────
// 「していない」を選んだときは就労なしと明記する（院長判断 2026-09-06）。
// 空欄のままだと「無職」なのか「聞き漏らした」のか区別が付かないため。
export function buildJobLine(d) {
  const src = d?.lifestyle || d?.history || {}
  // 「していない」でも活動量は落とさない（AI 版は「仕事なし・立っていることが多い」と書いていた）
  const head = src.work === 'していない' ? '就労なし' : buildJobStr(d)
  return `【仕事】${[head, src.activity].filter(Boolean).join('・')}`
}

// ── 【アレルギー歴】〜【仕事】の共通ブロック ────────────────
// フォームごとに「どの行を持つか」だけが違うのでフラグで切り替える。
function buildProfileLines(d, {
  fhLine,                 // 文字列（フォームごとに枠が違う）
  alcohol = 'auto',       // 'auto' | 固定文字列 | null（行ごと省略）
  eye = null,             // null（省略）| 'history' | 'dmDiff'
  checkup = true,
  vaccine = true,
  living = true,
  job = true,
} = {}) {
  const h = d?.history || {}
  const age = parseInt(h.age, 10) || 0
  const lines = [
    `【アレルギー歴】${h.allergy === 'なし' ? 'なし' : (h.allergyDetail || 'あり')}`,
    fhLine,
  ]
  if (alcohol === 'auto') lines.push(`【飲酒歴】${buildAlcohol(d)}`)
  else if (typeof alcohol === 'string') lines.push(`【飲酒歴】${alcohol}`)
  lines.push(`【喫煙歴】${buildSmoking(d)}`)
  if (eye === 'history') lines.push(buildEyeLine(d))
  else if (eye === 'dmDiff') lines.push(buildEyeLineFromDmDiff(d))
  // 未選択なら値なしの空欄（院長判断 2026-09-06）
  if (checkup) lines.push(`【健診】${(h.checkup || []).join('・')}`)
  if (vaccine && age >= 60) {
    const vac = [
      h.vaccine65Prevena ? `プレベナー20：${h.vaccine65Prevena}` : '',
      h.vaccine65Herpes ? `帯状疱疹：${h.vaccine65Herpes}` : '',
    ].filter(Boolean).join('　')
    if (vac) lines.push(`【ワクチン歴】${vac}`)
  }
  if (living) {
    const text = [buildLiving(d), age >= 70 ? buildChildInfo(d) : ''].filter(Boolean).join('、')
    lines.push(`【生活情報】${text}`)
  }
  if (job) lines.push(buildJobLine(d))
  return lines
}

// ── 身長・体重の 1 行 ──────────────────────────────────────
function buildBodyLine(d, { pregnancy = false, short = false } = {}) {
  const b = d?.body || {}
  const bmi = buildBmi(d)
  const head = `身長:${b.height || '○'}cm　初診時:${b.weightNow || '○'}kg${bmi ? `（BMI ${bmi}）` : ''}`
  if (short) return head
  const pre = pregnancy ? `　妊娠前:${b.weightPregnancy || '○'}kg` : ''
  return `${head}${pre}　20歳時:${b.weight20 || '○'}kg　max体重${b.weightMax || '○'}kg(${b.weightMaxAge || '○'}歳)`
}

// ── フッター ──────────────────────────────────────────────
// 「R8.9：…」→ 空行 4 つ（医師の記入欄）→ アレルギー薬警告 →（目標行）→ 採血セット …
function buildFooterLines(d, {
  header,               // 1 行目
  goalLine = true,      // 目標HbA1c 行を出すか（内分泌の非DM時だけ出さない）
  bloodSet,             // 'DM基本セット' / '基本採血なし' / null
  trailing = [],        // follow / 曜希望 / LINE …
} = {}) {
  const lines = [header, '', '', '', '']
  const warning = buildDrugAllergyWarning(d)
  if (warning) lines.push(warning)
  if (goalLine) lines.push('目標HbA1c　　　　%　目標体重　　　次回検討薬：')
  if (bloodSet) lines.push(bloodSet)
  lines.push(...trailing)
  return lines
}

const COMMON_FOOTER_HEADER = (now) =>
  `${getCurrentMonth(now)}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。`

// 「1月follow / ○曜希望 / LINE登録…」の定型 3 行
const followTrailing = (d, follow = '1月follow') => [follow, buildWeekday(d), 'LINE登録ご案内→済　登録確認未・登録できない']

// ── 申し送り: 全フォーム共通の先頭 ─────────────────────────
function handoffHead(d) {
  const lines = ['□通院のご案内をお渡し済']
  if (d?.voiceMemo?.needsDoctorReview) lines.push('□現病歴：問診時間の関係で一部省略、要DR確認')
  if (d?.voicePastHistory?.needsDoctorReview) lines.push('□既往歴：要ドクター確認')
  return lines
}

// ── 申し送り: DM差分問診（採血で DM 判明）由来 ───────────────
function buildDmDiffHandoffLines(d) {
  if (!hasDmDiff(d)) return []
  const dm = d.dmDiff || {}
  const lines = ['□採血で DM判明 → DM初期評価追加実施済']
  if (dm.eyeFundusCheck === '受けていない' || dm.eyeNotebook === '持っていない') {
    lines.push('□糖尿病-眼科連携手帳をお渡し')
  }
  if (hasWeightLoss(dm.weightLoss)) lines.push('□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討')
  // 重要既往が複数選択のときは詳細をどの疾患に結び付けるか決められないので申し送りに出す
  const p = dm.importantPast || {}
  const count = [p.gastricCancer, p.pancreasCancer, p.ihd, p.stroke].filter(Boolean).length
  const detail = (p.detail || '').trim()
  if (count > 1 && detail) lines.push(`□重要既往の詳細：${detail}`)
  if (dm.pastHbA1c) lines.push(`□過去のHbA1c・血糖の指摘：${dm.pastHbA1c}`)
  if (dm.treatmentWish) lines.push(`□治療の希望：${dm.treatmentWish}`)
  if ((dm.freeText || '').trim()) lines.push(`□DM差分問診の自由記載：${dm.freeText.trim()}`)
  return lines
}

// ── 【糖尿病の症状】/【SASの症状】セクション ─────────────────
function symptomSection(label, text) {
  return text ? [`【${label}】${text}`, DIVIDER] : []
}

// ══════════════════════════════════════════════════════════
// DM基本
// ══════════════════════════════════════════════════════════
function buildDM(d, now, merged) {
  const month = getCurrentMonth(now)
  const h = d?.history || {}
  const dis = d?.disease || {}
  const out = []

  if (hasWeightLoss(d?.alert?.weightLoss)) {
    out.push('【⚠️ 体重減少あり・早急なインスリン導入を検討】', '')
  }

  // 受診理由サマリー → ＃主病名（空行なし）
  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(`${month}：${summary}`)
  out.push(d?.reason?.dmConcern ? '＃糖尿病 or IGT or 正常耐糖能' : `＃糖尿病${dmOnsetText(d)}`)
  if (dis.ht) out.push('＃HT')
  if (dis.hl) out.push('＃HL')

  // 自院管理ブロック → 他院管理（♯既往）の前にだけ1行空ける（空行ルール②）
  const past = pastHistoryLines(d, merged)
  if (past.length) out.push('', ...past)

  // 他院管理の最終行と【アレルギー歴】の間は空行なし（空行ルール④）
  out.push(...buildProfileLines(d, { fhLine: buildFhLine(d), eye: 'history' }))

  out.push(DIVIDER)
  out.push(buildEchoLine(dis.echoNeck, dis.echoAbdomen, { neckFallback: '未記入', abdomenFallback: '未記入' }))
  out.push(DIVIDER)
  out.push(buildBodyLine(d))
  out.push(DIVIDER)
  out.push(...symptomSection('糖尿病の症状', buildDmSymptoms(dis.dmSymptoms)))

  out.push('【事前聴取時　申し送り事項】')
  out.push(...handoffHead(d))
  if (h.eyeFundusCheck === '受けていない' || h.eyeNotebook === '持っていない') out.push('□糖尿病-眼科連携手帳をお渡し')
  if (hasWeightLoss(d?.alert?.weightLoss)) out.push('□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討')
  if (dis.ht) out.push('□HTの確認のため、血圧手帳をお渡ししています。')
  if (dis.hl) out.push('□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。')
  if (!dis.insulinUse) out.push('□生活習慣病療養計画書を作成済')
  if (d?.reason?.dmConcern) out.push('□血糖、HbA1cの結果により上段の診断を確定してください')
  out.push(...buildStaffFlagLines(d?.body))
  // 申し送りの最終□行と【診察にあたっての要望】の間は空行なし（空行ルール⑤）
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(...buildFooterLines(d, {
    header: COMMON_FOOTER_HEADER(now),
    bloodSet: 'DM基本セット',
    trailing: followTrailing(d),
  }))
  return out.join('\n')
}

// ══════════════════════════════════════════════════════════
// 1型糖尿病
// ══════════════════════════════════════════════════════════
function buildT1D(d, now, merged) {
  const month = getCurrentMonth(now)
  const dis = d?.disease || {}
  const h = d?.history || {}
  const r = d?.reason || {}
  const out = []

  if (hasWeightLoss(d?.alert?.weightLoss)) {
    out.push('【⚠️ 体重減少あり・早急なインスリン導入を検討】', '')
  }

  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(`${month}：${summary}`)
  out.push(`＃1型糖尿病（${dis.dm1type || 'タイプ不明'}）${dmOnsetText(d)}`)
  out.push('・GAD抗体：（初診時採血）')
  out.push('・CPR：（初診時採血）')
  out.push(`・甲状腺検査：（${dis.thyroidChecked ? '初診時採血済' : '初診時採血'}）`)
  const kosei = dis.pensionKosei === 'はい（加入していた）' ? '有'
    : dis.pensionKosei === 'いいえ（未加入）' ? '無' : '不明'
  const pension = dis.pensionStatus === '受給中' ? '受給中'
    : dis.pensionKosei === 'はい（加入していた）' ? 'CPR次第' : '受給困難（×）'
  out.push(`・障害年金：DM診断時厚生年金加入（${kosei}）→${pension}`)
  if (dis.ht) out.push('＃HT')
  if (dis.hl) out.push('＃HL')

  const past = pastHistoryLines(d, merged)
  if (past.length) out.push('', ...past)

  out.push(DIVIDER)
  out.push(...buildProfileLines(d, { fhLine: buildFhLine(d), eye: 'history' }))
  out.push(DIVIDER)
  out.push('頚部エコー：当院で施行予定　腹部エコー：当院で施行予定')
  out.push(DIVIDER)
  out.push(buildBodyLine(d))
  out.push(DIVIDER)
  out.push(...symptomSection('糖尿病の症状', buildDmSymptoms(dis.dmSymptoms)))

  out.push('【事前聴取時　申し送り事項】')
  out.push(...handoffHead(d))
  if (h.eyeFundusCheck === '受けていない' || h.eyeNotebook === '持っていない') out.push('□糖尿病-眼科連携手帳をお渡し')
  if (hasWeightLoss(d?.alert?.weightLoss)) out.push('□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討')
  if (dis.pensionKosei === 'はい（加入していた）' && dis.pensionStatus !== '受給中') {
    out.push('□障害年金の可能性あり→CPR結果を確認してください')
  }
  const wish = v => v && v !== '希望なし'
  const using = v => v && v !== '使用していない'
  if (wish(r.cgmWish) || wish(r.pumpWish)) {
    out.push(`□使用希望デバイス：CGM=${r.cgmWish || 'なし'}　ポンプ=${r.pumpWish || 'なし'}`)
  }
  out.push('□甲状腺3項目・GAD抗体・CPRを初診時採血')
  if (dis.insulinStatus !== 'インスリン使用中') out.push('□初回療養計画書を作成済')
  if (wish(r.cgmWish)) out.push(`□CGM：${using(r.cgmCurrent) ? `${r.cgmCurrent}使用中→` : ''}${r.cgmWish}`)
  if (wish(r.pumpWish)) out.push(`□インスリンポンプ：${using(r.pumpCurrent) ? `${r.pumpCurrent}使用中→` : ''}${r.pumpWish}`)
  out.push(...buildStaffFlagLines(d?.body))
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(...buildFooterLines(d, {
    header: COMMON_FOOTER_HEADER(now),
    bloodSet: 'DM基本セット',
    trailing: followTrailing(d),
  }))
  return out.join('\n')
}

// ══════════════════════════════════════════════════════════
// 小児1型糖尿病
// ══════════════════════════════════════════════════════════
function buildPedT1D(d, now, merged) {
  const month = getCurrentMonth(now)
  const dis = d?.disease || {}
  const sup = d?.support || {}
  const ch = d?.chronic || {}
  const h = d?.history || {}
  const out = []

  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(`${month}：${summary}`)
  out.push(`＃1型糖尿病（${dis.dm1type || 'タイプ不明'}）${dmOnsetText(d)}`)
  // ★・行は ＃1型糖尿病 の内訳なので診断名の直下に置く（成人1型と同じ並び）。
  //   旧プロンプトの雛形は ♯他院管理 の後ろに ・行を置いていたが、
  //   ＃1型糖尿病 と内訳の間に別疾患が挟まる並びになるため揃えた。
  out.push('・GAD抗体：（初診時採血）')
  out.push('・CPR：（初診時採血）')
  out.push(`・甲状腺検査：（${dis.thyroidChecked ? '確認済' : '初診時採血'}）`)
  out.push(`・バクスミー希望：${dis.bakusmi === '希望あり' ? 'あり' : dis.bakusmi === '希望なし' ? 'なし' : ''}`)

  const chronicDetail = [
    ch.birthWeight ? `出生体重${ch.birthWeight}g` : '',
    ch.birthWeek ? `在胎${ch.birthWeek}週${ch.birthWeekDay ? `${ch.birthWeekDay}日` : ''}` : '',
    ch.birthCity ? `出生時住民登録：${ch.birthCity === 'その他' ? (ch.birthCityOther || 'その他') : ch.birthCity}` : '',
    (ch.booklets || []).length ? `手帳：${(ch.booklets || []).join('・')}` : '',
  ].filter(Boolean).join('、')
  out.push(`・小児慢性特定疾病助成制度：${ch.status || ''}${chronicDetail ? `（${chronicDetail}）` : ''}`)
  out.push(`・書類関係：${(ch.documents || []).join('・')}`)
  out.push(`・居住地：${ch.residenceCity || ''}`)
  if (dis.ht) out.push('＃HT')
  if (dis.hl) out.push('＃HL')
  // 小児1型は「空行は一切入れない」（旧プロンプトの明示指示）
  out.push(...pastHistoryLines(d, merged))

  out.push(DIVIDER)
  out.push(`【アレルギー歴】${h.allergy === 'なし' ? 'なし' : (h.allergyDetail || 'あり')}`)
  out.push(buildPedFhLine(d))
  out.push(buildEyeLine(d))
  out.push('【協力体制】')
  const familySub = (sup.familySubList || []).join('・')
  out.push(`①家族の協力体制：${[sup.familyMain ? `主な管理者は${sup.familyMain}` : '', familySub ? `サポート：${familySub}` : '', sup.familyNote].filter(Boolean).join('、')}`)
  out.push(`②学校の協力体制：${(sup.schoolStaff || []).join('・')}`)
  out.push(`③学校でサポートしてくれる人：${[(sup.schoolSupportPerson || []).join('・'), sup.schoolSupportNote].filter(Boolean).join('、')}`)
  out.push(`④開示状況（クラスメート）：${sup.disclosedChild || ''}`)
  out.push(`④開示状況（先生）：${sup.disclosedTeacher || ''}`)
  out.push(`【本人のスケジュール】${[sup.childGrade, (sup.childActivities || []).join('・'), sup.childActivityNote].filter(Boolean).join('、')}`)
  out.push(`【親のスケジュール】${[
    (sup.parentWorkMain || []).length ? `母：${(sup.parentWorkMain || []).join('・')}${sup.parentWorkMainNote ? `（${sup.parentWorkMainNote}）` : ''}` : '',
    (sup.parentWorkSub || []).length ? `父：${(sup.parentWorkSub || []).join('・')}${sup.parentWorkSubNote ? `（${sup.parentWorkSubNote}）` : ''}` : '',
  ].filter(Boolean).join('　')}`)
  out.push(`【注射・血糖測定の自立度】${[sup.independenceLevel, sup.independenceNote].filter(Boolean).join('、')}`)
  out.push(`【生活情報】家族構成・キーパーソン：${[buildLiving(d), h.keyPerson].filter(Boolean).join('、')}`)

  out.push(DIVIDER)
  out.push(buildBodyLine(d, { short: true }))
  out.push(DIVIDER)
  out.push(...symptomSection('糖尿病の症状', buildDmSymptoms(dis.dmSymptoms)))

  out.push('【事前聴取時　申し送り事項】')
  out.push(...handoffHead(d))
  if (h.eyeFundusCheck === '受けていない' || h.eyeNotebook === '持っていない') out.push('□糖尿病-眼科連携手帳をお渡し')
  out.push('□甲状腺3項目・GAD抗体・CPRを初診時採血')
  if (dis.ht) out.push('□HTの確認のため、血圧手帳をお渡ししています。')
  if (dis.hl) out.push('□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。')
  if ((ch.documents || []).includes('学校生活管理指導表')) out.push('□4月頃に処方')
  if (ch.status === '申請済') out.push('□小児慢性申請済・窓口負担を確認し算定へ連絡')
  if (ch.maternalHandbook === '忘れた') out.push('□次回以降、母子手帳を確認してください')
  out.push(...buildStaffFlagLines(d?.body))
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(...buildFooterLines(d, {
    header: COMMON_FOOTER_HEADER(now),
    bloodSet: 'DM基本セット',
    trailing: followTrailing(d),
  }))
  return out.join('\n')
}

// ══════════════════════════════════════════════════════════
// 高血圧・脂質異常症 / 内分泌（同一構成。内分泌は主病名を出さない）
// ══════════════════════════════════════════════════════════
function buildHthlOrEndocrine(d, now, merged, { endocrine }) {
  const month = getCurrentMonth(now)
  const dis = d?.disease || {}
  const hasDm = hasDmDiff(d)
  const out = []

  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(`${month}：${summary}`)
  // 内分泌は主病名を医師が診察時に確定するため ＃行を出さない。
  // 例外は採血で確定した ＃糖尿病 だけ（推測ではないため）。
  if (hasDm) out.push(`＃糖尿病${dmDiffOnsetText(d)}`)
  if (!endocrine) {
    if (dis.igt && !hasDm) out.push('＃IGT')
    if (dis.ht) out.push('＃HT')
    if (dis.hl) out.push('＃HL')
  }

  const past = pastHistoryLines(d, merged)
  if (past.length) out.push('', ...past)

  let fh = buildFhLine(d, { hl: true })
  if (endocrine) {
    const extra = fhOtherText(d)
    if (extra) fh = `${fh}　${extra}`
  }
  out.push(...buildProfileLines(d, { fhLine: fh, eye: hasDm ? 'dmDiff' : null }))

  out.push(DIVIDER)
  out.push(buildEchoLine(dis.echoNeck, dis.echoAbdomen, { abdomenFallback: '未選択' }))
  out.push(DIVIDER)
  out.push(buildBodyLine(d))
  out.push(DIVIDER)
  if (hasDm) out.push(...symptomSection('糖尿病の症状', buildDmSymptoms(d.dmDiff?.dmSymptoms)))

  out.push('【事前聴取時　申し送り事項】')
  out.push(...handoffHead(d))
  if (endocrine) out.push('□主病名：医師の診察時に確定・記載')
  out.push(...buildDmDiffHandoffLines(d))
  if (!endocrine && dis.hl) out.push('□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。')
  const cp = dis.carePlanDiseases || {}
  const needsCarePlan = !!(cp.dm || cp.ht || cp.hl)
  if (!endocrine || needsCarePlan || hasDm) out.push('□初回療養計画書を作成済')
  out.push(...buildStaffFlagLines(d?.body))
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(...buildFooterLines(d, {
    header: hasDm ? COMMON_FOOTER_HEADER(now) : `${month}：`,
    // 内分泌の非DM時だけ 目標HbA1c 行を出さない（旧プロンプト踏襲）
    goalLine: hasDm || !endocrine,
    bloodSet: hasDm ? 'DM基本セット' : '基本採血なし',
    trailing: followTrailing(d),
  }))
  return out.join('\n')
}

// DM差分問診で聴取した発症時期
function dmDiffOnsetText(d) {
  const dm = d?.dmDiff || {}
  if (dm.diabetesOnsetUnknown) return ''
  if (!dm.diabetesOnsetYear) return '（採血で判明）'
  return `（${dm.diabetesOnsetEra || '令和'}${dm.diabetesOnsetYear}年${dm.diabetesOnsetNote ? `・${dm.diabetesOnsetNote}` : ''}）`
}

// ══════════════════════════════════════════════════════════
// 妊娠糖尿病
// ══════════════════════════════════════════════════════════
function buildGDM(d, now, merged) {
  const month = getCurrentMonth(now)
  const dis = d?.disease || {}
  const h = d?.history || {}
  const out = []

  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(`${month}：${summary}`)
  const isCombined = dis.dmType === '糖尿病合併妊娠'
  out.push(isCombined ? '＃糖尿病合併妊娠' : '＃妊娠糖尿病')
  const due = dis.dueDateYear ? `${dis.dueDateEra || '令和'}${dis.dueDateYear}年${dis.dueDateMonth || ''}月` : ''
  out.push(`　現在${dis.currentWeek || ''}週${due ? `、${due}` : ''}`)
  out.push(`　産科通院先：${dis.obHospital === 'その他' ? (dis.obHospitalOther || '') : (dis.obHospital || '')}`)
  const pastGdm = (() => {
    if (!dis.pastGDM) return ''
    if (dis.pastGDM !== 'あり') return dis.pastGDM
    const rows = (dis.pastGDMChild || [])
      .map((c, i) => (c?.had ? `第${i + 1}子：${c.had}${c.year ? `（${c.era || '令和'}${c.year}年）` : ''}` : ''))
      .filter(Boolean)
    return rows.length ? `あり（${rows.join('、')}）` : 'あり'
  })()
  if (pastGdm) out.push(`　過去の妊娠糖尿病歴：${pastGdm}`)
  if (dis.ht) out.push('＃HT')
  if (dis.hl) out.push('＃HL')

  const past = pastHistoryLines(d, merged)
  if (past.length) out.push('', ...past)

  // 妊娠中は飲酒なし固定。健診・ワクチン歴は記載不要（糖尿病合併妊娠のみ眼科通院歴を出す）
  out.push(...buildProfileLines(d, {
    fhLine: buildFhLine(d),
    alcohol: 'なし（妊娠中）',
    eye: isCombined ? 'history' : null,
    checkup: false,
    vaccine: false,
  }))

  out.push(DIVIDER)
  out.push(buildEchoLine(dis.echoNeck, dis.echoAbdomen))
  out.push(DIVIDER)
  out.push(buildBodyLine(d, { pregnancy: true }))
  out.push(DIVIDER)

  out.push('【事前聴取時　申し送り事項】')
  out.push(...handoffHead(d))
  if (isCombined && (h.eyeFundusCheck === '受けていない' || h.eyeNotebook === '持っていない')) {
    out.push('□糖尿病-眼科連携手帳をお渡し')
  }
  if (dis.hl) out.push('□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。')
  out.push('□リブレ（自費CGM）取り付けに同意済')
  if (h.smoking === 'あり') out.push('□喫煙確認あり・指導必要')
  out.push(...buildStaffFlagLines(d?.body))
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(...buildFooterLines(d, {
    header: COMMON_FOOTER_HEADER(now),
    bloodSet: 'DM基本セット',
    trailing: followTrailing(d),
  }))
  return out.join('\n')
}

// ══════════════════════════════════════════════════════════
// 反応性低血糖
// ══════════════════════════════════════════════════════════
function buildRH(d, now, merged) {
  const month = getCurrentMonth(now)
  const s = d?.symptom || {}
  const hasDm = hasDmDiff(d)
  const out = []

  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(`${month}：${summary}`)
  if (hasDm) out.push(`＃糖尿病${dmDiffOnsetText(d)}`)
  out.push('♯反応性低血糖疑い')
  out.push(`・低血糖が生じるタイミング：${joinNote(s.timing, s.timingNote)}`)
  out.push(`・症状：${joinNote(s.symptoms, s.symptomsNote)}`)
  out.push(`・思い当たる原因：${joinNote(s.cause, s.causeNote)}`)

  const past = pastHistoryLines(d, merged)
  if (past.length) out.push('', ...past)

  out.push(...buildProfileLines(d, {
    fhLine: buildFhLine(d, { hl: true }),
    eye: hasDm ? 'dmDiff' : null,
  }))

  out.push(DIVIDER)
  out.push('頚部エコー：当院で施行予定　腹部エコー：当院で施行予定')
  out.push(DIVIDER)
  out.push(buildBodyLine(d))
  out.push(DIVIDER)
  if (hasDm) out.push(...symptomSection('糖尿病の症状', buildDmSymptoms(d.dmDiff?.dmSymptoms)))

  out.push('【事前聴取時　申し送り事項】')
  out.push('□通院のご案内をお渡し済')
  if (d?.voiceMemo?.needsDoctorReview) out.push('□現病歴：問診時間の関係で一部省略、要DR確認')
  // 反応性低血糖疑いは全例必須記載（条件分岐ではない）
  out.push('□自費CGM（リブレ）装着済')
  if (d?.voicePastHistory?.needsDoctorReview) out.push('□既往歴：要ドクター確認')
  out.push(...buildDmDiffHandoffLines(d))
  out.push(...buildStaffFlagLines(d?.body))
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(...buildFooterLines(d, {
    header: COMMON_FOOTER_HEADER(now),
    bloodSet: 'DM基本セット',
    trailing: followTrailing(d),
  }))
  return out.join('\n')
}

// ══════════════════════════════════════════════════════════
// 睡眠時無呼吸症候群
// ══════════════════════════════════════════════════════════
function sasCategoryLabel(c) {
  return c === 'cpap' ? 'CPAP治療の継続希望'
    : c === 'screening' ? '睡眠時無呼吸症候群の検査希望（簡易PSG予定）'
      : '未選択'
}

function buildSAS(d, now, merged) {
  const month = getCurrentMonth(now)
  const r = d?.reason || {}
  const dis = d?.disease || {}
  const hasDm = hasDmDiff(d)
  const out = []

  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(`${month}：${summary}`)

  const cat = r.sasCategory || ''
  out.push(cat === 'screening' ? '＃SAS疑い（簡易PSG予定）'
    : cat === 'cpap' ? `＃SAS（${r.cpapPriorClinic ? `前医：${r.cpapPriorClinic}、` : ''}CPAP継続）`
      : '＃SAS')
  if (hasDm) out.push(`＃糖尿病${dmDiffOnsetText(d)}`)
  if (dis.ht) out.push('＃HT')
  if (dis.hl) out.push('＃HL')

  const past = pastHistoryLines(d, merged)
  if (past.length) out.push('', ...past)

  out.push(...symptomSectionNoDivider('SASの症状', buildDmSymptoms(d?.symptom?.sasSymptoms)))
  if (hasDm) out.push(...symptomSectionNoDivider('糖尿病の症状', buildDmSymptoms(d.dmDiff?.dmSymptoms)))

  // SAS は【眼科通院歴】を持たない（DM差分があっても旧プロンプトは出していない）
  out.push(...buildProfileLines(d, { fhLine: buildFhLine(d, { hl: true }) }))

  out.push(DIVIDER)
  out.push(buildEchoLine(dis.echoNeck, dis.echoAbdomen, { abdomenFallback: '未選択' }))
  out.push(DIVIDER)
  out.push(buildBodyLine(d))
  out.push(DIVIDER)

  out.push('【事前聴取時　申し送り事項】')
  out.push(...handoffHead(d))
  if (cat === 'screening') out.push('□SAS 簡易PSG発送手配 要')
  if (cat === 'cpap') {
    out.push(r.cpapPriorRecordsConfirmed === true
      ? '□CPAP継続：前医情報提供書 確認済'
      : '□CPAP継続：前医情報提供書 確認要')
  }
  out.push(...buildDmDiffHandoffLines(d))
  if (dis.hl) out.push('□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。')
  out.push('□初回療養計画書を作成済')
  out.push(...buildStaffFlagLines(d?.body))
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(...buildFooterLines(d, {
    header: hasDm ? COMMON_FOOTER_HEADER(now) : `${month}：`,
    bloodSet: hasDm ? 'DM基本セット' : '基本採血なし',
    trailing: followTrailing(d),
  }))
  return out.join('\n')
}

// SAS の症状セクションは【アレルギー歴】の直前に並ぶので区切り線を付けない
function symptomSectionNoDivider(label, text) {
  return text ? [`【${label}】${text}`] : []
}

// ══════════════════════════════════════════════════════════
// 甲状腺 6 フォーム
// ══════════════════════════════════════════════════════════
const THYROID_TYPE = {
  '甲状腺（バセドウ初診）': 'basedow-new',
  '甲状腺（バセドウ継続）': 'basedow-cont',
  '甲状腺（橋本病）': 'hashimoto',
  '甲状腺（腫大異常なし）': 'nodule-normal',
  '甲状腺（腺腫経過観察）': 'adenoma',
  '甲状腺（腺腫悪性疑い）': 'malignant',
}

function buildThyroid(form_type, d, now) {
  const t = THYROID_TYPE[form_type]
  const is2step = t === 'nodule-normal' || t === 'malignant'
  const month = getCurrentMonth(now)
  const h = d?.history || {}
  const e = d?.echo || {}
  const out = []

  // ── ＃診断名 ──
  const diagnosisName = (() => {
    if (t === 'basedow-new') return '＃バセドウ病疑い（エコー上の疑い）'
    if (t === 'basedow-cont') {
      const y = h.diagnosisYear ? `${h.diagnosisEra || '令和'}${h.diagnosisYear}年` : '診断時期不明'
      return `＃バセドウ病　甲状腺機能亢進症（診断時期：${y}）`
    }
    if (t === 'hashimoto') return '＃橋本病疑い（エコー上の疑い）'
    if (t === 'nodule-normal') return '＃甲状腺腫大（エコー上異常なし）'
    if (t === 'adenoma') return '＃甲状腺腺腫（経過観察）疑い'
    return '＃甲状腺腺腫（悪性疑い）'
  })()

  // ── 甲状腺ベース所見 3軸 ──
  const baseFindings = [
    e.thyroidSize === '腫大' && '甲状腺腫大(+)',
    e.thyroidSize === '萎縮' && '甲状腺萎縮(+)',
    e.thyroidBloodFlow === '豊富' && '血流豊富(+)',
    e.thyroidBloodFlow === '低下' && '血流低下(+)',
    e.thyroidParenchyma === '整' && '実質エコー整(+)',
    e.thyroidParenchyma === '不整' && '実質エコー不整(+)',
    e.thyroidParenchyma === '不均一' && '実質エコー不均一(+)',
  ].filter(Boolean)
  const baseText = baseFindings.join('、')

  const noduleLine = (() => {
    if (e.hasNodule !== 'あり') return ''
    const parts = []
    const word = e.noduleCount === '多発' ? '多発結節' : '結節'
    const w = e.noduleSizeW, dep = e.noduleSizeD
    if (e.noduleLocation && (w || dep)) parts.push(`${e.noduleLocation}に最大${w || '○'}×${dep || '○'}㎜大の${word}あり`)
    else if (e.noduleLocation) parts.push(`${e.noduleLocation}に${word}あり`)
    else if (w || dep) parts.push(`最大${w || '○'}×${dep || '○'}㎜大の${word}あり`)
    if (e.calcification) parts.push(`石灰化${e.calcification}`)
    if (e.noduleBloodFlow === '豊富') parts.push('血流豊富')
    else if (e.noduleBloodFlow === '乏しい') parts.push('血流に乏しい')
    if (e.noduleType) parts.push(e.noduleType)
    if (e.noduleOther) parts.push(e.noduleOther)
    return parts.join('、')
  })()

  const echoConclusion = (() => {
    if (t === 'malignant') return '当院エコーにて悪性を疑う所見を認め当日紹介。'
    if (t === 'adenoma') return '当院エコーにて結節を認めたため、エコー定期followとする。'
    if (t === 'nodule-normal') return baseFindings.length ? `当院エコーにて${baseText}を認める` : '当院エコーにて明らかな異常所見なし'
    if (!baseFindings.length) return ''
    if (t === 'basedow-new') return `当院エコーにて${baseText}を認めバセドウ病を疑う`
    if (t === 'basedow-cont') return `当院エコーにて${baseText}を認める`
    return `当院エコーにて${baseText}を認め橋本病を疑う`
  })()

  // ── 受診理由サマリー（甲状腺は音声入力を持たないのでここは常に JS 組立）──
  const symptoms = (d?.symptom?.selected || []).join('・') +
    (d?.symptom?.otherText ? `（その他: ${d.symptom.otherText}）` : '')
  const reasonText = (() => {
    const r = d?.reason || {}
    const parts = []
    if (r.thyroidConcern) {
      const arr = Array.isArray(r.thyroidConcernReason) ? r.thyroidConcernReason : (r.thyroidConcernReason ? [r.thyroidConcernReason] : [])
      const noOther = arr.filter(x => x !== 'その他')
      const otherText = arr.includes('その他') && r.thyroidConcernNote ? r.thyroidConcernNote : ''
      const text = [...noOther, otherText].filter(Boolean).join('・')
      parts.push(text ? `甲状腺疾患が気になって受診（${text}）` : '甲状腺疾患が気になって受診')
    } else if (r.type === '紹介') {
      const ref = [r.referralFrom, r.referralDept].filter(Boolean).join('・')
      if (ref) parts.push(`${ref}より紹介`)
      if (r.referralDetail) parts.push(r.referralDetail)
    } else if (r.type === '検診異常') {
      parts.push(`${r.checkupType || '健診'}にて甲状腺異常を指摘`)
    } else if (r.type === '自主転院') {
      if (r.transferFrom) parts.push(`${r.transferFrom}より転院`)
      if (r.transferDetail) parts.push(r.transferDetail)
    }
    if (r.summary) parts.push(r.summary)
    return parts.join('、')
  })()
  const summary = [
    reasonText ? (reasonText.endsWith('。') ? reasonText : `${reasonText}。`) : '',
    symptoms ? `${symptoms}の訴えあり。` : '',
  ].filter(Boolean).join('')

  out.push(`${month}：${summary}`)
  out.push(diagnosisName)

  // バセドウ継続の治療歴行
  if (t === 'basedow-cont') {
    const meds = (h.medications || []).join('・')
    if (meds) {
      const y = h.diagnosisYear
      const era = h.diagnosisEra || '令和'
      const dateStr = y ? (era === '令和' ? `R${y}${h.diagnosisMonth ? `/${h.diagnosisMonth}` : ''}` : `${era}${y}年${h.diagnosisMonth ? `${h.diagnosisMonth}月` : ''}`) : ''
      out.push(dateStr ? `${dateStr}に（${meds}）内服にて症状安定` : `（${meds}）内服にて症状安定`)
    }
    const surgery = h.surgeryHistory
      ? `あり（${[h.surgeryYear ? `R${h.surgeryYear}${h.surgeryMonth ? `/${h.surgeryMonth}` : ''}` : '', h.surgeryType || ''].filter(Boolean).join(' ')}）`
      : 'なし'
    const sideEffect = [h.sideEffectMmz && 'メルカゾール', h.sideEffectPtz && 'プロパジール'].filter(Boolean)
    out.push(`手術歴：${surgery}　アイソトープ歴：${h.isotopeHistory ? 'あり' : 'なし'}　` +
      `副作用歴：${sideEffect.length ? `${sideEffect.join('・')}副作用あり` : 'なし'}　` +
      `眼科：${h.eyeHistory ? `あり${h.eyeClinic ? `（${h.eyeClinic}）` : ''}` : 'なし'}`)
  }
  if (t === 'hashimoto' && h.treatmentHistory) out.push(`治療経緯：${h.treatmentHistory}`)
  if (echoConclusion) out.push(echoConclusion)
  if ((t === 'malignant' || t === 'adenoma') && baseFindings.length) out.push(`${baseText}を認める`)
  if (noduleLine) out.push(noduleLine)
  if (t === 'basedow-new' && e.ecg) out.push(`ECG：${e.ecg}`)

  // エコー所見ブロックと【アレルギー歴】の間だけ1行空ける
  out.push('')
  out.push(`【アレルギー歴】${h.allergy === 'なし' ? 'なし' : (h.allergyDetail || 'あり')}`)
  if (!is2step) {
    out.push(buildThyroidFhLine(d))
    out.push(`【喫煙歴】${buildSmoking(d)}`)
    out.push(`【健診】${(h.checkup || []).join('・')}`)
    if (t !== 'adenoma') out.push(buildJobLine(d))
  }

  out.push(DIVIDER)
  out.push((t === 'malignant' || t === 'nodule-normal' || t === 'adenoma')
    ? '空欄：検査技師が後ほど貼り付けます。'
    : `甲状腺エコー：${t === 'basedow-new' ? '' : ([baseText, noduleLine].filter(Boolean).join('　') || '本日施行')}`)
  out.push(DIVIDER)
  if (t !== 'malignant' && t !== 'adenoma') {
    out.push(buildBodyLine(d, { short: true }))
    out.push(DIVIDER)
  }

  out.push('【事前聴取時　申し送り事項】')
  if (t !== 'malignant') out.push('□通院のご案内をお渡し済')
  if (t === 'basedow-new' || t === 'hashimoto') {
    out.push('□甲状腺3項目＋甲状腺抗体3項目の結果を後日確認')
    out.push('□あくまでエコー上の疑いであり、確定診断は医師が行いカルテ記載を完了する')
  } else if (t === 'basedow-cont') {
    out.push('□甲状腺3項目＋甲状腺抗体3項目の結果を後日確認')
    out.push('□あくまでエコー上の所見であり、確定診断は医師が行いカルテ記載を完了する')
  } else if (t === 'nodule-normal') {
    out.push('□甲状腺3項目＋抗Tg抗体＋抗TPO抗体の結果を後日確認')
    out.push('□本日初診にて診察（終診の可能性あり）')
  } else if (t === 'adenoma') {
    out.push('□甲状腺3項目＋抗Tg抗体＋抗TPO抗体の結果を後日確認')
    out.push('□あくまでエコー上の所見であり、確定診断は医師が行いカルテ記載を完了する')
  } else {
    out.push('□当日、初事前診察に変更し専門医療機関へ紹介')
    out.push('□当院は終診')
  }
  out.push(...buildStaffFlagLines(d?.body))
  out.push(`【診察にあたっての要望】${d?.body?.concern || 'なし'}`)
  out.push(DIVIDER)

  const bloodTest = t === 'hashimoto' ? '甲状腺3項目＋甲状腺抗体3項目'
    : t === 'basedow-new' ? '甲状腺3項目：　TRAb：　TPO抗体：　抗Tg抗体：'
      : t === 'malignant' ? ''
        : '甲状腺3項目：　TRAb：　抗Tg抗体：　抗TPO抗体：'
  out.push(`${month}：${bloodTest}`)
  out.push('')
  const warning = buildDrugAllergyWarning(d)
  if (warning) out.push(warning)
  if (t === 'malignant') out.push('（当日紹介、当院終診）')
  else out.push(...followTrailing(d, t === 'adenoma' ? '6か月follow' : '1月follow'))

  return out.join('\n')
}

// ══════════════════════════════════════════════════════════
// 入口
// ══════════════════════════════════════════════════════════
const BUILDERS = {
  'DM基本': (d, now, merged) => buildDM(d, now, merged),
  '1型糖尿病': (d, now, merged) => buildT1D(d, now, merged),
  '小児1型糖尿病': (d, now, merged) => buildPedT1D(d, now, merged),
  '高血圧・脂質異常症': (d, now, merged) => buildHthlOrEndocrine(d, now, merged, { endocrine: false }),
  '内分泌': (d, now, merged) => buildHthlOrEndocrine(d, now, merged, { endocrine: true }),
  '妊娠糖尿病': (d, now, merged) => buildGDM(d, now, merged),
  '反応性低血糖': (d, now, merged) => buildRH(d, now, merged),
  '睡眠時無呼吸症候群': (d, now, merged) => buildSAS(d, now, merged),
}
for (const label of Object.keys(THYROID_TYPE)) {
  BUILDERS[label] = (d, now) => buildThyroid(label, d, now)
}

export const TEMPLATE_FORM_TYPES = new Set(Object.keys(BUILDERS))

// form_type と form_data からカルテ記載文を組み立てる。
// 未対応の form_type は null を返す（呼び出し側でエラー表示する）。
export function buildKarteTemplate(form_type, form_data, { now, merged } = {}) {
  const build = BUILDERS[form_type]
  if (!build) return null
  return build(form_data || {}, now, merged)
}

// ── AI に頼む「統合」だけのプロンプト ──────────────────────
//
// AI がやるのは ①音声と構造化データの統合 ②♯既往のマージ・重複排除 の 2 つだけ。
// ★音声入力が 1 つも無ければ統合する相手がいない = null を返し、AI を呼ばない。
//   （音声なしの回は JS だけで完結する。当院の運用では大半がこちら）
export function needsMerge(form_data) {
  const d = form_data || {}
  return !!((d.voiceMemo?.aiSummary || '').trim() || (d.voicePastHistory?.aiSummary || '').trim())
}

export function buildMergePrompt(form_type, form_data) {
  if (!BUILDERS[form_type]) return null
  if (!needsMerge(form_data)) return null

  const d = form_data
  const facts = buildReasonFacts(d)
  const voice = (d?.voiceMemo?.aiSummary || '').trim()
  const candidates = buildPastHistoryLines(d)

  return `あなたは糖尿病クリニックのカルテ記載を補助するAIです。以下の2つだけを行い、JSON のみを返してください。カルテ全体は別途システムが組み立てるので、指定した項目以外は一切出力しないでください。

【共通ルール】
- 時期は和暦のみ（H8 / R5 等）。西暦・年齢・「○年前」は使わない
- 与えられていない情報を推測して足さない
- 「不明」などの穴埋めをしない

【1. 受診理由サマリー】
下の材料を1〜2行の文にまとめてください。音声と構造化情報の両方を必ず統合し、同じ内容は1回だけ書きます。材料が何も無ければ空文字にしてください。
${voice ? `- 音声入力（AI整形済み）：${voice}` : '- 音声入力：なし'}
${facts.length ? facts.map(([k, v]) => `- ${k}：${v}`).join('\n') : '- 構造化データ：なし'}

【2. ♯既往疾患の統合】
下の候補行を統合してください。同じ疾患が複数行にある場合は1行にまとめ、情報量の多い方を残します。行の書式「♯病名（時期・病院・薬）」は変えず、順序も入力順を保ってください。候補が無ければ空配列にします。
${candidates.length ? candidates.map(l => `- ${l}`).join('\n') : '- なし'}

【出力】次の形の JSON のみ。前後に説明を付けない。
{"reasonSummary": "…", "pastHistory": ["…"]}`
}

// AI の返答（JSON 文字列）を安全に取り出す。失敗したら null（= JS 素組みにフォールバック）
export function parseMergeResponse(text) {
  if (!text) return null
  const m = String(text).match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0])
    return {
      reasonSummary: typeof o.reasonSummary === 'string' ? o.reasonSummary : '',
      pastHistory: Array.isArray(o.pastHistory) ? o.pastHistory.filter(x => typeof x === 'string') : [],
    }
  } catch {
    return null
  }
}
