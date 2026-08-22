// カルテ生成 API（経路B: 詳細画面の「🔄 再生成」）
//
// プロンプト組み立ては lib/buildKartePrompt.js に切り出し済み。
// ここは 入力検証 → buildKartePrompt() → Anthropic 呼び出し → 整形 だけを持つ。
import { buildKartePrompt, UnsupportedFormTypeError, ALLOWED_FORM_TYPES } from '../../lib/buildKartePrompt'

// form_data のサイズ上限(JSON 文字列のバイト数)。
// 通常の問診入力は 20KB 程度で収まる想定、余裕を持って 100KB。
// 巨大ペイロード送信による Anthropic API コスト膨張を防ぐ。
const MAX_FORM_DATA_SIZE = 100 * 1024

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

  let prompt, max_tokens
  try {
    ;({ prompt, max_tokens } = buildKartePrompt(form_type, form_data))
  } catch (e) {
    if (e instanceof UnsupportedFormTypeError) {
      return res.status(400).json({ error: e.message })
    }
    return res.status(500).json({ error: e.message })
  }
  // ── API呼び出し ──────────────────────────────────────

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const rawKarte = data.content?.[0]?.text || '生成に失敗しました'
    // 連続する空行を最大1行に圧縮（条件付き行が空展開された箇所のクリーンアップ、甲状腺フォームで特に効果）
    const karte = rawKarte
      .split('\n').map(l => l.replace(/[ 　\t]+$/, '')).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return res.status(200).json({ karte })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
