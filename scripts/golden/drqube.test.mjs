// ドクターキューブの貼り付けテキストの分割（lib/drQube.js）。
// 院長が実際にドクターキューブから貼った文（2026-10-14）をそのまま使う。
// ★患者の実データではない（選択肢と形式が分かる見本として院長が作った文）。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { splitDrQube } from '../../lib/drQube.js'

// 院長が貼り付けた見本（形式の正本。ドクターキューブ側の出力が変わったらここを更新する）
const SAMPLE = `【受診理由】
通院中の病院があるが、転院したい その他(下記にご記入ください)
【その他の内容】 仕事の関係で土曜日に通院したいため

【体重減少の有無】
あり
【体重減少】
〇 8ヵ月間で 9kg減少
【その他の自覚症状】
足がつりやすい
【HbA1c】
HbA1c： 8.1%
検査した年月： 2026年10月
血糖値：mg/dl
検査した年月： 2026年10月
【当院を知った経緯】
バスの車内広告
【インスリン注射】
はい
【既に診断を受けている疾患】
1型糖尿病と診断されたことがある

【CGM】
使用している　【使用している方】使用機種名: てるも、リブレ
【CSⅡ】
　【使用している方】使用機種名: 関心がある／使ってみたいと思っている`

describe('lib/drQube（ドクターキューブの貼り付け）', () => {
  test('【項目】ごとの塊に分かれる', () => {
    const blocks = splitDrQube(SAMPLE)
    assert.ok(blocks, '分割されなかった')
    assert.equal(blocks.length, 11)
    assert.ok(blocks.every(b => b.startsWith('【')), '【 で始まらない塊がある')
  })

  test('項目の値は塊の中に残る（段や欄の切れ目で泣き別れない）', () => {
    const blocks = splitDrQube(SAMPLE)
    // 2 段組みを試したときに実測で泣き別れていたのがこの塊（右段の先頭に「血糖値」だけが出ていた）
    const hba1c = blocks.find(b => b.startsWith('【HbA1c】'))
    assert.ok(hba1c.includes('8.1%'), 'HbA1c の値が別の塊に行っている')
    assert.ok(hba1c.includes('血糖値'), '血糖値の行が別の塊に行っている')
    assert.ok(hba1c.includes('検査した年月： 2026年10月'), '検査年月が別の塊に行っている')
  })

  test('途中の空行で塊が切れない（【 だけが区切り）', () => {
    const blocks = splitDrQube(SAMPLE)
    const sympt = blocks.find(b => b.startsWith('【既に診断を受けている疾患】'))
    assert.ok(sympt.includes('1型糖尿病と診断されたことがある'))
  })

  test('ドクターキューブ以外の形式は分割しない（勝手に切らない）', () => {
    assert.equal(splitDrQube('ただのメモ書きです。\n改行もあります。'), null)
    assert.equal(splitDrQube('【項目】1つだけ\n値'), null)
    assert.equal(splitDrQube(''), null)
    assert.equal(splitDrQube(null), null)
  })

  test('CRLF で貼られても同じ結果になる（Windows からの貼り付け）', () => {
    assert.deepEqual(splitDrQube(SAMPLE.replace(/\n/g, '\r\n')), splitDrQube(SAMPLE))
  })

  test('分割しても文字は 1 つも落ちない', () => {
    const blocks = splitDrQube(SAMPLE)
    const joined = blocks.join('\n').replace(/\s/g, '')
    assert.equal(joined, SAMPLE.replace(/\s/g, ''))
  })
})
