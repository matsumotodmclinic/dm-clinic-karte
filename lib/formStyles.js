// 問診フォーム共通のスタイル関数。
//
// ■ なぜ作ったか
// inp() / lbl() / btn() / sBox() が 9 つの *IntakeTool.js に重複定義されていた。
// 調べたところ **構造は完全に同一で、違いはテーマ色 1 系統だけ** だったので、
// テーマを引数に取る 1 つの実装に集約した。
// （この状態で全画面のデザイン変更をすると 9 箇所を手で直すことになるため、先に集約する）
//
// ■ 重要: この切り出しは「見た目を 1px も変えない」ことが前提
// 各フォームのテーマ色は移行時点の値をそのまま保持している。
// 色の統一（青=糖尿病 / 緑=甲状腺 / 紺=その他 に寄せる）は次の段階で行う。
// → 色トークンの正本は lib/uiTokens.js
//
// ■ 対象外
// components/{DmDiffEditor,DmDxNoteEditor,VoiceMemoSection}.js は
// 詳細画面用でサイズ体系が一回り小さく、互いにも微差があるためここには含めない。

/** フォーム別テーマ。移行前の各ファイルの値をそのまま写したもの */
export const FORM_THEMES = {
  // DM基本 / 1型 / 小児1型 / 高血圧・脂質異常症 / SAS / 内分泌
  blue: {
    accent: '#1a5fa8',
    mutedText: '#5580a8',
    softBg: '#f7faff',
    softBorder: '#d0dff5',
    boxBg: '#f7faff',
    boxBorder: '#e0ecff',
    inpBg: '#f7faff',
    inpBorder: '#d0dff5',
  },
  // 妊娠糖尿病
  pink: {
    accent: '#c05c8a',
    mutedText: '#9a5070',
    softBg: '#fff7fb',
    softBorder: '#f0d0e0',
    boxBg: '#fff7fb',
    boxBorder: '#f0d0e0',
    inpBg: '#f7faff',   // ← 入力欄だけ青のまま（移行前の実装がそうだった）
    inpBorder: '#d0dff5',
  },
  // 反応性低血糖
  amber: {
    accent: '#b45309',
    mutedText: '#92400e',
    softBg: '#fffbf5',
    softBorder: '#f0ddc0',
    boxBg: '#fffbf5',
    boxBorder: '#f0ddc0',
    inpBg: '#f7faff',   // ← 同上
    inpBorder: '#d0dff5',
  },
  // 甲状腺 6種
  teal: {
    accent: '#0d7d6a',
    mutedText: '#2d8a78',
    softBg: '#f0fdf9',
    softBorder: '#a7f3d0',
    boxBg: '#f0fdf9',
    boxBorder: '#a7f3d0',
    inpBg: '#f0fdf9',
    inpBorder: '#a7f3d0',
  },
}

/**
 * テーマから inp / lbl / btn / sBox を作る。
 * 使い方: `const { inp, lbl, btn, sBox } = makeFormStyles(FORM_THEMES.blue)`
 */
export function makeFormStyles(theme) {
  const t = theme || FORM_THEMES.blue

  const inp = (x = {}) => ({
    padding: '9px 12px',
    border: `1.5px solid ${t.inpBorder}`,
    borderRadius: 8,
    fontSize: 14,
    color: '#1a2a3a',
    background: t.inpBg,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    width: '100%',
    ...x,
  })

  const lbl = (x = {}) => ({
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: t.accent,
    marginBottom: 5,
    letterSpacing: '0.03em',
    ...x,
  })

  const btn = (active, color = t.accent, x = {}) => ({
    padding: '8px 14px',
    borderRadius: 8,
    border: active ? `2px solid ${color}` : `2px solid ${t.softBorder}`,
    background: active ? color : t.softBg,
    color: active ? '#fff' : t.mutedText,
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    margin: '3px 4px 3px 0',
    ...x,
  })

  const sBox = (x = {}) => ({
    background: t.boxBg,
    border: `1.5px solid ${t.boxBorder}`,
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 14,
    ...x,
  })

  return { inp, lbl, btn, sBox }
}
