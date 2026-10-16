// 問診データの保存期間（lib/retention.js）のテスト。2026-10-17 新設。
// ★削除は元に戻せないので「消さないはずの時に消さない」を重点的に見る。

import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  retentionDays, retentionCutoff, claimPurgeSlot, purgeExpired, _resetPurgeSlot,
  MIN_RETENTION_DAYS, PURGE_INTERVAL_MS,
} from '../../lib/retention.js'

const NOW = Date.UTC(2026, 9, 17, 0, 0)

// supabase の delete().lt() を記録するだけの偽物
function fakeSupabase({ count = 3, error = null, throws = false } = {}) {
  const calls = []
  return {
    calls,
    from(table) {
      return {
        delete(opts) {
          return {
            lt(col, val) {
              calls.push({ table, opts, col, val })
              if (throws) return Promise.reject(new Error('network'))
              return Promise.resolve({ count, error })
            },
          }
        },
      }
    },
  }
}

beforeEach(() => _resetPurgeSlot())

test('環境変数が無ければ何も消さない（配備しただけでは消え始めない）', async () => {
  const sb = fakeSupabase()
  assert.deepEqual(await purgeExpired(sb, { env: {}, now: NOW }), { skipped: 'disabled' })
  assert.equal(sb.calls.length, 0)
})

test('設定ミスは無効扱い（30 未満・数字以外・小数・負数）', () => {
  for (const v of ['', ' ', '0', '9', '29', 'abc', '90日', '90.5', '-90', undefined]) {
    assert.equal(retentionDays({ QUESTIONNAIRE_RETENTION_DAYS: v }), null, String(v))
  }
  assert.equal(retentionDays({ QUESTIONNAIRE_RETENTION_DAYS: '90' }), 90)
  assert.equal(retentionDays({ QUESTIONNAIRE_RETENTION_DAYS: ' 90 ' }), 90)
  assert.equal(retentionDays({ QUESTIONNAIRE_RETENTION_DAYS: String(MIN_RETENTION_DAYS) }), 30)
})

test('90 日前より前に保存されたものだけを消す（状態は問わない）', async () => {
  const sb = fakeSupabase({ count: 5 })
  const r = await purgeExpired(sb, { env: { QUESTIONNAIRE_RETENTION_DAYS: '90' }, now: NOW })
  assert.deepEqual(r, { deleted: 5, cutoff: '2026-07-19T00:00:00.000Z', days: 90 })
  assert.equal(sb.calls.length, 1)
  assert.deepEqual(sb.calls[0], { table: 'questionnaires', opts: { count: 'exact' }, col: 'created_at', val: '2026-07-19T00:00:00.000Z' })
})

test('境目: ちょうど 90 日前は残る（lt = より前）', () => {
  assert.equal(retentionCutoff(90, NOW), new Date(NOW - 90 * 864e5).toISOString())
})

test('同じサーバーでは 1 時間に 1 回だけ（一覧の 30 秒ごとの更新で毎回消しに行かない）', async () => {
  const sb = fakeSupabase()
  const env = { QUESTIONNAIRE_RETENTION_DAYS: '90' }
  await purgeExpired(sb, { env, now: NOW })
  assert.deepEqual(await purgeExpired(sb, { env, now: NOW + 30 * 1000 }), { skipped: 'recent' })
  assert.equal(sb.calls.length, 1)
  await purgeExpired(sb, { env, now: NOW + PURGE_INTERVAL_MS })
  assert.equal(sb.calls.length, 2)
})

test('失敗しても例外を出さず、次の一覧表示でもう一度試す', async () => {
  const env = { QUESTIONNAIRE_RETENTION_DAYS: '90' }
  for (const sb of [fakeSupabase({ error: { message: 'boom' } }), fakeSupabase({ throws: true })]) {
    _resetPurgeSlot()
    assert.deepEqual(await purgeExpired(sb, { env, now: NOW }), { skipped: 'error' })
    assert.equal(claimPurgeSlot(NOW + 1000), true, '失敗の後は待たずに再試行できる')
  }
})

test('消した件数を操作ログに渡す（0 件のときは送らない）', async () => {
  const env = { QUESTIONNAIRE_RETENTION_DAYS: '90' }
  const logged = []
  await purgeExpired(fakeSupabase({ count: 2 }), { env, now: NOW, onDeleted: (x) => logged.push(x) })
  _resetPurgeSlot()
  await purgeExpired(fakeSupabase({ count: 0 }), { env, now: NOW, onDeleted: (x) => logged.push(x) })
  assert.equal(logged.length, 1)
  assert.equal(logged[0].deleted, 2)
})

test('一覧の API が期限切れの削除を呼んでいる', () => {
  const s = readFileSync('pages/api/questionnaire.js', 'utf8')
  assert.match(s, /purgeExpired\(supabase/)
  assert.match(s, /action: 'purge_expired'/)
})
