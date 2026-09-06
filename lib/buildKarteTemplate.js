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
function detailLine(name, x, extras = []) {
  if (!x?.selected) return ''
  const inner = [...extras, periodText(x), careText(x), x.meds ? `${x.meds} 内服中` : '']
    .filter(Boolean).join('、')
  return inner ? `♯${name}（${inner}）` : `♯${name}`
}

export function buildImportantHistoryLines(d) {
  const dis = d?.disease || {}
  return [
    detailLine('胃癌', dis.gastricCancer, [dis.gastricCancer?.surgeryType, dis.gastricCancer?.resection].filter(Boolean)),
    detailLine('膵臓癌', dis.pancreasCancer, [dis.pancreasCancer?.surgeryType, dis.pancreasCancer?.resection].filter(Boolean)),
    detailLine('IHD', dis.ihd, [dis.ihd?.treatment].filter(Boolean)),
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

// ── 【FH】 ────────────────────────────────────────────────
export function buildFhLine(d) {
  const fh = d?.history?.fh || {}
  const who = (fh.dmWho || []).join('・')
  const dm = fh.dm ? (who ? `(+：${who})` : '(+)') : '(-)'
  return `【FH】DM${dm} HT(${fh.ht ? '+' : '-'}) APO(${fh.apo ? '+' : '-'}) IHD(${fh.ihd ? '+' : '-'})`
}

// ── 【眼科通院歴】 ────────────────────────────────────────
export function buildEyeLine(d) {
  const h = d?.history || {}
  if (h.eyeFundusCheck !== '受けている') {
    return `【眼科通院歴】${h.eyeFundusCheck === '今後受ける予定' ? '未受診（今後受ける予定）' : '未受診'}`
  }
  const parts = [h.eye, h.retinopathy, h.glaucoma].filter(Boolean)
  return `【眼科通院歴】${parts.join('・') || '受診中'}`
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
function buildDM(d, now) {
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
  const summary = buildReasonSummary(d)
  out.push(summary ? `${month}：${summary}` : `${month}：`)
  out.push(d?.reason?.dmConcern ? '＃糖尿病 or IGT or 正常耐糖能' : `＃糖尿病${dmOnsetText(d)}`)
  if (dis.ht) out.push('＃HT')
  if (dis.hl) out.push('＃HL')

  // 自院管理ブロック → 他院管理（♯既往）の前にだけ1行空ける（空行ルール②）
  const past = buildPastHistoryLines(d)
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
  out.push(`【仕事】${[buildJobStr(d), d?.lifestyle?.activity].filter(Boolean).join('・')}`)

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
  if (h.allergy !== 'なし' && h.allergyDetail) out.push(`⚠️${h.allergyDetail}アレルギー⚠️`)
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
export function buildKarteTemplate(form_type, form_data, { now } = {}) {
  if (form_type !== 'DM基本') return null
  return buildDM(form_data, now)
}
