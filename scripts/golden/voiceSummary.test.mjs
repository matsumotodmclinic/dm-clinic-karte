// lib/voiceSummary.js（音声入力の AI 整形・入力時）のテスト
//
// 2026-10-15 まで テストゼロ だった。書き始めてすぐ、既往歴の指示文の換算例が
// 「今日がR8なら 10年前→H30、15年前→H25」と 2 年ずれた固定文字列だったことが分かった
// （正しくは H28 / H23）。AI は例をそのまま真似るので、例の誤りはカルテの時期の誤りになる。
// ⇒ 換算例は今日の日付から計算する形に直し、ここで「例が正しい西暦に戻るか」を
//   実装とは別の計算で確かめる。
//
// AI そのもの（整形の質）はここでは見ない。見るのは
//   ① 和暦換算 ② 指示文の中身 ③ 入力のはじき方と API 応答の扱い（fetch をスタブ）

import { test, describe, afterEach } from 'node:test'
import assert from 'node:assert/strict'

import {
  todayWareki, yearsAgoWareki, monthsAgoWareki,
  buildCurrentIllnessSystem, buildCurrentIllnessUser,
  buildPastHistorySystem, buildPastHistoryUser,
  summarizeForKarte, summarizeForPastHistory,
} from '../../lib/voiceSummary.js'
import { buildVocabularyHint } from '../../lib/voiceVocabulary.js'
import { CLAUDE_MODEL } from '../../lib/config.js'

const d = (y, m, day = 15) => new Date(y, m - 1, day)

// 実装を使わずに「H28 → 2016」と西暦へ戻す（答え合わせ用）
const BASE = { R: 2018, H: 1988, S: 1925 }
const toSeireki = label => {
  const m = /^([RHS])(\d+)/.exec(label)
  assert.ok(m, `和暦の形になっていない: ${label}`)
  return BASE[m[1]] + Number(m[2])
}

// 検査に使う「今日」。年始・元号の境目・ふつうの日を混ぜる
const DATES = [d(2026, 10, 15), d(2026, 1, 5), d(2024, 4, 30), d(2024, 5, 1), d(2030, 12, 31)]

// ──────────────────────────────────────────────────────────
// ① 和暦換算
// ──────────────────────────────────────────────────────────
describe('voiceSummary: 和暦換算', () => {
  test('今日の表記', () => {
    assert.equal(todayWareki(d(2026, 10, 15)).yLabel, 'R8（令和8年10月15日）')
    assert.equal(todayWareki(d(2019, 5, 1)).yLabel, 'R1（令和1年5月1日）')
    assert.equal(todayWareki(d(2019, 4, 30)).yLabel, 'H31（平成31年4月30日）')
  })

  test('○年前: 2026-10-15 時点（実際に誤っていた例）', () => {
    const now = d(2026, 10, 15)
    assert.equal(yearsAgoWareki(5, now), 'R3')
    assert.equal(yearsAgoWareki(10, now), 'H28')   // 旧: H30
    assert.equal(yearsAgoWareki(15, now), 'H23')   // 旧: H25
  })

  test('○年前: 令和/平成の境目は月で決まる（2019年4月まで平成）', () => {
    assert.equal(yearsAgoWareki(7, d(2026, 2, 1)), 'H31')
    assert.equal(yearsAgoWareki(7, d(2026, 6, 1)), 'R1')
  })

  test('○年前: 昭和まで戻れる', () => {
    assert.equal(yearsAgoWareki(40, d(2026, 10, 15)), 'S61')
  })

  test('○ヶ月前: 年をまたぐ・元号をまたぐ', () => {
    assert.equal(monthsAgoWareki(3, d(2026, 10, 15)), 'R8.7')
    assert.equal(monthsAgoWareki(3, d(2026, 1, 10)), 'R7.10')
    assert.equal(monthsAgoWareki(12, d(2026, 1, 10)), 'R7.1')
    assert.equal(monthsAgoWareki(2, d(2019, 6, 10)), 'H31.4')
    assert.equal(monthsAgoWareki(0, d(2026, 10, 15)), 'R8.10')
  })

  test('どの日付でも ○年前 は西暦に戻すと「今年 − ○」になる', () => {
    for (const now of DATES) {
      for (const n of [1, 5, 10, 15, 30]) {
        assert.equal(toSeireki(yearsAgoWareki(n, now)), now.getFullYear() - n, `${now.toISOString()} の ${n}年前`)
      }
    }
  })
})

