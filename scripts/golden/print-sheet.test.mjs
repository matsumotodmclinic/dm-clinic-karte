// A4（印刷）の紙を、実データ用と印刷見本で**同じ部品**から出していることを検査する。
//
// 実データ = /print/[id]（Supabase のレコード）
// 印刷見本 = /print/sample（架空データ・院長が実際に印刷して確かめるためのもの）
// 紙の中身を 2 箇所に書くと必ずずれる（この repo が何度もやられている）ので、
// components/PrintSheet.js の 1 箇所だけにしてある。
//
// ★見本は「いちばん厳しい回」でなければ確認の意味が薄い。
//   1型糖尿病（カルテ最長）＋ ドクターキューブ貼り付けあり になっていることも見る。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildKarteTemplate } from '../../lib/buildKarteTemplate.js'
import { splitDrQube } from '../../lib/drQube.js'
import { collapseBlankLinesForPrint } from '../../lib/printKarte.js'
import { SAMPLE_FORM_DATA, SAMPLE_FORM_TYPE } from '../../lib/printSample.js'
import { FIXTURES } from './fixtures.mjs'

const read = f => fs.readFileSync(f, 'utf8')
const PAGES = ['pages/print/[id].js', 'pages/print/sample.js']

describe('印刷用 A4（components/PrintSheet.js）', () => {
  for (const f of PAGES) {
    test(`${f}: 紙の中身は PrintSheet から出す（写さない）`, () => {
      const s = read(f)
      assert.ok(s.includes("from '../../components/PrintSheet'"), 'PrintSheet を import していない')
      assert.ok(s.includes('<PrintSheet record='), 'PrintSheet を使っていない')
      // 紙の体裁をページ側に書き戻していないか
      for (const ng of ['kp-print-head', 'kp-print-karte', 'kp-print-dq-block', '@page']) {
        assert.ok(!s.includes(ng), `紙の体裁がページ側に戻ってきている: ${ng}`)
      }
    })

    test(`${f}: CSS は dangerouslySetInnerHTML で入れる`, () => {
      // ★<style>{CSS}</style> だと SSR 側だけ ' が &#x27; に escape され、
      //   hydration エラーになる（2026-10-14 に実際に出した。font-family の引用符が原因）。
      const s = read(f)
      assert.ok(s.includes('<style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />'),
        '<style>{PRINT_CSS}</style> に戻すと hydration エラーになる')
    })
  }

  test('印刷見本は「いちばん厳しい回」になっている', () => {
    assert.equal(SAMPLE_FORM_TYPE, '1型糖尿病', 'カルテが最長のフォームで見本を作ること')
    const karte = buildKarteTemplate(SAMPLE_FORM_TYPE, SAMPLE_FORM_DATA)
    assert.ok(karte, 'カルテが組めない')
    assert.ok(karte.split('\n').length >= 50, `見本のカルテが短すぎる（${karte.split('\n').length}行）`)
    assert.ok(SAMPLE_FORM_DATA.drQube?.text, 'ドクターキューブの貼り付けが無い')
    assert.ok(splitDrQube(SAMPLE_FORM_DATA.drQube.text), '貼り付けが【項目】形式になっていない')
  })

  test('見本のカルテは本物と同じ長さの規模（フィクスチャと行数が近い）', () => {
    const sample = buildKarteTemplate(SAMPLE_FORM_TYPE, SAMPLE_FORM_DATA).split('\n').length
    const fixture = buildKarteTemplate('1型糖尿病', FIXTURES['1型糖尿病']).split('\n').length
    assert.ok(Math.abs(sample - fixture) <= 3,
      `見本（${sample}行）とフィクスチャ（${fixture}行）が離れすぎ。見本の中身が痩せている可能性`)
  })

  // ★紙と電子カルテで要る隙間が違う（院長 2026-10-14）
  //   電子カルテに貼る文 = フッターの上に 3 行（医師が追記する場所）
  //   紙              = 1 行（3 行だと 目標HbA1c 以下が裏のページに送られる）
  describe('フッターの空行（紙は1行・電子カルテは3行）', () => {
    const FORMS = Object.keys(FIXTURES)
    // ★受診理由の 1 行目も `R8.10：…` で始まる。フッターは **最後の** 一致
    const footerIndex = ls => ls.map((l, i) => [l, i])
      .filter(([l]) => /^R\d+\.\d+：/.test(l)).map(([, i]) => i).pop() ?? -1

    test('カルテ本文（電子カルテに貼る文）はフッターの上が空行3つ', () => {
      for (const f of FORMS) {
        const karte = buildKarteTemplate(f, FIXTURES[f])
        const ls = karte.split('\n')
        const i = footerIndex(ls)
        assert.ok(i > 0, `${f}: フッターが見つからない`)
        const blanks = []
        for (let k = i + 1; k < ls.length && ls[k] === ''; k++) blanks.push(k)
        assert.equal(blanks.length, 3, `${f}: フッター直後の空行が ${blanks.length} 行（3 行であること）`)
      }
    })

    test('紙に出すときは空行1つに詰まる', () => {
      for (const f of FORMS) {
        const karte = buildKarteTemplate(f, FIXTURES[f])
        const ls = collapseBlankLinesForPrint(karte).split('\n')
        const i = footerIndex(ls)
        let n = 0
        for (let k = i + 1; k < ls.length && ls[k] === ''; k++) n++
        assert.equal(n, 1, `${f}: 紙のフッター直後の空行が ${n} 行（1 行であること）`)
      }
    })

    test('詰めるのはフッターだけ（本文の行は 1 行も消えない）', () => {
      const karte = buildKarteTemplate('DM基本', FIXTURES['DM基本'])
      const printed = collapseBlankLinesForPrint(karte)
      const nonBlank = s => s.split('\n').filter(l => l.trim())
      assert.deepEqual(nonBlank(printed), nonBlank(karte), '中身の行が変わっている（空行を詰めるだけのはず）')
    })
  })
  test('見本に実在しそうな個人情報を書かない（氏名・生年月日は手書き欄）', () => {
    const s = JSON.stringify(SAMPLE_FORM_DATA)
    for (const ng of ['生年月日', '様', '電話', '℡']) {
      assert.ok(!s.includes(ng), `見本データに ${ng} が入っている`)
    }
  })
})
