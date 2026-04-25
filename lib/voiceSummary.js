// 患者の自由発話を Claude で医療カルテ用に整形する
//
// 設計書: docs/design/voice-input-summary-plan.md
//
// プロンプト二重管理ルール:
//   - 本ファイルは「クライアント側で生成プレビューを出す/送信用 prompt を組み立てる」役割
//   - サーバー側 generate-karte.js の現病歴セクションは voiceMemo.aiSummary を挿入する形で対応
//   - プロンプト本体はコンポーネント側で組んで /api/generate に送る(既存の Anthropic プロキシ)

const SUMMARY_PROMPT_TEMPLATE = (transcript, formData, formType) => {
  const reason = formData?.reason || {}
  const formContext = [
    reason.type ? `受診理由: ${reason.type}` : '',
    reason.referralFrom ? `紹介元病院: ${reason.referralFrom}` : '',
    reason.referralDept ? `紹介元科: ${reason.referralDept}` : '',
    reason.referralDetail ? `紹介の経緯メモ: ${reason.referralDetail}` : '',
    reason.transferFrom ? `転医元: ${reason.transferFrom}` : '',
    reason.transferDetail ? `転医の経緯メモ: ${reason.transferDetail}` : '',
  ].filter(Boolean).join('\n')

  return `あなたは医療カルテ整形 AI です。患者が自由に話した経緯を、医療カルテの「現病歴」セクションとして整形してください。

【ルール】
- 1〜3文程度に簡潔にまとめる(冗長にしない)
- 医療的な要点(発症時期、症状、治療歴、紹介経緯)を抽出
- 患者の主観表現(「すごく」「めちゃくちゃ」「やばい」等)は省略
- 専門用語に置換可能な部分は置換(例: 血糖が悪い → 血糖コントロール不良、太った → 体重増加)
- 推測や想像で書かない。事実のみ
- フォームの受診理由・紹介元情報と整合させる
- 末尾に句点「。」を付ける
- 「。」「、」以外の記号(顔文字・絵文字)は除く
- 出力テキストのみを返す(前置き・後書き・改行不要)

【受診理由・フォーム情報(参考)】
${formContext || '(未入力)'}

【患者発話(音声認識テキスト、誤認識を含む可能性あり)】
${transcript}

【出力】
1〜3文の現病歴テキスト(プレーンテキスト):`
}

/**
 * 自由発話テキストを医療カルテ用に整形
 * @param {string} transcript - 音声認識した生テキスト
 * @param {object} formData - フォームの state(参考情報として使用)
 * @param {string} formType - 'dm' | 't1d' | 'hthl' | 'gdm' | 'rh' | 'ped-t1d'
 * @returns {Promise<{ ok: true, summary: string } | { ok: false, error: string }>}
 */
export async function summarizeForKarte(transcript, formData, formType) {
  if (!transcript || transcript.trim().length === 0) {
    return { ok: false, error: '発話テキストが空です' }
  }
  if (transcript.length > 4000) {
    return { ok: false, error: '発話テキストが長すぎます(4000文字以内にしてください)' }
  }

  const prompt = SUMMARY_PROMPT_TEMPLATE(transcript, formData, formType)

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      return { ok: false, error: `API エラー (${res.status})` }
    }

    const json = await res.json()
    const text = json?.content?.[0]?.text?.trim() || ''
    if (!text) {
      return { ok: false, error: 'AI 応答が空でした。再度お試しください。' }
    }
    return { ok: true, summary: text }
  } catch (e) {
    return { ok: false, error: 'ネットワークエラー: ' + (e?.message || '不明') }
  }
}
