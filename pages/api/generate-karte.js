// カルテ生成 API（経路B: 詳細画面の「🔄 再生成」）
//
// 2026-09-07: 「AI に全文を書かせる」方式をやめ、lib/buildKarteTemplate.js が組み立て、
// 音声入力があるときだけ「統合」だけを AI に頼む形にした（経路A と同じ lib を呼ぶ）。
// ここは 入力検証 → generateKarteText() だけを持つ。
//
// 旧方式（?legacy=1 = AI に全文を書かせる lib/buildKartePrompt.js）は 2026-10-15 に削除した。
import { generateKarteText, MERGE_MAX_TOKENS, MERGE_MODEL } from '../../lib/generateKarte'
import { TEMPLATE_FORM_TYPES as ALLOWED_FORM_TYPES } from '../../lib/buildKarteTemplate'

// form_data のサイズ上限(JSON 文字列のバイト数)。
// 通常の問診入力は 20KB 程度で収まる想定、余裕を持って 100KB。
// 巨大ペイロード送信による Anthropic API コスト膨張を防ぐ。
const MAX_FORM_DATA_SIZE = 100 * 1024

async function callAnthropic(prompt, max_tokens) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MERGE_MODEL,
      max_tokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await response.json()
  return data.content?.[0]?.text || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { form_data, form_type } = req.body
  if (!form_data) return res.status(400).json({ error: 'form_data is required' })

  // form_type ホワイトリスト検証
  if (!form_type || !ALLOWED_FORM_TYPES.has(form_type)) {
    return res.status(400).json({
      error: `form_type must be one of: ${[...ALLOWED_FORM_TYPES].join(', ')}`,
    })
  }

  // form_data は object 型であること(string 等の不正型を拒否)
  if (typeof form_data !== 'object' || Array.isArray(form_data)) {
    return res.status(400).json({ error: 'form_data must be an object' })
  }

  // form_data のサイズ検証(巨大ペイロード拒否)
  const formDataSize = JSON.stringify(form_data).length
  if (formDataSize > MAX_FORM_DATA_SIZE) {
    return res.status(413).json({
      error: `form_data too large (${formDataSize} bytes, max ${MAX_FORM_DATA_SIZE})`,
    })
  }

  // 音声入力が無ければ AI は 1 回も呼ばれない。AI が落ちても JS 素組みが返る。
  try {
    const karte = await generateKarteText(form_type, form_data, p => callAnthropic(p, MERGE_MAX_TOKENS))
    if (karte == null) return res.status(400).json({ error: `未対応のform_type: ${form_type}` })
    return res.status(200).json({ karte })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
