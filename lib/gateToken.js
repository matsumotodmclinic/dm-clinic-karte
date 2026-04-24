// ゲート cookie のトークン計算・検証ヘルパー (Node runtime, API routes 用)
// middleware は Edge Runtime のため Web Crypto で別実装する。
//
// 仕組み: HMAC-SHA256(SECRET_COOKIE_PASSWORD, "dm-karte-gate-v1") → base64url
//   - 秘密鍵が変わらない限り同じトークンが生成される
//   - 秘密鍵を知らない攻撃者は正しいトークンを作れない

import { createHmac, timingSafeEqual } from 'crypto'

export const GATE_COOKIE_NAME = 'karte_gate'
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30日

function getSecret() {
  const secret = process.env.SECRET_COOKIE_PASSWORD
  if (!secret || secret.length < 32) {
    throw new Error('SECRET_COOKIE_PASSWORD is not configured (needs >= 32 chars)')
  }
  return secret
}

// cookie 署名には秘密鍵 + 現在の APP_GATE_PASSWORD を入れる。
// これにより APP_GATE_PASSWORD を変えると既発行の cookie が自動で失効する。
export function computeGateToken() {
  const gatePw = process.env.APP_GATE_PASSWORD || ''
  const h = createHmac('sha256', getSecret())
    .update('dm-karte-gate-v1')
    .update('|')
    .update(gatePw)
    .digest()
  return h.toString('base64url')
}

export function verifyGateToken(token) {
  if (!token) return false
  try {
    const expected = Buffer.from(computeGateToken(), 'base64url')
    const actual = Buffer.from(token, 'base64url')
    if (actual.length !== expected.length) return false
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
