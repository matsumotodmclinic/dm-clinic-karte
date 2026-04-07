export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { password } = req.body;
  const correct = process.env.APP_SHARED_PASSWORD;

  if (!correct) {
    return res.status(500).json({ error: 'パスワードが設定されていません' });
  }

  if (password === correct) {
    // 認証成功 → cookieをセット（7日間有効）
    res.setHeader('Set-Cookie', [
      `app_auth=ok; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 7}`,
    ]);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Wrong password' });
}　
