// lib/formStyles.js への集約が「見た目を 1px も変えない」ことを機械的に確認する。
//
// 移行前は inp/lbl/btn/sBox が 9 つの *IntakeTool.js に直書きされていた。
// このスクリプトは **移行前の実装をここに写経したもの** と、新しい makeFormStyles() の
// 出力オブジェクトを、引数の総当たりで deep-equal 比較する。
//
// 実行: node scripts/verify-form-styles.mjs
// 集約が済んだ後も回帰チェックとして残す（テーマ色を変えたら当然落ちるので、
// 意図的に色を変える段階ではこのファイルの BEFORE も一緒に更新すること）。

import assert from 'node:assert/strict'
import { makeFormStyles, FORM_THEMES } from '../lib/formStyles.js'

// ───────────────────────────────────────────────
// 移行前の実装（git 履歴からそのまま写経・触らないこと）
// ───────────────────────────────────────────────
const BEFORE = {
  // DM基本 / 1型 / 小児1型 / 高血圧・脂質異常症 / SAS / 内分泌（6ファイルで完全一致）
  blue: {
    inp: (x = {}) => ({ padding: "9px 12px", border: "1.5px solid #d0dff5", borderRadius: 8, fontSize: 14, color: "#1a2a3a", background: "#f7faff", outline: "none", boxSizing: "border-box", fontFamily: "inherit", width: "100%", ...x }),
    lbl: (x = {}) => ({ display: "block", fontSize: 12, fontWeight: 700, color: "#1a5fa8", marginBottom: 5, letterSpacing: "0.03em", ...x }),
    btn: (active, color = "#1a5fa8", x = {}) => ({ padding: "8px 14px", borderRadius: 8, border: active ? `2px solid ${color}` : "2px solid #d0dff5", background: active ? color : "#f7faff", color: active ? "#fff" : "#5580a8", fontWeight: 700, fontSize: 13, cursor: "pointer", margin: "3px 4px 3px 0", ...x }),
    sBox: (x = {}) => ({ background: "#f7faff", border: "1.5px solid #e0ecff", borderRadius: 10, padding: "14px 16px", marginBottom: 14, ...x }),
  },
  // 妊娠糖尿病
  pink: {
    inp: (x = {}) => ({ padding: "9px 12px", border: "1.5px solid #d0dff5", borderRadius: 8, fontSize: 14, color: "#1a2a3a", background: "#f7faff", outline: "none", boxSizing: "border-box", fontFamily: "inherit", width: "100%", ...x }),
    lbl: (x = {}) => ({ display: "block", fontSize: 12, fontWeight: 700, color: "#c05c8a", marginBottom: 5, letterSpacing: "0.03em", ...x }),
    btn: (active, color = "#c05c8a", x = {}) => ({ padding: "8px 14px", borderRadius: 8, border: active ? `2px solid ${color}` : "2px solid #f0d0e0", background: active ? color : "#fff7fb", color: active ? "#fff" : "#9a5070", fontWeight: 700, fontSize: 13, cursor: "pointer", margin: "3px 4px 3px 0", ...x }),
    sBox: (x = {}) => ({ background: "#fff7fb", border: "1.5px solid #f0d0e0", borderRadius: 10, padding: "14px 16px", marginBottom: 14, ...x }),
  },
  // 反応性低血糖
  amber: {
    inp: (x = {}) => ({ padding: "9px 12px", border: "1.5px solid #d0dff5", borderRadius: 8, fontSize: 14, color: "#1a2a3a", background: "#f7faff", outline: "none", boxSizing: "border-box", fontFamily: "inherit", width: "100%", ...x }),
    lbl: (x = {}) => ({ display: "block", fontSize: 12, fontWeight: 700, color: "#b45309", marginBottom: 5, letterSpacing: "0.03em", ...x }),
    btn: (active, color = "#b45309", x = {}) => ({ padding: "8px 14px", borderRadius: 8, border: active ? `2px solid ${color}` : "2px solid #f0ddc0", background: active ? color : "#fffbf5", color: active ? "#fff" : "#92400e", fontWeight: 700, fontSize: 13, cursor: "pointer", margin: "3px 4px 3px 0", ...x }),
    sBox: (x = {}) => ({ background: "#fffbf5", border: "1.5px solid #f0ddc0", borderRadius: 10, padding: "14px 16px", marginBottom: 14, ...x }),
  },
  // 甲状腺 6種（TC = "#0d7d6a"）
  teal: {
    inp: (x = {}) => ({ padding: "9px 12px", border: "1.5px solid #a7f3d0", borderRadius: 8, fontSize: 14, color: "#1a2a3a", background: "#f0fdf9", outline: "none", boxSizing: "border-box", fontFamily: "inherit", width: "100%", ...x }),
    lbl: (x = {}) => ({ display: "block", fontSize: 12, fontWeight: 700, color: "#0d7d6a", marginBottom: 5, letterSpacing: "0.03em", ...x }),
    btn: (active, color = "#0d7d6a", x = {}) => ({ padding: "8px 14px", borderRadius: 8, border: active ? `2px solid ${color}` : "2px solid #a7f3d0", background: active ? color : "#f0fdf9", color: active ? "#fff" : "#2d8a78", fontWeight: 700, fontSize: 13, cursor: "pointer", margin: "3px 4px 3px 0", ...x }),
    sBox: (x = {}) => ({ background: "#f0fdf9", border: "1.5px solid #a7f3d0", borderRadius: 10, padding: "14px 16px", marginBottom: 14, ...x }),
  },
}

// ───────────────────────────────────────────────
// 引数の総当たり
// ───────────────────────────────────────────────
const OVERRIDES = [
  undefined,
  {},
  { marginBottom: 20 },
  { fontSize: 16, color: '#123456' },
  { padding: '2px 3px', background: 'red', border: 'none' },  // 全部上書き
]
const BTN_COLORS = [undefined, '#c53030', '#0f9668', '#000']
const BTN_ACTIVE = [true, false, undefined, 0, 1, '']

let checks = 0
const fail = []

for (const [themeName, before] of Object.entries(BEFORE)) {
  const after = makeFormStyles(FORM_THEMES[themeName])

  for (const fn of ['inp', 'lbl', 'sBox']) {
    for (const ov of OVERRIDES) {
      const a = before[fn](ov)
      const b = after[fn](ov)
      checks++
      try { assert.deepEqual(b, a) }
      catch { fail.push(`${themeName}.${fn}(${JSON.stringify(ov)})\n    before=${JSON.stringify(a)}\n    after =${JSON.stringify(b)}`) }
    }
  }

  for (const active of BTN_ACTIVE) {
    for (const color of BTN_COLORS) {
      for (const ov of OVERRIDES) {
        const a = before.btn(active, color, ov)
        const b = after.btn(active, color, ov)
        checks++
        try { assert.deepEqual(b, a) }
        catch { fail.push(`${themeName}.btn(${JSON.stringify(active)}, ${JSON.stringify(color)}, ${JSON.stringify(ov)})\n    before=${JSON.stringify(a)}\n    after =${JSON.stringify(b)}`) }
      }
    }
  }
}

if (fail.length) {
  console.error(`\n❌ スタイルが変化しています (${fail.length}/${checks} 件)\n`)
  for (const f of fail.slice(0, 10)) console.error('  ' + f + '\n')
  if (fail.length > 10) console.error(`  ...ほか ${fail.length - 10} 件`)
  process.exit(1)
}

console.log(`✅ スタイル一致 ${checks} 件（移行前の実装と完全に同一。見た目は変わらない）`)
