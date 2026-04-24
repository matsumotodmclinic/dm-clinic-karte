// アプリ玄関の共通PW検証 API
// 成功時: HMAC 署名付きトークンを karte_gate cookie にセット (30日)

import { timingSafeEqual } from 'crypto'
import { GATE_COOKIE_NAME, GATE_COOKIE_MAX_AGE, computeGateToken } from '../../lib/gateToken'

function buildCookieString(name, value, opts) {
  const parts = [`${name}=${value}`]
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.path) parts.push(`Path=${opts.path}`)
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure) parts.push('Secure')
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite === 'lax' ? 'Lax' : opts.sameSite}`)
  return parts.join('; ')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const gatePassword = process.env.APP_GATE_PASSWORD
  if (!gatePassword) {
    return res.status(500).json({ error: 'APP_GATE_PASSWORD が未設定です' })
  }

  const { password } = req.body || {}
  if (!password) {
    return res.status(400).json({ error: 'パスワードを入力してください' })
  }

  const expected = Buffer.from(gatePassword, 'utf8')
  const actual = Buffer.from(password, 'utf8')
  const same =
    expected.length === actual.length && timingSafeEqual(expected, actual)

  if (!same) {
    return res.status(401).json({ error: 'パスワードが違います' })
  }

  const token = computeGateToken()
  res.setHeader(
    'Set-Cookie',
    buildCookieString(GATE_COOKIE_NAME, token, {
      maxAge: GATE_COOKIE_MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  )

  return res.status(200).json({ ok: true })
}
