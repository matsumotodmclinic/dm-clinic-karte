import crypto from 'crypto';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { password } = req.body || {};
  const correct = process.env.APP_SHARED_PASSWORD;

  if (!correct) {
    return res.status(500).json({ error: 'パスワードが設定されていません' });
  }

  if (typeof password !== 'string' || password.length === 0) {
    return res.status(401).json({ error: 'Wrong password' });
  }

  // タイミング攻撃対策: 長さが異なる場合は常に偽を返すが、
  // crypto.timingSafeEqual が等長 Buffer を要求するため長さを揃えてから比較。
  const a = Buffer.from(password);
  const b = Buffer.from(correct);
  let isMatch = false;
  if (a.length === b.length) {
    isMatch = crypto.timingSafeEqual(a, b);
  } else {
    // 等長でない時もダミー比較を走らせて応答時間を揃える
    crypto.timingSafeEqual(b, b);
    isMatch = false;
  }

  if (isMatch) {
    // 認証成功 → cookie セット（7日間有効）
    // 本番(HTTPS)を前提に Secure を付与。開発 http://localhost は Vercel 本番で使わないので問題なし。
    const isProd = process.env.NODE_ENV === 'production';
    const cookieParts = [
      `app_auth=ok`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Strict`,
      `Max-Age=${60 * 60 * 24 * 7}`,
    ];
    if (isProd) cookieParts.push('Secure');
    res.setHeader('Set-Cookie', [cookieParts.join('; ')]);
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: 'Wrong password' });
}
