// AI を使わずに form_data からカルテ記載文を組み立てる（テンプレート版・試作）。
//
// 背景 (2026-09-06):
//   現在の生成は「出力フォーマットの雛形を含む長いプロンプト」を Claude に投げている。
//   だが問診で集めているデータはほぼ全てが構造化されており、AI は判断でなく整形をしている。
//   ・条件分岐の判定（体重減少3kg以上 → □行 等）→ JS でできる
//   ・チェック項目の書式化・数値の配置・定型の申し送り  → JS でできる
//   ・非構造データ（音声・自由記述）→ 文章化           → ここだけ AI が要る
//   そして音声は入力時点で lib/voiceSummary.js が既に AI 整形して aiSummary に入れている。
//   ⇒ カルテ生成そのものは AI 呼び出しゼロで組める。
//
// 決定論にすると 5 つ同時に良くなる:
//   ①出力が決定論的（欠落が原理的に起きない） ②ユニットテストで固められる
//   ③API コスト激減 ④速い ⑤医療機器該当性の議論が軽くなる
//
// ★2026-09-06 追記（案2 = ハイブリッド）:
//   「AI 呼び出しゼロ」は書式については本当だが、今の出力品質は保てないと実測で分かった。
//   今のプロンプトは音声テキストを構造化データと **統合** せよと AI に指示していて、
//   そこを JS で置き換えると 受診理由の紹介元・自由記入が落ち、♯既往に重複が出る。
//   ⇒ **統合の2点だけ AI に頼み、残り（書式・条件分岐・申し送り）は JS が確定させる**。
//
//   buildKarteTemplate(form_type, d)            → AI なし版（統合しない。フォールバック）
//   buildKarteTemplate(form_type, d, { merged })→ AI の統合結果を差し込んだ版
//   buildMergePrompt(form_type, d)              → その統合だけを頼む小さいプロンプト
//
// ⚠️ 現状は **DM基本のみ・試作**。詳細画面に「テンプレート版」として並べて表示し、
//    実際の患者で AI 版と見比べて詰めるための土台。生成・保存の経路はまだ差し替えていない。

import { buildOtherDiseasesText, pickOtherDiseases } from './otherDiseases.js'
import { buildEchoLine } from './echo.js'
import { buildStaffFlagLines } from './handoffNotes.js'
import {
  getCurrentMonth, buildAlcohol, buildSmoking, buildLiving, buildChildInfo,
  buildJobStr, dmOnsetText, buildWeekday, buildBmi, buildDmSymptoms,
} from './karteFields.js'

const DIVIDER = '---------------------------------------------'

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
  if (r.summary) facts.push(['本人の自由記入', r.summary.trim()])
  return facts
}

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

