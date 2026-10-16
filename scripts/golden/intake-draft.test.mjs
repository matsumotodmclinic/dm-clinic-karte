// 問診の下書き（lib/intakeDraft.js・lib/useIntakeDraft.js）のテスト。2026-10-16 新設。
// ★全緑になることより「壊したら赤くなること」を見る。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  DRAFT_TTL_MS, draftKey, prevDraftKey, serializeDraft, parseDraft, mergeDraft, formatSavedAt,
} from '../../lib/intakeDraft.js'

const NOW = Date.UTC(2026, 9, 16, 1, 42) // 10:42 JST

test('保存したものがそのまま読める（ステップも）', () => {
  const data = { history: { age: '65' }, alert: { weightLoss: 'あり' } }
  const d = parseDraft(serializeDraft({ data, step: 3 }, NOW), NOW + 1000)
  assert.deepEqual(d, { savedAt: NOW, step: 3, data })
})

test('12 時間を過ぎた下書きは捨てる（共有 PC に問診を長く残さない）', () => {
  const text = serializeDraft({ data: { a: 1 }, step: 0 }, NOW)
  assert.ok(parseDraft(text, NOW + DRAFT_TTL_MS - 1))
  assert.equal(parseDraft(text, NOW + DRAFT_TTL_MS + 1), null)
  assert.equal(DRAFT_TTL_MS, 12 * 60 * 60 * 1000)
})

test('壊れた・形の違う中身は null（例外で問診画面を落とさない）', () => {
  for (const bad of [null, '', '{', 'null', '[]', '"x"', '{"savedAt":"x","data":{}}',
    JSON.stringify({ savedAt: NOW, data: [] }), JSON.stringify({ savedAt: NOW }),
    JSON.stringify({ savedAt: NOW + 10 * 60 * 1000, data: {} })]) {
    assert.equal(parseDraft(bad, NOW), null, String(bad))
  }
})

test('フォームに項目が足された後でも、足された項目は既定値で埋まる', () => {
  const initial = {
    history: { age: '', alcoholItems: [], fh: { dm: false, dmWho: [] } },
    libre: { attached: '', date: '' }, // 下書きの後に足された節
  }
  const saved = { history: { age: '70', alcoholItems: [{ type: 'beer' }], fh: { dm: true } } }
  const m = mergeDraft(initial, saved)
  assert.equal(m.history.age, '70')
  assert.deepEqual(m.history.alcoholItems, [{ type: 'beer' }])
  assert.deepEqual(m.history.fh, { dm: true, dmWho: [] })
  assert.deepEqual(m.libre, { attached: '', date: '' })
})

test('型が食い違う項目は既定値を採る（配列のはずが文字列 → `.includes` で落ちない）', () => {
  const initial = { disease: { selected: [], sub: { x: '' } } }
  const m = mergeDraft(initial, { disease: { selected: 'のどが渇く', sub: 'x' } })
  assert.deepEqual(m.disease.selected, [])
  assert.deepEqual(m.disease.sub, { x: '' })
})

test('initialData に無い項目（音声入力など後から入る値）も落とさない', () => {
  const m = mergeDraft({ a: '' }, { a: '1', voiceMemo: { transcript: 't', aiSummary: 's' } })
  assert.deepEqual(m.voiceMemo, { transcript: 't', aiSummary: 's' })
})

test('保存枠と前回枠はフォームごとに分かれる', () => {
  assert.notEqual(draftKey('DM基本'), draftKey('1型糖尿病'))
  assert.notEqual(draftKey('DM基本'), prevDraftKey('DM基本'))
})

test('バナーの時刻表示', () => {
  const d = new Date(2026, 9, 16, 9, 5)
  assert.equal(formatSavedAt(d.getTime()), '09:05')
})

// ── 組み込みの検査（新しいフォームを足して忘れたら落ちる）────────────────
const tools = readdirSync('components').filter(f => f.endsWith('IntakeTool.js'))

test('全 IntakeTool が下書きの hook とバナーを使っている', () => {
  assert.ok(tools.length >= 9)
  for (const f of tools) {
    const s = readFileSync('components/' + f, 'utf8')
    assert.match(s, /useIntakeDraft\(/, f + ': useIntakeDraft が無い')
    assert.match(s, /<DraftRestoreBanner draft=\{draft\}/, f + ': バナーが無い')
    assert.match(s, /saved: !!visitCode/, f + ': 保存済みで下書きを消す条件が無い')
  }
})

test('下書きの保存枠がフォーム間で重ならない', () => {
  const keys = tools.map(f => readFileSync('components/' + f, 'utf8').match(/useIntakeDraft\(([^,]+),/)[1])
  assert.equal(new Set(keys).size, keys.length, keys.join(' / '))
})

test('音声入力欄は前回の文字起こしから始める（再開・「修正する」で消さない）', () => {
  const s = readFileSync('components/VoiceMemoSection.js', 'utf8')
  assert.match(s, /useSpeechRecognition\(initialValue\?\.transcript/)
})
