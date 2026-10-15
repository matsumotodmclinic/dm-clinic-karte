// API の入口の守り（2026-10-15、セキュリティ監査 2026-04-24 の残り）
//   ・lib/validateQuestionnaire.js … /api/questionnaire の POST / PATCH の入力検証
//   ・lib/rateLimit.js             … /api/generate・/api/generate-karte のレート制限
//
// ★入力検証の方針は「問診を失わない」。年齢欄の書き間違い 1 つで 10 分の聴取を
//   保存失敗にしない（整えて通す）。はじくのは正規の画面からは来ない形だけ。

import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import {
  normalizeAge, validateCreate, validatePatch, MAX_FORM_DATA_BYTES, MAX_KARTE_CHARS,
} from '../../lib/validateQuestionnaire.js'
import { checkRateLimit, resetRateLimit, rateLimitKey, LIMITS } from '../../lib/rateLimit.js'
import { TEMPLATE_FORM_TYPES } from '../../lib/buildKarteTemplate.js'
import { FIXTURES } from './fixtures.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const ID = '3f2b8c1e-9a7d-4e6f-8b5a-1c2d3e4f5a6b'
const okCreate = (over = {}) => ({ form_type: 'DM基本', form_data: FIXTURES['DM基本'], age: '65', generated_karte: 'R8.10 …', ...over })

// ──────────────────────────────────────────────────────────
describe('入力検証: 年齢（はじかずに整える）', () => {
  test('数字・数字の文字列・全角・「歳」付きは整数に', () => {
    assert.equal(normalizeAge(65), 65)
    assert.equal(normalizeAge('65'), 65)
    assert.equal(normalizeAge(' 65 '), 65)
    assert.equal(normalizeAge('６５'), 65)
    assert.equal(normalizeAge('65歳'), 65)
    assert.equal(normalizeAge('0'), 0)
  })

  test('空・読めない・範囲外は null（保存は止めない）', () => {
    for (const v of [null, undefined, '', 'abc', '六十五', '65.5', '-3', '200', {}, []]) {
      assert.equal(normalizeAge(v), null, String(v))
    }
  })
})

describe('入力検証: 新規保存（POST）', () => {
  test('正規の保存は通り、年齢は整えられる', () => {
    const r = validateCreate(okCreate({ age: '６５歳' }))
    assert.equal(r.ok, true)
    assert.equal(r.row.age, 65)
    assert.equal(r.row.form_type, 'DM基本')
  })

  test('年齢が読めなくても保存は通る（null で入る）', () => {
    const r = validateCreate(okCreate({ age: 'わからない' }))
    assert.equal(r.ok, true)
    assert.equal(r.row.age, null)
  })

  test('カルテ本文が空・未指定でも保存は通る（生成に失敗しても問診は残す）', () => {
    assert.equal(validateCreate(okCreate({ generated_karte: '' })).ok, true)
    const r = validateCreate(okCreate({ generated_karte: undefined }))
    assert.equal(r.ok, true)
    assert.equal(r.row.generated_karte, '')
  })

  test('14 フォーム全ての form_type が通る', () => {
    assert.equal(TEMPLATE_FORM_TYPES.size, 14)
    for (const f of TEMPLATE_FORM_TYPES) assert.equal(validateCreate(okCreate({ form_type: f })).ok, true, f)
  })

  test('画面から実際に送っている form_type は全て通る（コンポーネントの文字列を読む）', () => {
    const dir = join(ROOT, 'components')
    const sent = new Set()
    for (const f of readdirSync(dir).filter(f => f.endsWith('IntakeTool.js'))) {
      const src = readFileSync(join(dir, f), 'utf8')
      for (const m of src.matchAll(/form_type:\s*"([^"]+)"/g)) sent.add(m[1])
      for (const m of src.matchAll(/dbLabel:\s*'([^']+)'/g)) sent.add(m[1])
    }
    assert.ok(sent.size >= 14, `拾えた form_type が少ない: ${sent.size}`)
    for (const f of sent) assert.ok(TEMPLATE_FORM_TYPES.has(f), `画面が送る ${f} を API がはじく`)
  })

  test('不正な形ははじく', () => {
    const cases = [
      [okCreate({ form_type: '存在しない問診' }), 400],
      [okCreate({ form_type: undefined }), 400],
      [okCreate({ form_data: null }), 400],
      [okCreate({ form_data: 'x' }), 400],
      [okCreate({ form_data: [] }), 400],
      [okCreate({ form_data: { big: 'あ'.repeat(MAX_FORM_DATA_BYTES) } }), 413],
      [okCreate({ generated_karte: 123 }), 400],
      [okCreate({ generated_karte: 'あ'.repeat(MAX_KARTE_CHARS + 1) }), 413],
      [undefined, 400],
    ]
    for (const [body, status] of cases) {
      const r = validateCreate(body)
      assert.equal(r.ok, false)
      assert.equal(r.status, status)
      assert.ok(r.error)
    }
  })
})

