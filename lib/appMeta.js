// アプリ名・PWA の色の正本（2026-09-10）。
// pages/_document.js（head）/ pages/_app.js（title）/ pages/api/pwa-manifest.js（manifest）が共有する。
// 勤怠アプリ (KartePlus 勤怠) と同じ命名・同じ値。

/** 製品名。施設名は入れない（勤怠と同じ方針: 他院で使っても「まつもと」が出ないように） */
export const APP_NAME = 'KartePlus 問診'
/** アプリ UI のツールバー色（Android の標準表示モードで上部バーに使われる）。勤怠と同値 */
export const THEME_COLOR = '#1976d2'
/** 起動スプラッシュの背景。public/icon.svg の背景と同色にして地続きに見せる。勤怠と同値 */
export const SPLASH_BACKGROUND = '#0E4C92'