// ──────────────────────────────────────────────────────────
// ② 指示文の中身
// ──────────────────────────────────────────────────────────
describe('voiceSummary: 指示文（system）', () => {
  // 指示文の中の「「N年前」→ XX」をすべて拾い、西暦に戻して答え合わせする
  const examples = text => [...text.matchAll(/「(\d+)年前」→ ([RHS]\d+)/g)].map(m => [Number(m[1]), m[2]])

  for (const [name, build, minExamples] of [
    ['既往歴', buildPastHistorySystem, 3],
    ['現病歴', buildCurrentIllnessSystem, 1],
  ]) {
    test(`${name}: 換算例はどの日付でも正しい（固定文字列に戻さない）`, () => {
      for (const now of DATES) {
        const ex = examples(build(now))
        assert.ok(ex.length >= minExamples, `換算例が見つからない（${ex.length}件）`)
        for (const [n, label] of ex) {
          assert.equal(toSeireki(label), now.getFullYear() - n, `${now.toISOString()}: 「${n}年前」→ ${label}`)
        }
      }
    })

    test(`${name}: 今日の日付・語彙リスト・和暦ルールが入っている`, () => {
      const now = d(2026, 10, 15)
      const s = build(now)
      assert.ok(s.includes('【今日の日付】R8（令和8年10月15日）'))
      assert.ok(s.includes(buildVocabularyHint()), '語彙リストが入っていない')
      assert.ok(s.includes('西暦・年齢・「○年前」「○ヶ月前」は絶対に使わない'))
      assert.ok(!s.includes('undefined') && !s.includes('NaN'), '埋め込みが壊れている')
    })
  }

  test('既往歴: 2026-10-15 の換算例（旧 H30 / H25 が出ない）', () => {
    const s = buildPastHistorySystem(d(2026, 10, 15))
    assert.ok(s.includes('「5年前」→ R3、「10年前」→ H28、「15年前」→ H23'))
    assert.ok(!s.includes('H30') && !s.includes('H25'))
  })

  test('現病歴: ○ヶ月前の例は具体的な年月になる（「該当月」のような曖昧な書き方をしない）', () => {
    const s = buildCurrentIllnessSystem(d(2026, 1, 10))
    assert.ok(s.includes('「3ヶ月前」→ R7.10'))
    assert.ok(!s.includes('該当月'))
  })

  test('既往歴: ♯病名（時期・病院・通院先・内服薬）の形式を指示している', () => {
    const s = buildPastHistorySystem(d(2026, 10, 15))
    assert.ok(s.includes('♯病名（時期・治療した病院・現在の通院先・内服薬）'))
    assert.ok(s.includes('「不明」など埋めない'))
  })
})

describe('voiceSummary: 指示文（user）', () => {
  test('現病歴: フォームの受診理由を参考情報として渡す', () => {
    const u = buildCurrentIllnessUser('5年前から血糖が高い', {
      reason: { type: '紹介', referralFrom: '上尾中央総合病院', referralDept: '糖尿病内科', referralDetail: '血糖コントロール不良' },
    })
    assert.ok(u.includes('受診理由: 紹介'))
    assert.ok(u.includes('紹介元病院: 上尾中央総合病院'))
    assert.ok(u.includes('紹介元科: 糖尿病内科'))
    assert.ok(u.includes('紹介の経緯メモ: 血糖コントロール不良'))
    assert.ok(u.includes('5年前から血糖が高い'))
  })

  test('現病歴: フォーム情報が空なら「(未入力)」', () => {
    for (const fd of [undefined, {}, { reason: {} }]) {
      const u = buildCurrentIllnessUser('あ', fd)
      assert.ok(u.includes('(未入力)'))
      assert.ok(!u.includes('undefined'))
    }
  })

  test('既往歴: 発話がそのまま入る', () => {
    assert.ok(buildPastHistoryUser('高血圧で薬を飲んでいる').includes('高血圧で薬を飲んでいる'))
  })
})

// ──────────────────────────────────────────────────────────
// ③ 入力のはじき方と API 応答の扱い（fetch をスタブ）
// ──────────────────────────────────────────────────────────
describe('voiceSummary: API 呼び出し', () => {
  const realFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = realFetch })

  // 呼ばれた内容を記録するスタブ
  const stub = (respond) => {
    const calls = []
    globalThis.fetch = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) })
      return respond()
    }
    return calls
  }
  const okJson = text => ({ ok: true, status: 200, json: async () => ({ content: [{ text }] }) })

  for (const [name, call, maxTokens] of [
    ['現病歴', t => summarizeForKarte(t, {}, 'dm'), 800],
    ['既往歴', t => summarizeForPastHistory(t), 1200],
  ]) {
    test(`${name}: 空・空白だけ・4000字超は API を呼ばずにはじく`, async () => {
      const calls = stub(() => okJson('x'))
      for (const t of ['', '   \n ', undefined, 'あ'.repeat(4001)]) {
        const r = await call(t)
        assert.equal(r.ok, false)
        assert.ok(r.error)
      }
      assert.equal(calls.length, 0)
      // 4000字ちょうどは通す
      assert.equal((await call('あ'.repeat(4000))).ok, true)
    })

    test(`${name}: 成功時は前後の空白を落として返す・送信内容が正しい`, async () => {
      const calls = stub(() => okJson('  ♯高血圧（H28から）\n'))
      const r = await call('高血圧')
      assert.deepEqual(r, { ok: true, summary: '♯高血圧（H28から）' })
      assert.equal(calls.length, 1)
      const { url, body } = calls[0]
      assert.equal(url, '/api/generate')
      assert.equal(body.model, CLAUDE_MODEL)
      assert.equal(body.max_tokens, maxTokens)
      assert.equal(body.system[0].cache_control.ttl, '1h')
      assert.ok(body.system[0].text.includes('【今日の日付】'))
      assert.ok(body.messages[0].content.includes('高血圧'))
    })

    test(`${name}: API エラー・空応答・通信失敗でも落ちずにエラーを返す`, async () => {
      stub(() => ({ ok: false, status: 500, json: async () => ({}) }))
      assert.deepEqual(await call('あ'), { ok: false, error: 'API エラー (500)' })

      stub(() => okJson('   '))
      assert.equal((await call('あ')).ok, false)

      stub(() => ({ ok: true, status: 200, json: async () => ({}) }))
      assert.equal((await call('あ')).ok, false)

      globalThis.fetch = async () => { throw new Error('offline') }
      const r = await call('あ')
      assert.equal(r.ok, false)
      assert.ok(r.error.includes('offline'))
    })
  }
})