describe('入力検証: 更新（PATCH）', () => {
  test('詳細画面が送る 3 種類は通る', () => {
    assert.deepEqual(validatePatch({ id: ID, status: 'done' }).updates, { status: 'done' })
    assert.deepEqual(validatePatch({ id: ID, generated_karte: 'カルテ' }).updates, { generated_karte: 'カルテ' })
    const fd = { ...FIXTURES['睡眠時無呼吸症候群'], dmDiff: { completed: true } }
    assert.deepEqual(validatePatch({ id: ID, form_data: fd }).updates, { form_data: fd })
  })

  test('空のカルテ本文は「変更しない」扱い（従来どおり。空で上書きしない）', () => {
    const r = validatePatch({ id: ID, status: 'done', generated_karte: '' })
    assert.deepEqual(r.updates, { status: 'done' })
  })

  test('不正な形ははじく', () => {
    const cases = [
      [{ status: 'done' }, 400],                                   // id なし
      [{ id: 'abc', status: 'done' }, 400],                        // id が uuid でない
      [{ id: ID, status: 'deleted' }, 400],                        // 知らない status
      [{ id: ID }, 400],                                           // 何も変えない
      [{ id: ID, form_data: 'x' }, 400],
      [{ id: ID, form_data: { big: 'あ'.repeat(MAX_FORM_DATA_BYTES) } }, 413],
      [{ id: ID, generated_karte: 'あ'.repeat(MAX_KARTE_CHARS + 1) }, 413],
    ]
    for (const [body, status] of cases) {
      const r = validatePatch(body)
      assert.equal(r.ok, false, JSON.stringify(body).slice(0, 60))
      assert.equal(r.status, status)
    }
  })

  test('フィクスチャのカルテ・form_data は上限に十分収まる（上限が実データを切らない）', () => {
    for (const fd of Object.values(FIXTURES)) {
      assert.ok(JSON.stringify(fd).length < MAX_FORM_DATA_BYTES / 4)
    }
  })
})

