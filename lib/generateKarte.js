// カルテ記載文の生成（経路A: フォーム送信時 / 経路B: 詳細画面の再生成 の共通実装）。
//
// 2026-09-07 に「AI に全文を書かせる」方式から「JS が組み立て、統合だけ AI に頼む」方式へ
// 全 14 フォームを切り替えた。組み立ては lib/buildKarteTemplate.js の 1 箇所だけ。
//
//   ① 音声入力（現病歴 / 既往歴）が 1 つも無ければ **AI を呼ばない**。
//      カルテは form_data から決定論的に組み上がる（速い・無料・欠落が起きない）。
//   ② 音声入力があるときだけ「受診理由サマリーの統合」「♯既往のマージ」を AI に頼む。
//      プロンプトは全文生成の約 1/10。
//   ③ AI が落ちても・壊れた返答でも、JS 素組みのカルテを必ず返す（生成できない状態を作らない）。
//
// callAI は環境ごとに違うので呼び出し側から渡す:
//   経路A（ブラウザ）… /api/generate プロキシへ fetch
//   経路B（サーバー）… Anthropic API を直接叩く

import { buildKarteTemplate, buildMergePrompt, parseMergeResponse } from './buildKarteTemplate.js'

// 統合の返答は JSON 1 個（受診理由 1〜2 行 ＋ ♯既往 数行）なので 600 で足りる
export const MERGE_MAX_TOKENS = 600
export const MERGE_MODEL = 'claude-sonnet-4-5'

export async function generateKarteText(form_type, form_data, callAI) {
  const prompt = buildMergePrompt(form_type, form_data)

  let merged = null
  if (prompt && typeof callAI === 'function') {
    try {
      merged = parseMergeResponse(await callAI(prompt))
    } catch {
      // 通信エラー・タイムアウト等。JS 素組みにフォールバックする
      merged = null
    }
  }

  return buildKarteTemplate(form_type, form_data, { merged })
}

// 経路A（ブラウザ）用の callAI。/api/generate プロキシ経由で Anthropic を呼ぶ。
export async function callGenerateApi(prompt) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MERGE_MODEL,
      max_tokens: MERGE_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const json = await res.json()
  return json.content?.[0]?.text || ''
}
