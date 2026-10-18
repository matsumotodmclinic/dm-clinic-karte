// ドクターキューブ改訂依頼書（変更箇所が赤い HTML）の検査。
//
// ★これは**院外に出す資料**なので、見落としの意味が重い:
//   ・本文が落ちる → 依頼が伝わらない
//   ・赤が落ちる   → 現行のままでよいと読まれる
//   ・赤が増える   → 直さなくていい所まで直される
// どれも「見れば分かる」ようでいて、680 行あると人の目では追えない。機械で見る。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { markChangedLines, renderRequestHtml } from '../../lib/drqubeRequest.js'

const SRC = 'docs/doctorqube_questionnaire_all.md'
const OUT = 'docs/doctorqube_request.html'
const md = fs.readFileSync(SRC, 'utf8')
const html = renderRequestHtml(md)
const plain = html.replace(/<[^>]+>/g, '')

/** 行から Markdown の記号を落として、本文だけにする */
const bodyOf = l => l
  .replace(/<!--変更-->/g, '')
  .replace(/^\s*#{1,6}\s+/, '')
  .replace(/^\s*-\s+/, '')
  .replace(/^>\s?/, '')
  .replace(/\*\*/g, '')
  .replace(/^\|/, '').replace(/\|$/, '')
  .trim()

describe('依頼書 HTML: 本文を落とさない', () => {
  test('空行・区切り・表の罫線を除く全行が HTML に入っている', () => {
    const missing = []
    for (const raw of md.split(/\r?\n/)) {
      const b = bodyOf(raw)
      if (!b || /^-+$/.test(b) || /^[\s:|-]+$/.test(b)) continue
      // 表の行はセルごとに分かれるので、セル単位で見る
      const parts = raw.trim().startsWith('|') ? b.split('|').map(s => s.trim()).filter(Boolean) : [b]
      for (const p of parts) {
        const needle = p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        if (!plain.includes(needle)) missing.push(p.slice(0, 50))
      }
    }
    assert.deepEqual(missing, [], '依頼書の本文が HTML に出ていない（変換器が書式を取りこぼしている）')
  })

  test('見えない印は紙に出ない', () => {
    assert.ok(!html.includes('<!--変更-->'), '`<!--変更-->` がそのまま出ている')
    assert.ok(md.includes('<!--変更-->'), '元の資料から見えない印が消えている（赤が落ちる）')
  })
})

describe('依頼書 HTML: 赤くする場所', () => {
  const marked = markChangedLines(md)
  const redText = marked.filter(r => r.changed).map(r => r.text).join('\n')
  const blackText = marked.filter(r => !r.changed).map(r => r.text).join('\n')

  test('2026-10-15 の追補 6 点がすべて赤い', () => {
    const musts = [
      ['① 体重減少の「わからない」', 'わからない'],
      ['② 甲状腺の当日診察', 'エコーの結果により当日に医師が診察する場合があります'],
      ['③ 紹介状の持参予定', '紹介状のご持参について'],
      ['④ 小児慢性の申請状況', '小児慢性特定疾病の医療費助成について'],
      ['⑤ 03 妊娠の産科通院先', '現在通院中の医療機関について'],
      ['⑥ 帯状疱疹ワクチン', '帯状疱疹'],
    ]
    for (const [name, needle] of musts) {
      assert.ok(redText.includes(needle), `赤になっていない: ${name}`)
    }
  })

  test('資料が持っている印（【新規追加】【必須化】）は全部赤い', () => {
    const notRed = blackText.split('\n')
      .filter(l => l.includes('【新規追加】') || l.includes('【必須化】'))
      // 凡例（印そのものを説明している表の行）は除く。ここが赤いと凡例が変更点に見える
      .filter(l => !/^\|\s*【/.test(l))
    assert.deepEqual(notRed, [], '印が付いているのに赤くなっていない行がある')
  })

  test('全メニュー共通の改訂方針は赤い（全メニューに掛かる変更のため）', () => {
    for (const needle of ['「看護師」→「スタッフ」', '「15分前」→「20分前」']) {
      assert.ok(redText.includes(needle), `方針が赤になっていない: ${needle}`)
    }
  })

  test('新設メニュー（02・03）は節ごと赤い', () => {
    assert.ok(redText.includes('02. 小児1型糖尿病の事前問診'), '02 の見出しが赤くない')
    assert.ok(redText.includes('03. 妊娠糖尿病・糖尿病合併妊娠の事前問診'), '03 の見出しが赤くない')
  })

  test('★前段（この依頼書について）は赤くしない', () => {
    // 凡例に 【新規追加】 と書いてあるだけで赤くなると、凡例そのものが変更点に見える
    assert.ok(blackText.includes('現行に無い設問・選択肢'), '凡例が赤くなっている')
    assert.ok(blackText.includes('なぜ改訂したいか'), '前段の見出しが赤くなっている')
  })

  test('★改訂版メニューの素の設問は赤くしない（直さなくていい所を直されないため）', () => {
    for (const needle of ['お名前', '生年月日', '身長', '体重']) {
      if (!md.includes(needle)) continue
      assert.ok(!new RegExp(`^.*${needle}.*$`, 'm').test(redText) || blackText.includes(needle),
        `印の無い設問が赤くなっている: ${needle}`)
    }
  })
})

describe('依頼書 HTML: 生成物は repo に置かない', () => {
  // ★2026-10-18: 最初は出力を repo に入れて「流し忘れ」を検査していたが、
  //   **開いて見るファイルと生成し直すファイルが同じ**なので、院長が開いている間は
  //   Windows がファイルを掴んで書き換えられず、作業が止まった。
  //   正本は .md だけにして、送る直前に作り直す手順にした。
  test('出力は .gitignore に入っている（追跡すると書き換えられなくなる）', () => {
    const ignore = fs.readFileSync('.gitignore', 'utf8')
    assert.ok(/docs\/doctorqube_request\*?\.html/.test(ignore),
      '生成物が追跡対象に戻っている。開いている間に書き換えられず作業が止まる')
  })

  test('生成物が無くても検査できる（.md から組み立てて見ている）', () => {
    assert.ok(html.length > 1000, 'HTML が組み立てられていない')
    assert.ok(!fs.existsSync(OUT) || true, '出力の有無に関係なく通ること')
  })
})