// ──────────────────────────────────────────────────────────
describe('レート制限', () => {
  beforeEach(() => resetRateLimit())
  const [perMin, perHour] = LIMITS

  test('1 分の上限までは通り、超えたら止まる・待てば戻る', () => {
    const t0 = 1_000_000_000
    for (let i = 0; i < perMin.max; i++) assert.equal(checkRateLimit('staff:a', t0 + i).ok, true)
    const r = checkRateLimit('staff:a', t0 + perMin.max)
    assert.equal(r.ok, false)
    assert.equal(r.label, '1分')
    assert.ok(r.retryAfterSec > 0 && r.retryAfterSec <= 60)
    assert.equal(checkRateLimit('staff:a', t0 + perMin.windowMs + 1).ok, true)
  })

  test('拒否した回は数えない（止まっている間に叩き続けても解除が延びない）', () => {
    const t0 = 2_000_000_000
    for (let i = 0; i < perMin.max; i++) checkRateLimit('staff:a', t0)
    for (let i = 0; i < 100; i++) assert.equal(checkRateLimit('staff:a', t0 + 1000).ok, false)
    assert.equal(checkRateLimit('staff:a', t0 + perMin.windowMs).ok, true)
  })

  test('1 時間の上限: 1 分ごとに区切って叩いても止まる', () => {
    const t0 = 3_000_000_000
    let allowed = 0
    for (let m = 0; m < 60; m++) {
      for (let i = 0; i < perMin.max; i++) if (checkRateLimit('staff:a', t0 + m * 60_000 + i).ok) allowed++
    }
    assert.equal(allowed, perHour.max)
    const r = checkRateLimit('staff:a', t0 + 59 * 60_000 + 30_000)
    assert.equal(r.ok, false)
    assert.equal(r.label, '1時間')
  })

  test('スタッフごとに別々に数える', () => {
    const t0 = 4_000_000_000
    for (let i = 0; i < perMin.max; i++) checkRateLimit('staff:a', t0)
    assert.equal(checkRateLimit('staff:a', t0).ok, false)
    assert.equal(checkRateLimit('staff:b', t0).ok, true)
  })

  test('ふだんの使い方（患者 1 人に 音声整形 2 回＋統合 1 回＋再生成 2 回）は 1 日中止まらない', () => {
    const t0 = 5_000_000_000
    let t = t0
    for (let patient = 0; patient < 40; patient++) {           // 1 日 40 人を 1 人のスタッフで
      for (let k = 0; k < 5; k++) { assert.equal(checkRateLimit('staff:a', t).ok, true); t += 20_000 }
      t += 5 * 60_000
    }
  })

  test('数える単位: ログイン中はスタッフ ID、無ければ IP', () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }, socket: {} }
    assert.equal(rateLimitKey(req, { id: 'u1' }), 'staff:u1')
    assert.equal(rateLimitKey(req, undefined), 'ip:203.0.113.5')
    assert.equal(rateLimitKey({ headers: {}, socket: { remoteAddress: '::1' } }, null), 'ip:::1')
  })
})

// ──────────────────────────────────────────────────────────
describe('API が守りを実際に使っている', () => {
  const read = p => readFileSync(join(ROOT, p), 'utf8')

  test('/api/questionnaire は POST・PATCH とも検証を通す', () => {
    const s = read('pages/api/questionnaire.js')
    assert.ok(s.includes('validateCreate(req.body)'))
    assert.ok(s.includes('validatePatch(req.body)'))
  })

  test('/api/generate・/api/generate-karte はレート制限を通す', () => {
    assert.ok(read('pages/api/generate.js').includes('enforceRateLimit('))
    assert.ok(read('pages/api/generate-karte.js').includes('checkRateLimit('))
  })

  test('監査ログに問診の中身（form_data・カルテ本文）を送らない', () => {
    const s = read('pages/api/questionnaire.js')
    assert.ok(!/new_value:\s*JSON\.stringify\(updates\)/.test(s), 'updates を丸ごと監査ログに送っている')
    assert.ok(!/new_value:[^\n]*form_data/.test(s))
    assert.ok(!/new_value:[^\n]*generated_karte/.test(s))
  })

  test('モデル名の直書きは lib/config.js だけ', () => {
    const offenders = []
    const walk = dir => {
      for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const p = `${dir}/${e.name}`
        if (e.isDirectory()) walk(p)
        else if (/\.(m?js)$/.test(e.name) && p !== 'lib/config.js' && /['"]claude-sonnet-[\d-]+['"]/.test(read(p))) offenders.push(p)
      }
    }
    for (const d of ['lib', 'pages', 'components', 'scripts/eval']) walk(d)
    assert.deepEqual(offenders, [], 'モデル名は lib/config.js の CLAUDE_MODEL を使うこと')
  })
})
