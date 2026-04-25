// 監査ログ送信ヘルパー(2026-04-25)
// dm-clinic-karte の操作を kinkan-app の audit_logs に集約する。
//
// 失敗してもメイン処理を止めないよう、try/catch で握りつぶす設計。
//
// 使い方:
//   import { recordAuditLog } from '@/lib/auditLog'
//   await recordAuditLog({
//     category: 'questionnaire',
//     action: 'delete',
//     table_name: 'questionnaires',
//     note: `[id: ${id}] 完了済1件を削除`,
//   }, sessionUser)
//
// sessionUser は /api/auth GET の結果(session.user)を渡す。
// modified_by には kinkan-app の staff.id が入る。

const KINKAN_AUDIT_URL = process.env.KINKAN_AUDIT_URL
  || 'https://kinkan-app.vercel.app/api/audit-log'

/**
 * クライアント or サーバーから kinkan-app の audit-log エンドポイントへ POST する。
 * クライアントから直接呼ぶ場合、CORS 設定済み。
 */
export async function recordAuditLog(payload, user) {
  if (!user || !user.id) {
    // 認証情報なしでは記録できない(無視して継続)
    console.warn('[auditLog] no user, skipping')
    return
  }
  try {
    await fetch(KINKAN_AUDIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app: 'dm-clinic-karte',
        category: payload.category,
        action: payload.action,
        table_name: payload.table_name || null,
        note: payload.note || null,
        old_value: payload.old_value || null,
        new_value: payload.new_value || null,
        modified_by: user.id,
        modified_by_role: user.role || null,
      }),
    })
  } catch (e) {
    // ログ送信失敗はメイン処理を止めない
    console.warn('[auditLog] failed to record:', e?.message)
  }
}
