// リブレ（自費CGM）の申し送り（lib/libreNotes.js）と、日付の和暦換算（lib/wareki.js）の単体検査。
//
// ここで見るのは「入力が無い回を『済』と書かない」こと（院長 2026-10-16 の依頼の核心）。
// カルテ本文に出ているかは prompt.test.mjs、スタッフ向け早見表との同期は
// handoff-catalog.test.mjs、情報が落ちていないかは coverage.test.mjs が別に見る。
//
// ★スナップショットは和暦を R{NOW} に伏せる（実行日で変わる行があるため）ので、
//   **装着日・予約日が正しい和暦になっているかはここでしか検査できない。**

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRhLibreLines, buildGdmLibreReservationLines, buildDmLibreLines,
  LIBRE_ATTACHED, LIBRE_NOT_ATTACHED, POSTPRANDIAL_HYPO_SYMPTOM,
} from '../../lib/libreNotes.js'
import { toWarekiYmd } from '../../lib/wareki.js'

const one = lines => { assert.equal(lines.length, 1, `1 行のはずが ${lines.length} 行`); return lines[0] }

describe('lib/wareki: 日付ピッカーの値 → 和暦', () => {
  test('元号の境目', () => {
    assert.equal(toWarekiYmd('2019-04-30'), 'H31.4.30')
    assert.equal(toWarekiYmd('2019-05-01'), 'R1.5.1')
    assert.equal(toWarekiYmd('1989-01-07'), 'H1.1.7')
    // ★昭和の元年は 12 月始まり。base を from から割り出すと 1 年ずれる（printKarte の実測バグ）
    assert.equal(toWarekiYmd('1988-12-31'), 'S63.12.31')
  })

  test('0 埋めを落として書く（R8.03.02 ではなく R8.3.2）', () => {
    assert.equal(toWarekiYmd('2026-03-02'), 'R8.3.2')
    assert.equal(toWarekiYmd('2026-10-16'), 'R8.10.16')
  })

  test('読めない値は空（カルテに西暦や壊れた文字列を書かないため）', () => {
    for (const v of ['', null, undefined, '2026-10', '令和8年10月16日', '2026/10/16', '2026-13-01', '1900-01-01']) {
      assert.equal(toWarekiYmd(v), '', `触ってはいけない: ${JSON.stringify(v)}`)
    }
  })
})

describe('lib/libreNotes: 反応性低血糖（初事前で装着）', () => {
  test('装着済 + 日付 → 和暦で書く', () => {
    assert.equal(one(buildRhLibreLines({ libre: { attached: LIBRE_ATTACHED, date: '2026-10-16' } })),
      '□自費CGM（リブレ）初事前で装着済（R8.10.16）')
  })

  test('装着済 だが日付が無い → 日付を作らない', () => {
    assert.equal(one(buildRhLibreLines({ libre: { attached: LIBRE_ATTACHED } })),
      '□自費CGM（リブレ）初事前で装着済（装着日 未記入）')
  })

  test('未装着 → 初診時に医師と相談に回す。理由があれば添える', () => {
    assert.equal(one(buildRhLibreLines({ libre: { attached: LIBRE_NOT_ATTACHED } })),
      '□自費CGM（リブレ）未装着 → 初診時に医師とご相談ください')
    assert.equal(one(buildRhLibreLines({ libre: { attached: LIBRE_NOT_ATTACHED, note: '在庫切れ' } })),
      '□自費CGM（リブレ）未装着（理由：在庫切れ） → 初診時に医師とご相談ください')
  })

  test('★未入力は「未確認」。全例装着の運用でも済と書かない', () => {
    const expected = '□自費CGM（リブレ）初事前での装着 未確認 → 装着したかご確認ください'
    assert.equal(one(buildRhLibreLines({})), expected, 'libre そのものが無い（入力欄を足す前のレコード）')
    assert.equal(one(buildRhLibreLines({ libre: {} })), expected)
    assert.equal(one(buildRhLibreLines({ libre: { attached: '', date: '2026-10-16' } })), expected,
      '日付だけ入っていても、装着したとは書かない')
  })

  test('日付が読めない値のときも黙って落とさない', () => {
    assert.equal(one(buildRhLibreLines({ libre: { attached: LIBRE_ATTACHED, date: '2026/10/16' } })),
      '□自費CGM（リブレ）初事前で装着済（2026/10/16）',
      'DB を直接いじった等の異常。消すと気付けないままになる')
  })
})

describe('lib/libreNotes: 妊娠糖尿病（予約3回分）', () => {
  const all = { firstVisit: '2026-10-23', follow1: '2026-11-06', follow2: '2026-11-20' }

  test('3 つ揃ったら 取得済 + 日付', () => {
    assert.equal(one(buildGdmLibreReservationLines({ libre: all })),
      '□リブレ装着の予約3回分 取得済（初診 R8.10.23・GDMフォロー① R8.11.6・GDMフォロー② R8.11.20）')
  })

  test('一部だけなら、未記入の枠を見せて残りを促す', () => {
    assert.equal(one(buildGdmLibreReservationLines({ libre: { firstVisit: '2026-10-23', follow2: '2026-11-20' } })),
      '□リブレ装着の予約3回分（初診 R8.10.23・GDMフォロー① 未記入・GDMフォロー② R8.11.20）→ 残りの予約をお取りください')
  })

  test('★1 つも無い回は従来どおり段取りの指示（取っていないと断定しない）', () => {
    const expected = '□リブレ装着は初診時・初事前で予約3回分（初診・GDMフォロー①②）→ 予約日 未記入'
    assert.equal(one(buildGdmLibreReservationLines({})), expected, '入力欄を足す前のレコード')
    assert.equal(one(buildGdmLibreReservationLines({ libre: { firstVisit: '', follow1: '', follow2: '' } })), expected)
  })
})

describe('lib/libreNotes: DM基本（問診中に反応性低血糖を訴えた回）', () => {
  const withComplaint = libre => ({
    disease: { dmSymptoms: { selected: ['のどが渇く', POSTPRANDIAL_HYPO_SYMPTOM] } },
    libre,
  })

  test('訴えが無い回は 1 行も出さない', () => {
    assert.deepEqual(buildDmLibreLines({ disease: { dmSymptoms: { selected: ['のどが渇く'] } }, libre: { attached: LIBRE_ATTACHED, date: '2026-10-16' } }), [])
    assert.deepEqual(buildDmLibreLines({}), [], 'dmSymptoms そのものが無いフォーム形でも落ちない')
  })

  test('装着済 → 日付つきで記録', () => {
    assert.equal(one(buildDmLibreLines(withComplaint({ attached: LIBRE_ATTACHED, date: '2026-10-16' }))),
      '□反応性低血糖の訴えあり：自費CGM（リブレ）装着済（R8.10.16）')
  })

  test('★未装着・未入力はどちらも「初診時に医師とご相談ください」', () => {
    assert.equal(one(buildDmLibreLines(withComplaint({ attached: LIBRE_NOT_ATTACHED }))),
      '□反応性低血糖の訴えあり：自費CGM（リブレ）未装着 → 初診時に医師とご相談ください')
    assert.equal(one(buildDmLibreLines(withComplaint({}))),
      '□反応性低血糖の訴えあり：自費CGM（リブレ）装着の有無 未確認 → 初診時に医師とご相談ください')
  })
})
