// Phase 2 Phase G: dm-clinic-karte のログイン
//
// kinkan-app の /api/auth/verify-staff に staff_id + password を投げて認証、
// 成功したら iron-session に staff 情報を保存する。
//
// POST   /api/auth  { staffId, password }   → ログイン
// DELETE /api/auth                          → ログアウト
// GET    /api/auth                          → 現セッション情報

import { getSession } from '../../lib/session'

const KINKAN_VERIFY_URL = process.env.KINKAN_VERIFY_URL
  || 'https://kinkan-app.vercel.app/api/auth/verify-staff'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { staffId, password } = req.body || {}
    if (!staffId || !password) {
      return res.status(400).json({ error: 'staffId と password が必要です' })
    }

    let verifyRes
    try {
      verifyRes = await fetch(KINKAN_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, password }),
      })
    } catch (e) {
      return res.status(502).json({ error: '認証サーバーに接続できません' })
    }

    const data = await verifyRes.json().catch(() => ({}))
    if (!verifyRes.ok || !data.ok) {
      return res.status(401).json({ error: data.error || '認証に失敗しました' })
    }

    // セッション保存
    const session = await getSession(req, res)
    session.user = data.staff
    await session.save()

    return res.status(200).json({ ok: true, staff: data.staff })
  }

  if (req.method === 'DELETE') {
    const session = await getSession(req, res)
    session.destroy()
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'GET') {
    const session = await getSession(req, res)
    if (!session.user) {
      return res.status(401).json({ user: null })
    }
    return res.status(200).json({ user: session.user })
  }

  return res.status(405).end()
}
