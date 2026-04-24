// Phase 2 Phase G + Gate: iron-session + 共通PWゲート
//
// 入場フロー:
//   1. 共通PWゲート (karte_gate cookie, 30日) を通過
//   2. iron-session のスタッフ認証 (dm_clinic_karte_session) を通過
//   3. ページアクセス許可
//
// 玄関PW (APP_GATE_PASSWORD) が未設定ならゲート機能は無効（後方互換）

import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'

const sessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD || '',
  cookieName: 'dm_clinic_karte_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
}

const GATE_COOKIE_NAME = 'karte_gate'

function base64urlDecode(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const base64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(base64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// Edge Runtime 対応の HMAC 検証（Web Crypto API のみ使用）
async function verifyGateCookie(token) {
  if (!token) return false
  const secret = process.env.SECRET_COOKIE_PASSWORD
  if (!secret || secret.length < 32) return false
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const expectedBuf = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode('dm-karte-gate-v1')
    )
    const expected = new Uint8Array(expectedBuf)
    const actual = base64urlDecode(token)
    if (actual.length !== expected.length) return false
    let diff = 0
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i]
    return diff === 0
  } catch {
    return false
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // ゲート自身のパスは素通り
  if (pathname === '/gate' || pathname === '/api/gate') {
    return NextResponse.next()
  }

  // APP_GATE_PASSWORD 未設定ならゲートは無効（後方互換）
  const gateEnabled = !!process.env.APP_GATE_PASSWORD
  if (gateEnabled) {
    const gateToken = request.cookies.get(GATE_COOKIE_NAME)?.value
    if (!(await verifyGateCookie(gateToken))) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Gate required' }, { status: 401 })
      }
      const url = request.nextUrl.clone()
      url.pathname = '/gate'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  // /auth と /api/auth は（ゲート通過後は）認証不要
  if (pathname.startsWith('/auth') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // セッション検証
  const response = NextResponse.next()
  const session = await getIronSession(request, response, sessionOptions)

  if (!session.user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
