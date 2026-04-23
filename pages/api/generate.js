// Anthropic API プロキシ
// 認証済みユーザーが任意の payload を Anthropic に投げられないよう、
// model と max_tokens をホワイトリスト/上限でチェックする。

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-5',
  'claude-opus-4-5',
  'claude-haiku-4-5',
]);

// 各インテークフォームで使われる最大値は 2000。
// 悪用時のコスト抑止のため十分な余裕を持たせて上限 4000 にキャップ。
const MAX_TOKENS_CAP = 4000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { model, max_tokens, messages } = req.body || {};

  // model ホワイトリスト検証
  if (!model || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: `model must be one of: ${[...ALLOWED_MODELS].join(', ')}` });
  }

  // max_tokens 検証
  if (typeof max_tokens !== 'number' || max_tokens <= 0 || max_tokens > MAX_TOKENS_CAP) {
    return res.status(400).json({ error: `max_tokens must be a positive number <= ${MAX_TOKENS_CAP}` });
  }

  // messages 必須
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages is required (non-empty array)' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, messages }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
