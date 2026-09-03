// 問診フォーム共通スタイル（lib/formStyles.js）のスナップショット検査。
//
// ■ 経緯
// もともとは「9ファイルに直書きされていた inp/lbl/btn/sBox を集約しても
// 見た目が 1px も変わらない」ことを証明するためのスクリプトだった（540件一致で証明済み）。
// その後 2026-08-29 に意図的にデザインを変えた（勤怠アプリと作法を統一）ため、
// 「旧実装と一致」の検査は役目を終えた。
//
// ■ 現在の役割
// **今の意図した値**を台帳として持ち、うっかり変わったら落とす回帰チェック。
// 意図的にデザインを変えたときは EXPECT も一緒に更新する（差分を目視してからコミットする）。
//
// 実行: node scripts/verify-form-styles.mjs

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { makeFormStyles, FORM_THEMES } from '../lib/formStyles.js'
import { UI } from '../lib/uiTokens.js'

// ───────────────────────────────────────────────
// 期待値（2026-08-29 のデザイン確定時点）
// ───────────────────────────────────────────────
const EXPECT = {
  inp: (t) => ({
    padding: '9px 12px', border: `1px solid ${UI.border}`, borderRadius: 8, fontSize: 14,
    color: '#1a2a3a', background: UI.surface, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit', width: '100%',
  }),
  lbl: (t) => ({
    display: 'block', fontSize: 12, fontWeight: 700, color: t.fg, marginBottom: 5, letterSpacing: '0.03em',
  }),
  sBox: (t) => ({
    background: UI.surfaceAlt, border: `1px solid ${UI.border}`, borderRadius: 10,
    padding: '14px 16px', marginBottom: 14,
  }),
  // 未選択 = 白い面 + 役割色の枠線と文字 / 選択済み = 役割色で塗りつぶし
  btn: (t, active, color) => {
    const c = color === undefined ? t.fg : color
    return {
      padding: '8px 14px', borderRadius: 6, border: `1px solid ${c}`,
      background: active ? c : UI.surface, color: active ? '#fff' : c,
      fontWeight: 700, fontSize: 13, cursor: 'pointer', margin: '3px 4px 3px 0',
    }
  },
}

// カテゴリ → uiTokens のトーン
const THEMES = {
  dm: UI.primary,        // 糖尿病関連
  thyroid: UI.success,   // 甲状腺関連
  other: UI.fixed,       // その他
}

const OVERRIDES = [undefined, {}, { marginBottom: 20 }, { fontSize: 16, color: '#123456' }]
const BTN_COLORS = [undefined, UI.danger.fg, UI.neutral.fg]
const BTN_ACTIVE = [true, false]

let checks = 0
const fail = []
const check = (label, actual, expected) => {
  checks++
  try { assert.deepEqual(actual, expected) }
  catch {
    fail.push(`${label}\n    期待=${JSON.stringify(expected)}\n    実際=${JSON.stringify(actual)}`)
  }
}

for (const [name, tone] of Object.entries(THEMES)) {
  const s = makeFormStyles(FORM_THEMES[name])

  for (const ov of OVERRIDES) {
    check(`${name}.inp(${JSON.stringify(ov)})`,  s.inp(ov),  { ...EXPECT.inp(tone),  ...(ov || {}) })
    check(`${name}.lbl(${JSON.stringify(ov)})`,  s.lbl(ov),  { ...EXPECT.lbl(tone),  ...(ov || {}) })
    check(`${name}.sBox(${JSON.stringify(ov)})`, s.sBox(ov), { ...EXPECT.sBox(tone), ...(ov || {}) })
  }

  for (const active of BTN_ACTIVE) {
    for (const color of BTN_COLORS) {
      for (const ov of OVERRIDES) {
        check(`${name}.btn(${active}, ${color}, ${JSON.stringify(ov)})`,
              s.btn(active, color, ov),
              { ...EXPECT.btn(tone, active, color), ...(ov || {}) })
      }
    }
  }
}

// 色数が増えていないことも見る（虹色に戻るのを防ぐ）
const TONES_USED = new Set(Object.values(THEMES).map(t => t.fg))
check('カテゴリ色は3系統', TONES_USED.size, 3)

// ───────────────────────────────────────────────
// /help ・ /handbook に直書きの色が戻らないことの検査（2026-09-03 追加）
// ───────────────────────────────────────────────
// ガイド 4 ページ + 共通部品 HelpGuide.js は lib/uiTokens.js のトークンだけで色を決める。
// 直書き hex を 1 つでも書くと落ちる（コメントと、色の説明として本文に書いた hex は除く）。

const GUIDE_FILES = [
  'components/HelpGuide.js',
  'pages/help/index.js',
  'pages/help/dm.js',
  'pages/handbook/index.js',
  'pages/handbook/hypoglycemia.js',
]

// 本文テキストとして書いてある hex（音声入力欄の色の説明）。style ではないので許可する。
const HEX_IN_PROSE = new Set(['#fff7e6', '#eef4fc'])

const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\/[^\n'"`]*$/gm, '')

for (const rel of GUIDE_FILES) {
  const hits = (stripComments(readFileSync(new URL('../' + rel, import.meta.url), 'utf8'))
    .match(/#[0-9a-fA-F]{3,8}\b/g) || [])
    .map((h) => h.toLowerCase())
    .filter((h) => !HEX_IN_PROSE.has(h))
  check(`${rel} に直書きの色がない`, hits.join(' '), '')
}

if (fail.length) {
  console.error(`\n❌ スタイルが期待値と違います (${fail.length}/${checks} 件)\n`)
  for (const f of fail.slice(0, 8)) console.error('  ' + f + '\n')
  if (fail.length > 8) console.error(`  ...ほか ${fail.length - 8} 件`)
  console.error('意図した変更なら、このファイルの EXPECT も更新してください。')
  process.exit(1)
}

console.log(`✅ スタイル ${checks} 件が期待値どおり（カテゴリ色3系統・未選択は白面+枠線）`)
