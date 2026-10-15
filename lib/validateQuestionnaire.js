// /api/questionnaire の POST（新規保存）/ PATCH（更新）の入力検証（2026-10-15）
//
// 2026-04-24 のセキュリティ監査で 🟡「POST/PATCH の入力検証なし」とされていた項目。
// API ハンドラから切り出してあるのはテストから呼ぶため（scripts/golden/validateQuestionnaire.test.mjs）。
//
// ★方針: 問診を失わない。
//   スタッフが患者の前で 10 分かけて入力した問診を、年齢欄の書き間違い 1 つで
//   保存失敗にしてはいけない。だから
//     ・age（参考情報・一覧の表示用）は**はじかずに整える**（読めなければ null）
//     ・form_type / form_data / generated_karte は**はじく**（壊れた行を DB に作らない。
//       正規の画面からは必ず正しい形で来るので、はじかれるのは不正な呼び出しだけ）

import { TEMPLATE_FORM_TYPES } from './buildKarteTemplate.js'

export const MAX_FORM_DATA_BYTES = 100 * 1024   // generate-karte と同じ上限
export const MAX_KARTE_CHARS = 20000            // 実際のカルテは 1,000〜2,000 字程度
export const STATUSES = new Set(['new', 'done'])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// 年齢: 数値・数字の文字列（「65」「65歳」「６５」）を整数に。読めない・範囲外は null
export function normalizeAge(v) {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  const m = /^\s*(\d{1,3})(?:\s*歳)?\s*$/.exec(s)
  if (!m) return null
  const n = Number(m[1])
  return n <= 130 ? n : null
}

function checkFormData(form_data) {
  if (typeof form_data !== 'object' || form_data === null || Array.isArray(form_data)) {
    return 'form_data must be an object'
  }
  if (JSON.stringify(form_data).length > MAX_FORM_DATA_BYTES) return 'form_data too large'
  return null
}

function checkKarte(generated_karte) {
  if (typeof generated_karte !== 'string') return 'generated_karte must be a string'
  if (generated_karte.length > MAX_KARTE_CHARS) return 'generated_karte too large'
  return null
}

const fail = (status, error) => ({ ok: false, status, error })

/**
 * POST の検証。成功時は DB に入れる行（visit_code・status 以外）を返す。
 * @returns {{ ok: true, row: object } | { ok: false, status: number, error: string }}
 */
export function validateCreate(body) {
  const b = body || {}
  if (!TEMPLATE_FORM_TYPES.has(b.form_type)) return fail(400, `未対応のform_type: ${b.form_type}`)

  const fdErr = checkFormData(b.form_data)
  if (fdErr) return fail(fdErr.includes('large') ? 413 : 400, fdErr)

  // カルテ本文は空でも保存は通す（生成に失敗しても問診そのものは残す。詳細画面で再生成できる）
  const karte = b.generated_karte ?? ''
  const kErr = checkKarte(karte)
  if (kErr) return fail(kErr.includes('large') ? 413 : 400, kErr)

  return {
    ok: true,
    row: { age: normalizeAge(b.age), form_type: b.form_type, form_data: b.form_data, generated_karte: karte },
  }
}

/**
 * PATCH（一括完了以外）の検証。成功時は update に渡すフィールドを返す（updated_at は呼び出し側）。
 * 従来どおり、空文字の generated_karte や未指定のフィールドは「変更しない」扱い。
 * @returns {{ ok: true, updates: object } | { ok: false, status: number, error: string }}
 */
export function validatePatch(body) {
  const b = body || {}
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return fail(400, 'id is required (uuid)')

  const updates = {}
  if (b.status !== undefined && b.status !== null && b.status !== '') {
    if (!STATUSES.has(b.status)) return fail(400, `status must be one of: ${[...STATUSES].join(', ')}`)
    updates.status = b.status
  }
  if (b.generated_karte) {
    const kErr = checkKarte(b.generated_karte)
    if (kErr) return fail(kErr.includes('large') ? 413 : 400, kErr)
    updates.generated_karte = b.generated_karte
  }
  if (b.form_data) {
    const fdErr = checkFormData(b.form_data)
    if (fdErr) return fail(fdErr.includes('large') ? 413 : 400, fdErr)
    updates.form_data = b.form_data
  }
  if (Object.keys(updates).length === 0) return fail(400, '更新する項目がありません')
  return { ok: true, updates }
}
