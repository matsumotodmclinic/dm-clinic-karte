export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { form_data, form_type } = req.body

  if (!form_data) return res.status(400).json({ error: 'form_data is required' })

  const getCurrentMonth = () => {
    const now = new Date()
    const reiwaYear = now.getFullYear() - 2018
    return `R${reiwaYear}.${now.getMonth() + 1}`
  }

  const prompt = `あなたはまつもと糖尿病クリニックの電子カルテ記載AIです。
以下の問診データをもとに、カルテ記載文を生成してください。

【フォーマット種別】${form_type || 'DM基本'}
【現在日時】${getCurrentMonth()}
【問診データ】
${JSON.stringify(form_data, null, 2)}

【ルール】
- 該当しない項目は省略する
- フォーマット記号（＃【】□♯）を使用する
- 簡潔に記載する
- 日本語で出力する`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const karte = data.content?.[0]?.text || '生成に失敗しました'
    return res.status(200).json({ karte })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
