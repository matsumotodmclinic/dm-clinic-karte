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

  test('見本に実在しそうな個人情報を書かない（氏名・生年月日は手書き欄）', () => {
    const s = JSON.stringify(SAMPLE_FORM_DATA)
    for (const ng of ['生年月日', '様', '電話', '℡']) {
      assert.ok(!s.includes(ng), `見本データに ${ng} が入っている`)
    }
  })
})
