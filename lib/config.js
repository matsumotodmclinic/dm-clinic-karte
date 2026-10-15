// クリニックアプリ 共通設定
//
// ★使う Claude のモデル名はここ 1 箇所だけ（2026-10-15 に統一。それまで 5 箇所に直書きで、
//   この定数は誰からも参照されていなかった = CLAUDE.md 既知バグ⑥）。
//   参照: lib/generateKarte.js（カルテ統合）/ lib/voiceSummary.js（音声整形）/
//         pages/api/generate.js（許可リスト）/ scripts/eval/run.mjs（eval --ai）
export const CLAUDE_MODEL = 'claude-sonnet-4-5'
