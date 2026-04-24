// Phase 2 Phase G: iron-session による middleware 認証
//
// kinkan-app 認証サーバーで認証済みの session.user が無ければ /auth にリダイレクト。
// 旧仕様（app_auth=ok 固定クッキー）は廃止。

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

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // /auth と /api/auth は認証不要
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
