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

import { UI } from './uiTokens'

/**
 * カテゴリ別テーマ（2026-08-29〜）。
 *
 * トップ画面と同じ 3 分類に揃えてある。色が担う意味は「どのカテゴリか」だけで、
 * フォームごとに色を変えない（移行前は 青/桃/橙/緑 の 4 系統に分かれていた）。
 *   青 = 糖尿病関連 / 緑 = 甲状腺関連 / 紺 = その他
 * 色そのものの正本は lib/uiTokens.js（勤怠アプリと同一値）。
 *
 * 入力欄と枠線は色を持たせず中立（白 + UI.border）にして、色の面積を抑える。
 */
const fromTone = (tone) => ({
  accent: tone.fg,
  mutedText: tone.fg,
  softBg: UI.surface,   // 未選択ボタンの面 = 白（枠線だけで表す）
  softBorder: tone.fg,  // 未選択ボタンの枠 = カテゴリ色。グレーにすると薄くて選択肢に見えない
  boxBg: UI.surfaceAlt,
  boxBorder: UI.border,
  inpBg: UI.surface,
  inpBorder: UI.border,
})

export const FORM_THEMES = {
  // 糖尿病関連: DM基本 / 1型 / 小児1型 / 妊娠糖尿病 / 反応性低血糖
  dm: fromTone(UI.primary),
  // 甲状腺関連: 甲状腺 6種
  thyroid: fromTone(UI.success),
  // その他: 高血圧・脂質異常症 / 内分泌 / SAS
  other: fromTone(UI.fixed),
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

  // 未選択は「面を持たせず枠線だけ」にする（院長 2026-08-29）。
  // 選択肢が多い画面で淡色の面が並ぶと賑やかに見えるため。
  //
  // ★ 第2引数の color は **役割**を表す（uiTokens の値を渡す）。
  //   未選択でも枠線と文字にこの色を使うので、
  //   「選択肢（青）」と「＋追加などのアクション（グレー）」「削除（赤）」が見分けられる。
  //   任意の hex を渡すと色が増えて散らかるので、必ず UI.*.fg を使うこと。
  // 枠線は選択・未選択とも 1px にして、押した時に幅がずれないようにしている。
  const btn = (active, color = t.accent, x = {}) => ({
    padding: '8px 14px',
    borderRadius: 6,
    border: `1px solid ${color}`,
    background: active ? color : t.softBg,
    color: active ? '#fff' : color,
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
