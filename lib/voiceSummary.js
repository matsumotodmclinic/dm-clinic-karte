// 患者の自由発話を Claude で医療カルテ用に整形する
//
// 設計書: docs/design/voice-input-summary-plan.md
//
// 2モード:
//   - 'currentIllness' : 現病歴(受診理由・経緯)の整形 (summarizeForKarte)
//   - 'pastHistory'    : 既往歴の整形 (summarizeForPastHistory)
//
// プロンプト二重管理ルール:
//   - 本ファイルは「クライアント側で生成プレビューを出す/送信用 prompt を組み立てる」役割
//   - サーバー側 generate-karte.js の各セクションは aiSummary を挿入する形で対応
//   - プロンプト本体はコンポーネント側で組んで /api/generate に送る(既存の Anthropic プロキシ)

// 今日の日付を和暦で返す（プロンプトに「○年前」を自動計算してもらうため）
function todayWareki() {
  const now = new Date()
  const y = now.getFullYear()
  // 令和元年 = 2019
  const reiwa = y - 2018
  const m = now.getMonth() + 1
  const d = now.getDate()
  return { yLabel: `R${reiwa}（令和${reiwa}年${m}月${d}日）`, reiwa, year: y }
}

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

  const today = todayWareki()
  return `あなたは医療カルテ整形 AI です。患者が自由に話した経緯を、医療カルテの「現病歴」セクションとして整形してください。

【今日の日付】${today.yLabel}
【ルール】
- 1〜3文程度に簡潔にまとめる(冗長にしない)
- 医療的な要点(発症時期、症状、治療歴、紹介経緯)を抽出
- 患者の主観表現(「すごく」「めちゃくちゃ」「やばい」等)は省略
- 専門用語に置換可能な部分は置換(例: 血糖が悪い → 血糖コントロール不良、太った → 体重増加)
- 推測や想像で書かない。事実のみ
- フォームの受診理由・紹介元情報と整合させる
- 末尾に句点「。」を付ける
- 「。」「、」以外の記号(顔文字・絵文字)は除く
- 時期の表現は和暦（H8、R5、平成8年、令和5年 など）で統一。西暦・年齢・「○年前」「○ヶ月前」は絶対に使わない
- 「○年前」と話されたら、今日（${today.yLabel}）から自動計算して和暦に変換すること（例: 「5年前」→ R${today.reiwa - 5}、「3ヶ月前」→ R${today.reiwa}に該当月）
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

// 既往歴の自由発話を整形するためのプロンプト
const PAST_HISTORY_PROMPT_TEMPLATE = (transcript) => {
  const today = todayWareki()
  return `あなたは医療カルテ整形 AI です。事務スタッフまたは患者本人が口頭で述べた既往歴を、医療カルテの「既往歴」セクションとして整形してください。

【今日の日付】${today.yLabel}
【ルール】
- 既往疾患を ♯病名（時期・治療した病院・現在の通院先・内服薬）の形式で列挙
- 1行1疾患、改行で区切る
- 時期は和暦（H8、R5、平成8年、令和5年 など）で統一。西暦・年齢・「○年前」「○ヶ月前」は絶対に使わない
- 「○年前」と話されたら、今日（${today.yLabel}）から自動計算して和暦に変換すること（令和以前は平成として記載。例: 今日がR8なら「5年前」→ R3、「10年前」→ H30、「15年前」→ H25）
- 病院名は判明している範囲で記載、不明な部分は省略
- 内服薬は判明している範囲で記載
- 該当しない情報は記載しない(「不明」など埋めない)
- 推測で情報を補完しない。話された内容のみを構造化
- 主観表現(「すごく」「あんまり」等)は省略
- 既往歴がない場合は「特記すべき既往歴なし」と1行のみ出力
- 出力テキストのみを返す(前置き・後書き・装飾的な見出し不要)

【発話内容(音声認識テキスト、誤認識を含む可能性あり)】
${transcript}

【出力例(参考)】
♯高血圧（H28から、○○内科でアムロジピン 5mg 内服中）
♯脂質異常症（R3から、当院通院前は△△クリニック、ロスバスタチン 2.5mg）
♯胃癌（H28、□□病院で胃部分切除術、現在経過観察、内服なし）

【出力】`
}

/**
 * 自由発話を既往歴形式に整形
 * @param {string} transcript - 音声認識した生テキスト
 * @returns {Promise<{ ok: true, summary: string } | { ok: false, error: string }>}
 */
export async function summarizeForPastHistory(transcript) {
  if (!transcript || transcript.trim().length === 0) {
    return { ok: false, error: '発話テキストが空です' }
  }
  if (transcript.length > 4000) {
    return { ok: false, error: '発話テキストが長すぎます(4000文字以内にしてください)' }
  }

  const prompt = PAST_HISTORY_PROMPT_TEMPLATE(transcript)

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
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
