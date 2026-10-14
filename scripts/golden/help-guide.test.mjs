// 完全ガイド（pages/help/*.js）に「古くなる事実」が戻ってこないことを検査する。
//
// ■ なぜ要るか
// 2026-10-14 に院長から「完全ガイド集って更新されていますかね？」と指摘され、見たら
// 更新されていなかった。CLAUDE.md に「機能を変えたら同セッションで直すこと」と書いてあったのに、
// その日の 14 回の変更で一度も直していない。**約束は守られない前提で仕組みにする**のが
// この repo のやり方（lib/handoffCatalog.js の両方向検査と同じ）。
//
// ■ どこに何を書くか（院長 2026-10-14「ガイドから事実の部分を早見表に寄せる形で整理して」）
//   ・申し送りに何が出るか      → lib/handoffCatalog.js ＝ /help/handoff（実際の出力と突き合わせ済み）
//   ・画面に出ている文言・選択肢 → 画面そのもの（書き写すとずれる）
//   ・件数・一覧                 → 実物を数えて出す（lib/voiceVocabulary.js を import する等）
//   ・ガイドに書くのは **手順と理由**
//
// ★このファイルは「書いてはいけない形」だけを見る。中身の正しさは見られないので、
//   ガイドを薄くして正本へのリンクに寄せること自体が検査になるようにしてある。

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const HELP_DIR = 'pages/help'
const files = fs.readdirSync(HELP_DIR).filter(f => f.endsWith('.js'))
const read = f => fs.readFileSync(path.join(HELP_DIR, f), 'utf8')

// /help/handoff は早見表そのもの（□ 行を載せるのが仕事）なので対象外
const GUIDES = files.filter(f => f !== 'handoff.js')

describe('完全ガイド（pages/help）に事実を直書きしない', () => {
  test('ガイドが 1 本以上ある（ファイル名を変えたらここで気付く）', () => {
    assert.ok(GUIDES.length >= 1, 'pages/help にガイドが無い')
    assert.ok(files.includes('handoff.js'), '早見表 /help/handoff が無い')
  })

  for (const f of GUIDES) {
    test(`${f}: 申し送りの □ 行を書き写さない（正本は /help/handoff）`, () => {
      const lines = read(f).split(/\r?\n/)
      const hits = lines
        .map((l, i) => [i + 1, l])
        .filter(([, l]) => l.includes('□') && !l.trim().startsWith('//'))
      assert.deepEqual(hits.map(([n, l]) => `${n}: ${l.trim()}`), [],
        '申し送りの行はガイドに書かない。lib/handoffCatalog.js に載せて、ガイドからは <HandoffRef /> で送ること')
    })

    test(`${f}: 病名の記号は ♯（＃ は使わない）`, () => {
      const lines = read(f).split(/\r?\n/)
      const hits = lines
        .map((l, i) => [i + 1, l])
        .filter(([, l]) => /[＃#]\s*(糖尿病|高血圧|脂質異常症|HT|HL|病名|疾患)/.test(l) && !l.trim().startsWith('//'))
      assert.deepEqual(hits.map(([n, l]) => `${n}: ${l.trim()}`), [], '病名の記号は ♯ に統一した（2026-10-14）')
    })

    test(`${f}: 無くなった「プロンプト二重管理（9 ファイル同期）」を書き戻さない`, () => {
      const s = read(f)
      // 2026-09-06 に lib/buildKartePrompt.js へ一本化し、2026-09-07 からは
      // カルテ本文の組立も lib/buildKarteTemplate.js の 1 箇所だけ。
      // ここに書いてあるとおりに IntakeTool へプロンプトを書き戻すと prompt.test.mjs が落ちる。
      for (const ng of ['9 ファイル同期', '8 ファイル', 'プロンプト二重管理 (9', "id: 'prompt-sync'"]) {
        assert.ok(!s.includes(ng), `もう存在しない作業を案内している: ${ng}`)
      }
    })
  }

  test('dm.js: 早見表への導線がある', () => {
    const s = read('dm.js')
    assert.ok(s.includes('/help/handoff'), 'ガイドから早見表へのリンクが無い')
    assert.ok((s.match(/<HandoffRef/g) || []).length >= 4, '<HandoffRef /> が少ない（定義 1 + 各章）')
  })

  test('dm.js: 語彙リストの件数は実物から数える（手で書かない）', () => {
    const s = read('dm.js')
    assert.ok(s.includes("from '../../lib/voiceVocabulary'"), '語彙リストを import していない')
    assert.ok(s.includes('COMMON_HOSPITALS.length'), '件数を直書きしている可能性がある')
  })
})
