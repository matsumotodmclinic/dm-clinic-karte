// 問診の下書き（聴取の途中で消えないように）。純粋関数だけを置く。React の部分は lib/useIntakeDraft.js。
//
// ■ なぜ要るか（2026-10-16）
//   問診の入力は送信するまでブラウザのメモリにしか無い。タブを閉じる・再読み込み・PC が固まる、の
//   どれかが聴取の途中で起きると 10〜15 分の聴取がまるごと消え、患者さんの前で聞き直すことになる。
//
// ■ 決めたこと
//   ・保存先はこの PC のブラウザ（localStorage）。**サーバーには送らない**（医療情報の扱いは今と同じ）
//   ・12 時間で捨てる（その日の聴取を救えれば足りる。共有 PC に問診を長く残さない）
//   ・保存に成功したら（受付コードが出たら）消す。「最初から」でも消す
//   ・開き直したとき、前回の下書きは別の枠（prev）に移してから新しい入力の保存を始める。
//     バナーを無視して入力を始めても、前回の下書きを上書きしないため

export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000
const PREFIX = 'kp-intake-draft:v1:'

export const draftKey = (formType) => PREFIX + formType
export const prevDraftKey = (formType) => PREFIX + formType + ':prev'

export function serializeDraft({ data, step }, now = Date.now()) {
  return JSON.stringify({ savedAt: now, step: Number(step) || 0, data })
}

// 壊れている・期限切れ・中身が無い → null
export function parseDraft(text, now = Date.now()) {
  if (!text) return null
  let d
  try { d = JSON.parse(text) } catch { return null }
  if (!d || typeof d !== 'object') return null
  if (typeof d.savedAt !== 'number' || !d.data || typeof d.data !== 'object' || Array.isArray(d.data)) return null
  if (now - d.savedAt > DRAFT_TTL_MS || d.savedAt > now + 60 * 1000) return null
  return { savedAt: d.savedAt, step: Number(d.step) || 0, data: d.data }
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v)

// 下書きを今の initialData に重ねる。
// 下書きを取った後にフォームへ項目が足されていても（デプロイをまたいだ回）、
// 足された項目は initialData の既定値で埋まる＝ `p[sec][f].includes` 等で落ちない。
// 型が食い違う項目（配列のはずが文字列 等）は initialData を採る。
export function mergeDraft(initial, saved) {
  if (!isPlainObject(initial)) return saved === undefined ? initial : saved
  if (!isPlainObject(saved)) return initial
  const out = { ...saved }
  for (const k of Object.keys(initial)) {
    const a = initial[k]
    const b = saved[k]
    if (b === undefined) out[k] = a
    else if (isPlainObject(a)) out[k] = isPlainObject(b) ? mergeDraft(a, b) : a
    else if (Array.isArray(a)) out[k] = Array.isArray(b) ? b : a
    else out[k] = b
  }
  return out
}

// バナーの「10:42 保存」用
export function formatSavedAt(savedAt) {
  const d = new Date(savedAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