// ── ♯既往疾患のリスト全体 ─────────────────────────────────
export function buildPastHistoryLines(d) {
  const lines = buildImportantHistoryLines(d)

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
// DM基本のフォームは家族歴に HL を持たない（HTHL/RH/内分泌 は持つ）。
// 枠を作らない = 聞いていないことを (-) と断定しない（院長判断 2026-09-06）
export function buildFhLine(d) {
  const fh = d?.history?.fh || {}
  const who = (fh.dmWho || []).join('・')
  const dm = fh.dm ? (who ? `(+：${who})` : '(+)') : '(-)'
  return `【FH】DM${dm} HT(${fh.ht ? '+' : '-'}) APO(${fh.apo ? '+' : '-'}) IHD(${fh.ihd ? '+' : '-'})`
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

// ── 【仕事】 ──────────────────────────────────────────────
// 「していない」を選んだときは就労なしと明記する（院長判断 2026-09-06）。
// 空欄のままだと「無職」なのか「聞き漏らした」のか区別が付かないため。
export function buildJobLine(d) {
  const src = d?.lifestyle || d?.history || {}
  if (src.work === 'していない') return '【仕事】就労なし'
  return `【仕事】${[buildJobStr(d), src.activity].filter(Boolean).join('・')}`
}

// ── 【事前聴取時　申し送り事項】 ───────────────────────────
export function buildHandoffLines(d) {
  const h = d?.history || {}
  const dis = d?.disease || {}
  const lines = ['□通院のご案内をお渡し済']
  if (d?.voiceMemo?.needsDoctorReview) lines.push('□現病歴：問診時間の関係で一部省略、要DR確認')
  if (d?.voicePastHistory?.needsDoctorReview) lines.push('□既往歴：要ドクター確認')
  if (h.eyeFundusCheck === '受けていない' || h.eyeNotebook === '持っていない') lines.push('□糖尿病-眼科連携手帳をお渡し')
  if (d?.alert?.weightLoss === 'あり（3kg以上）') lines.push('□体重減少あり（3ヶ月以内に3kg以上）インスリン導入要検討')
  if (dis.ht) lines.push('□HTの確認のため、血圧手帳をお渡ししています。')
  if (dis.hl) lines.push('□健診・前医採血でLDL-C140mg/dl以上のため、甲状腺3項目を追加しました。')
  if (!dis.insulinUse) lines.push('□生活習慣病療養計画書を作成済')
  if (d?.reason?.dmConcern) lines.push('□血糖、HbA1cの結果により上段の診断を確定してください')
  lines.push(...buildStaffFlagLines(d?.body))
  return lines
}

// ── DM基本 本体 ───────────────────────────────────────────
function buildDM(d, now, merged) {
  const month = getCurrentMonth(now)
  const body = d?.body || {}
  const h = d?.history || {}
  const dis = d?.disease || {}
  const age = parseInt(h.age, 10) || 0
  const out = []

  // 体重減少の警告（最上部）
  if (d?.alert?.weightLoss === 'あり（3kg以上）') {
    out.push('【⚠️ 体重減少あり・早急なインスリン導入を検討】', '')
  }

  // 受診理由サマリー → ＃主病名（空行なし）
  // merged.reasonSummary があれば AI が統合した文を使う（無ければ JS の素組み）
  const summary = (merged?.reasonSummary || '').trim() || buildReasonSummary(d)
  out.push(summary ? `${month}：${summary}` : `${month}：`)
  out.push(d?.reason?.dmConcern ? '＃糖尿病 or IGT or 正常耐糖能' : `＃糖尿病${dmOnsetText(d)}`)
  if (dis.ht) out.push('＃HT')
  if (dis.hl) out.push('＃HL')

  // 自院管理ブロック → 他院管理（♯既往）の前にだけ1行空ける（空行ルール②）
  const past = Array.isArray(merged?.pastHistory) && merged.pastHistory.length
    ? merged.pastHistory.map(l => String(l).trim()).filter(Boolean)
    : buildPastHistoryLines(d)
  if (past.length) {
    out.push('')
    out.push(...past)
  }

  // 他院管理の最終行と【アレルギー歴】の間は空行なし（空行ルール④）
  out.push(`【アレルギー歴】${h.allergy === 'なし' ? 'なし' : (h.allergyDetail || 'あり')}`)
  out.push(buildFhLine(d))
  out.push(`【飲酒歴】${buildAlcohol(d)}`)
  out.push(`【喫煙歴】${buildSmoking(d)}`)
  out.push(buildEyeLine(d))
  // 未選択なら値なしの空欄（院長判断 2026-09-06）
  out.push(`【健診】${(h.checkup || []).join('・')}`)
  if (age >= 60) {
    const vac = [
      h.vaccine65Prevena ? `プレベナー20：${h.vaccine65Prevena}` : '',
      h.vaccine65Herpes ? `帯状疱疹：${h.vaccine65Herpes}` : '',
    ].filter(Boolean).join('　')
    if (vac) out.push(`【ワクチン歴】${vac}`)
  }
  const living = [buildLiving(d), age >= 70 ? buildChildInfo(d) : ''].filter(Boolean).join('、')
  out.push(`【生活情報】${living}`)
  out.push(buildJobLine(d))

  out.push(DIVIDER)
  out.push(buildEchoLine(dis.echoNeck, dis.echoAbdomen, { neckFallback: '未記入', abdomenFallback: '未記入' }))
  out.push(DIVIDER)

  const bmi = buildBmi(d)
  out.push(
    `身長:${body.height || '○'}cm　初診時:${body.weightNow || '○'}kg${bmi ? `（BMI ${bmi}）` : ''}` +
    `　20歳時:${body.weight20 || '○'}kg　max体重${body.weightMax || '○'}kg(${body.weightMaxAge || '○'}歳)`
  )
  out.push(DIVIDER)

  const symptoms = buildDmSymptoms(dis.dmSymptoms)
  if (symptoms) {
    out.push(`【糖尿病の症状】${symptoms}`)
    out.push(DIVIDER)
  }

  out.push('【事前聴取時　申し送り事項】')
  out.push(...buildHandoffLines(d))
  // 申し送りの最終□行と【診察にあたっての要望】の間は空行なし（空行ルール⑤）
  out.push(`【診察にあたっての要望】${body.concern || 'なし'}`)
  out.push(DIVIDER)

  out.push(`${month}：HbA1c　　%　CPR（　）　※GAD陽性の場合は甲状腺項目追加してください　CPR0.5以下の方は今後半年ごとCPR測定を入れてください。`)
  out.push('', '', '', '')
  const drugWarning = buildDrugAllergyWarning(d)
  if (drugWarning) out.push(drugWarning)
  out.push('目標HbA1c　　　　%　目標体重　　　次回検討薬：')
  out.push('DM基本セット')
  out.push('1月follow')
  out.push(buildWeekday(d))
  out.push('LINE登録ご案内→済　登録確認未・登録できない')

  return out.join('\n')
}

export const TEMPLATE_FORM_TYPES = new Set(['DM基本'])

// form_type と form_data から、AI を使わずカルテ記載文を組み立てる。
// 未対応の form_type は null を返す（呼び出し側で「テンプレート版なし」と表示する）。
export function buildKarteTemplate(form_type, form_data, { now, merged } = {}) {
  if (form_type !== 'DM基本') return null
  return buildDM(form_data, now, merged)
}

// ── AI に頼む「統合」だけのプロンプト ──────────────────────
// 今のカルテ生成プロンプト（DM基本で約 7,600 字）に対して、こちらは数百字。
// AI がやるのは ①音声と構造化データの統合 ②♯既往のマージ・重複排除 の2つだけ。
export function buildMergePrompt(form_type, form_data) {
  if (form_type !== 'DM基本') return null
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
