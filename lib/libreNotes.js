// リブレ（自費CGM）を「やったかどうか」で申し送りに残す（院長 2026-10-16）。
//
// ■ なぜ要るか
// 紙の運用では 反応性低血糖＝初事前で装着 / 妊娠糖尿病＝初診時に装着し初事前で予約3回分、と
// 決まっているので、申し送りには**条件なしで同じ行**を出していた（2026-10-14）。
// ところが「段取りの指示」と「実際にやった記録」が同じ 1 行なので、
// **やっていない回にも『装着済』と書かれてしまう**。
// 院長 2026-10-16「リブレ装着をまちがいなく行ったかどうか、日付も含めて明確に残したい」。
// ⇒ 聴取した結果（やったか・いつ）だけを書き、**入力が無い回は『済』と書かない**。
//
// ■ 3 つの出口（いずれも【事前聴取時　申し送り事項】の 1 行。A4 にはカルテ本文として出る）
//   反応性低血糖 … 初事前で装着したか（全例装着の運用）
//   妊娠糖尿病   … 予約を 3 回分取ったか（初診・GDMフォロー①②）
//   DM基本       … 反応性低血糖の訴えがあった回に装着したか。未装着なら初診時に医師と相談
//
// ■ 「未入力」と「やっていない」を書き分ける
// 既定は**未確認**。聞けていないのか、聞いて装着しなかったのかは医師にとって別の話なので、
// 文も分ける（2026-09-06 院長確定の「未入力と なし を書き分ける」と同じ原則）。
//
// ■ 日付は和暦（CLAUDE.md の和暦統一ルール）
// 画面は `<input type="date">` なので値は必ず西暦で来る。`toWarekiYmd()` を通してから書く。

import { toWarekiYmd } from './wareki.js'

// ── 紙で赤字にする行（院長 2026-10-16「申し送りのリブレ関連や、妊娠糖尿病の予約日時関連は赤字に」）
//
// ★ここに**行の頭**を列挙する。「リブレ」を含む行、で引っかけないこと。
//   1型・小児1型の「□CGM：フリースタイルリブレ（継続）」は患者が既に使っている機器の話で、
//   当院の段取り（装着したか・予約を取ったか）ではない。全部赤くすると赤が意味を失う。
const RED_PREFIXES = [
  '□自費CGM（リブレ）',                    // 反応性低血糖（装着済 / 未装着 / 未確認）
  '□反応性低血糖の訴えあり：',              // DM基本（訴えがあった回）
  '□リブレ（自費CGM）取り付けに同意済',      // 妊娠糖尿病
  '□リブレ装着',                           // 妊娠糖尿病（予約3回分 / 段取りの指示）
]

/**
 * 申し送りのこの行を紙で赤字にするか。
 * 見落とすと「やったつもり」で診察に入ってしまう行だけを赤くする。
 */
export function isLibreHandoffLine(line) {
  const l = String(line || '')
  return RED_PREFIXES.some(p => l.startsWith(p))
}

/** 装着したか（画面のボタンの値そのもの。これ以外は「未確認」として扱う） */
export const LIBRE_ATTACHED = '装着済'
export const LIBRE_NOT_ATTACHED = '未装着'

/** DM基本で「反応性低血糖の訴え」と見なす症状（画面の選択肢そのもの） */
export const POSTPRANDIAL_HYPO_SYMPTOM = '食後の低血糖を心配している'

const NOT_FILLED = '未記入'

/**
 * 日付を和暦にする。読めない値は**そのまま出す**。
 * ★黙って捨てないこと。日付ピッカーからは必ず `2026-10-16` の形で来るので、
 *   読めない値は DB を直接編集した等の異常。消すと気付けないまま情報が落ちる
 *   （`coverage.test.mjs` の取りこぼし検査が見ているのもこれ）。
 */
function dateText(v) {
  const raw = String(v || '').trim()
  if (!raw) return ''
  return toWarekiYmd(raw) || raw
}

const reasonText = note => {
  const t = String(note || '').trim()
  return t ? `（理由：${t}）` : ''
}

// ── 反応性低血糖: 初事前で装着したか ───────────────────────────
/**
 * 全例装着の運用なので行は必ず出す。中身が「済（日付）/ 未装着 / 未確認」で変わる。
 * @returns {string[]} 申し送りの □ 行（常に 1 行）
 */
export function buildRhLibreLines(d) {
  const l = d?.libre || {}
  if (l.attached === LIBRE_ATTACHED) {
    const dt = dateText(l.date)
    return [`□自費CGM（リブレ）初事前で装着済（${dt || `装着日 ${NOT_FILLED}`}）`]
  }
  if (l.attached === LIBRE_NOT_ATTACHED) {
    return [`□自費CGM（リブレ）未装着${reasonText(l.note)} → 初診時に医師とご相談ください`]
  }
  return ['□自費CGM（リブレ）初事前での装着 未確認 → 装着したかご確認ください']
}

// ── 妊娠糖尿病: 予約3回分を取ったか ────────────────────────────
const GDM_SLOTS = [
  { key: 'firstVisit', label: '初診' },
  { key: 'follow1', label: 'GDMフォロー①' },
  { key: 'follow2', label: 'GDMフォロー②' },
]

/**
 * リブレの装着は初診時なので、初事前では**予約を 3 回分取る**のが段取り（紙の運用 2026-10-14）。
 * 取れた回は日付を並べ、取れていない回は段取りの指示を残す。
 * @returns {string[]} 申し送りの □ 行（常に 1 行）
 */
export function buildGdmLibreReservationLines(d) {
  const l = d?.libre || {}
  const slots = GDM_SLOTS.map(s => ({ ...s, text: dateText(l[s.key]) }))
  const filled = slots.filter(s => s.text)
  const detail = slots.map(s => `${s.label} ${s.text || NOT_FILLED}`).join('・')

  if (filled.length === slots.length) return [`□リブレ装着の予約3回分 取得済（${detail}）`]
  // 1 つも入っていない回は、従来どおり段取りの指示として読めるようにする
  // （過去のレコードを再生成したときに「取っていない」と断定しないため）
  if (filled.length === 0) {
    return [`□リブレ装着は初診時・初事前で予約3回分（初診・GDMフォロー①②）→ 予約日 ${NOT_FILLED}`]
  }
  return [`□リブレ装着の予約3回分（${detail}）→ 残りの予約をお取りください`]
}

// ── DM基本: 問診中に反応性低血糖を訴えた回 ─────────────────────
/**
 * 2型の問診中に「食後の低血糖を心配している」と訴えた患者に、その場でリブレを付けたか。
 * 付けていない（または聞けていない）なら**初診時に医師と相談**に回す（院長 2026-10-16）。
 * 訴えが無い回は 1 行も出さない。
 * @returns {string[]} 申し送りの □ 行（0 行 or 1 行）
 */
export function buildDmLibreLines(d) {
  const selected = d?.disease?.dmSymptoms?.selected || []
  if (!selected.includes(POSTPRANDIAL_HYPO_SYMPTOM)) return []

  const l = d?.libre || {}
  const head = '□反応性低血糖の訴えあり：自費CGM（リブレ）'
  if (l.attached === LIBRE_ATTACHED) {
    const dt = dateText(l.date)
    return [`${head}装着済（${dt || `装着日 ${NOT_FILLED}`}）`]
  }
  if (l.attached === LIBRE_NOT_ATTACHED) {
    return [`${head}未装着${reasonText(l.note)} → 初診時に医師とご相談ください`]
  }
  return [`${head}装着の有無 未確認 → 初診時に医師とご相談ください`]
}
