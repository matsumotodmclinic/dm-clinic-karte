// 予約なし来院の手書き問診票（lib/walkinForm.js + pages/print/walkin.js）。
//
// この紙の目的は**ルールアウト**（院長 2026-10-15）:
//   体重減少 / HbA1c 10%以上 の方は、スタッフが初事前の予約を**前倒し**する。
// なので「その 2 つが紙の上にあり、スタッフが動けるようになっているか」を検査する。
// 体裁（1 枚に収まるか）は画面の警告で見る。ここでは中身を守る。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { WALKIN_META, URGENT, MENUS, COMMON, BY_MENU, STAFF } from '../../lib/walkinForm.js'

const page = fs.readFileSync('pages/print/walkin.js', 'utf8')
const flat = JSON.stringify({ URGENT, COMMON, BY_MENU, STAFF })

describe('予約なし来院の手書き問診票', () => {
  test('ルールアウトの 2 問が最優先ブロックにある', () => {
    assert.equal(URGENT.length, 2, '最優先は 2 問（体重減少・HbA1c）')
    const [w, h] = URGENT
    assert.equal(w.id, 'weightLoss')
    assert.equal(h.id, 'hba1c')
    // 体重減少は「3か月で3kg以上」を設問文に入れる（院長 2026-10-15 の確定）
    assert.match(w.question, /3か月/, '定義の期間が設問文に無い')
    assert.match(w.question, /3kg/, '定義の体重が設問文に無い')
    // ★「わからない」を必ず置く（迷った方が「いいえ」を選ぶと見落とす）
    assert.ok(w.options.includes('わからない'), '「わからない」が無い')
    assert.match(h.write, /HbA1c/, 'HbA1c の記入欄が無い')
  })

  test('スタッフ記入欄が「前倒し」で閉じている（紙が目的を果たす）', () => {
    const joined = STAFF.checks.join('\n')
    assert.match(joined, /体重減少.*前倒し/, '体重減少 → 前倒し の行が無い')
    assert.match(joined, /HbA1c 10%以上.*前倒し/, 'HbA1c 10%以上 → 前倒し の行が無い')
    assert.match(STAFF.write, /初事前/, '初事前の予約日を書く欄が無い')
  })

  test('ドクターキューブのメニューと同じ区分が並んでいる', () => {
    assert.equal(MENUS.length, 10, 'ドクターキューブのメニューは 10')
    for (const m of ['糖尿病・血糖の異常', '甲状腺', '睡眠時無呼吸症候群（SAS）', '健診', '予防接種']) {
      assert.ok(MENUS.includes(m), `区分が足りない: ${m}`)
    }
  })

  test('ドクターキューブで聞いている項目が落ちていない', () => {
    // 当院の実装と突き合わせて足りなかったものも含む（GLP-1・紹介状の持参）
    for (const must of ['GLP-1', '紹介状', 'CGM', 'インスリン', '当院をどのように']) {
      assert.ok(flat.includes(must), `項目が落ちている: ${must}`)
    }
  })

  test('文言はページに直書きしない（正本は lib/walkinForm.js）', () => {
    // 紙の文言が 2 箇所に散ると、ドクターキューブ改訂のたびに片方だけ直す事故になる
    for (const ng of ['体重が減っていませんか', '初事前の予約を前倒し', '健診・人間ドック']) {
      assert.ok(!page.includes(ng), `ページに文言が直書きされている: ${ng}`)
    }
    assert.ok(page.includes("from '../../lib/walkinForm'"), 'lib を参照していない')
  })

  test('印刷の高さは余白を引いて測る（紙では padding 0）', () => {
    // 余白込みで測ると「紙では余っているのに はみ出し」と出る（実測で約 20mm ぶん）
    assert.ok(page.includes('paddingTop'), '余白を引く計算が無い')
  })

  // ★入口はドクターキューブに一本化した（院長 2026-10-15）。この紙は非常用。
  //   「非常用」の表示が消えると、通常運用に紛れ込んで二重入力が復活する。
  test('非常用であることが紙にも画面にも書いてある', () => {
    assert.match(WALKIN_META.emergency, /非常用/, '紙に印字する但し書きが無い')
    assert.ok(page.includes('WALKIN_META.emergency'), '紙に但し書きを印字していない')
    assert.ok(page.includes('通常は使いません'), '画面に「通常は使わない」と出していない')
  })

  test('スタッフ向けの流れが「ドクターキューブに一本化」になっている', () => {
    const handoff = fs.readFileSync('pages/help/handoff.js', 'utf8')
    assert.match(handoff, /一本化/, '運用の流れが紙の運用のままになっている')
    assert.match(handoff, /非常用/, '非常用であることが書かれていない')
  })

  test('クリニック名とタイトルがある', () => {
    assert.match(WALKIN_META.clinic, /まつもと糖尿病クリニック/)
    assert.match(WALKIN_META.title, /ご予約なし/)
  })
})
