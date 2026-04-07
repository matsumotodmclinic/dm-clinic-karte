import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // /auth は認証ページなので素通り
  if (pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // cookieでログイン確認
  const auth = request.cookies.get('app_auth');
  if (auth?.value === 'ok') {
    return NextResponse.next();
  }

  // 未認証 → /auth にリダイレクト
  const url = request.nextUrl.clone();
  url.pathname = '/auth';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
