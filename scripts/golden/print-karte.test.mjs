// 印刷用の整形（lib/printKarte.js）。
//
// ① フッターの空行を紙だけ詰める（検査は print-sheet.test.mjs 側）
// ② 西暦 → 和暦（院長 2026-10-15「貼り付けしA4出力する際に自動で、和暦に換算する
//    ようなシステムにしてほしい」）
//
// ★ここは**紙にだけ**掛ける変換。保存してある貼り付け原文は患者が入力したまま。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toWarekiForPrint, collapseBlankLinesForPrint } from '../../lib/printKarte.js'
import { toWareki, toWarekiYmd } from '../../lib/wareki.js'

describe('lib/printKarte: 西暦 → 和暦', () => {
  test('元号の境目', () => {
    // 令和は 2019年5月から。2019年4月は平成31年
    assert.deepEqual(toWarekiForPrint('2019年4月'), 'H31.4')
    assert.deepEqual(toWarekiForPrint('2019年5月'), 'R1.5')
    assert.deepEqual(toWarekiForPrint('1989年1月'), 'H1.1')
    assert.deepEqual(toWarekiForPrint('1988年12月'), 'S63.12')
  })

  test('ドクターキューブの書式（年月・年月日・スラッシュ）', () => {
    assert.equal(toWarekiForPrint('検査した年月： 2026年10月'), '検査した年月： R8.10')
    assert.equal(toWarekiForPrint('2026年10月15日'), 'R8.10.15')
    assert.equal(toWarekiForPrint('2026/10/15 受診'), 'R8.10.15 受診')
    assert.equal(toWarekiForPrint('2026-03-02'), 'R8.3.2')
  })

  // ★実測で踏んだ 2 つ。直すときに戻さないよう残す
  test('改行をまたいで次の行の数字を食わない（行が潰れる）', () => {
    const src = '手術 1989年1月\n2026/10/15 受診'
    assert.equal(toWarekiForPrint(src), '手術 H1.1\nR8.10.15 受診')
    assert.equal(toWarekiForPrint(src).split('\n').length, 2, '行数が変わっている')
  })

  test('「○年○月」の後ろの数字を日と見なさない', () => {
    assert.equal(toWarekiForPrint('2026年10月 3回'), 'R8.10 3回')
  })

  test('年でないものは触らない', () => {
    for (const s of ['血圧 120/80', '電話 048-1234-5678', 'HbA1c 8.1%', '1900年5月', '体重 74kg']) {
      assert.equal(toWarekiForPrint(s), s, `触ってはいけない: ${s}`)
    }
  })

  test('toWareki は範囲外に null を返す', () => {
    assert.equal(toWareki(2026, 13), null)
    assert.equal(toWareki(1900, 5), null)
    assert.equal(toWareki('あ', 1), null)
  })

  test('空・null でも落ちない', () => {
    assert.equal(toWarekiForPrint(''), '')
    assert.equal(toWarekiForPrint(null), '')
    assert.equal(collapseBlankLinesForPrint(null), '')
  })
})
