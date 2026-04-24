// Phase 2 Phase G: iron-session による認証
//
// kinkan-app の staff テーブルで bcrypt 認証した結果を session に載せる。
// Vercel の環境変数:
//   SECRET_COOKIE_PASSWORD (32文字以上、kinkan-app とは別値)
//   KINKAN_VERIFY_URL (既定値: https://kinkan-app.vercel.app/api/auth/verify-staff)
//   KINKAN_LIST_URL (既定値: https://kinkan-app.vercel.app/api/auth/list-public)

import { getIronSession } from 'iron-session'

export const sessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD || '',
  cookieName: 'dm_clinic_karte_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7日間
    path: '/',
  },
}

// Pages Router の API routes で使う: getSession(req, res)
export function getSession(req, res) {
  return getIronSession(req, res, sessionOptions)
}
