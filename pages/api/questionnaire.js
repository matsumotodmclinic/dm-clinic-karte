import { supabase } from '../../lib/supabase'
import { getSession } from '../../lib/session'
import { recordAuditLog } from '../../lib/auditLog'
import { validateCreate, validatePatch } from '../../lib/validateQuestionnaire'
import { purgeExpired } from '../../lib/retention'

function generateVisitCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // 入力検証（lib/validateQuestionnaire.js。年齢ははじかずに整える）
    const v = validateCreate(req.body)
    if (!v.ok) return res.status(v.status).json({ error: v.error })
    const session = await getSession(req, res)

    let visit_code
    let attempts = 0
    while (attempts < 10) {
      const code = generateVisitCode()
      const { data } = await supabase
        .from('questionnaires')
        .select('id')
        .eq('visit_code', code)
        .single()
      if (!data) { visit_code = code; break }
      attempts++
    }

    if (!visit_code) return res.status(500).json({ error: 'コード生成に失敗しました' })

    const { data, error } = await supabase
      .from('questionnaires')
      .insert([{ visit_code, ...v.row, status: 'new' }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // 監査ログ（問診の中身は送らない。種類と受付番号だけ）
    await recordAuditLog({
      category: 'questionnaire',
      action: 'create',
      table_name: 'questionnaires',
      record_id: data.id,
      note: `${v.row.form_type} を新規保存（受付番号 ${visit_code}）`,
    }, session.user)
    return res.status(200).json({ visit_code, id: data.id })
  }

  if (req.method === 'GET') {
    // 保存から一定日数を過ぎた問診を消す（lib/retention.js。環境変数が無ければ何もしない）
    const session = await getSession(req, res)
    await purgeExpired(supabase, {
      onDeleted: ({ deleted, cutoff, days }) => recordAuditLog({
        category: 'questionnaire',
        action: 'purge_expired',
        table_name: 'questionnaires',
        note: `保存から ${days} 日を過ぎた問診 ${deleted} 件を自動削除（${cutoff.slice(0, 10)} より前）`,
        new_value: JSON.stringify({ count: deleted, days }),
      }, session.user),
    })

    const { visit_code } = req.query
    let query = supabase
      .from('questionnaires')
      .select('*')
      .order('created_at', { ascending: false })

    if (visit_code) query = query.ilike('visit_code', `%${visit_code}%`)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const { id, markAllDone } = req.body
    const session = await getSession(req, res)

    // 全件完了化（院長・事務長・リーダーのみ）
    if (markAllDone) {
      const role = session.user?.role
      if (!['管理者', '事務長', 'リーダー'].includes(role)) {
        return res.status(403).json({ error: '権限がありません' })
      }
      const { data: targets, error: selErr } = await supabase
        .from('questionnaires')
        .select('id')
        .eq('status', 'new')
      if (selErr) return res.status(500).json({ error: selErr.message })

      const { error } = await supabase
        .from('questionnaires')
        .update({ status: 'done', updated_at: new Date().toISOString() })
        .eq('status', 'new')
      if (error) return res.status(500).json({ error: error.message })

      await recordAuditLog({
        category: 'questionnaire',
        action: 'mark_all_done',
        table_name: 'questionnaires',
        note: `新規問診 ${targets?.length || 0} 件を一括完了化`,
        new_value: JSON.stringify({ count: targets?.length || 0 }),
      }, session.user)
      return res.status(200).json({ ok: true, count: targets?.length || 0 })
    }

    // 入力検証（lib/validateQuestionnaire.js）。form_data は DM差分問診の追記など全体の更新に使う
    const v = validatePatch(req.body)
    if (!v.ok) return res.status(v.status).json({ error: v.error })
    const updates = { ...v.updates, updated_at: new Date().toISOString() }

    const { error } = await supabase
      .from('questionnaires')
      .update(updates)
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })

    // 監査ログ(失敗してもメイン処理は続行)
    // ★問診の中身（form_data・カルテ本文）は送らない。勤怠アプリの audit_logs に
    //   医療情報の写しを作らないため（2026-10-15 まで updates を丸ごと送っていた）
    const changedFields = Object.keys(updates).filter(k => k !== 'updated_at')
    await recordAuditLog({
      category: 'questionnaire',
      action: 'update',
      table_name: 'questionnaires',
      record_id: id,
      note: `${changedFields.join(', ')} を更新`,
      new_value: updates.status ? JSON.stringify({ status: updates.status }) : null,
    }, session.user)

    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id, deleteAll, deleteToday, date } = req.body
    const session = await getSession(req, res)

    // セキュリティ上、全件削除(deleteAllRegardless)は API から削除。
    // 過去の誤操作・悪意ある操作による問診データ全消失を防ぐ。
    // 全件削除が必要な場合は Supabase 管理画面で手動実行すること。

    // 完了済みを一括削除
    if (deleteAll) {
      const { error } = await supabase
        .from('questionnaires')
        .delete()
        .eq('status', 'done')
      if (error) return res.status(500).json({ error: error.message })
      await recordAuditLog({
        category: 'questionnaire',
        action: 'delete_all_done',
        table_name: 'questionnaires',
        note: '完了済みの問診を一括削除',
      }, session.user)
      return res.status(200).json({ ok: true })
    }

    // 当日の完了分を削除
    if (deleteToday && date) {
      const startOfDay = `${date}T00:00:00.000Z`
      const endOfDay = `${date}T23:59:59.999Z`
      const { error } = await supabase
        .from('questionnaires')
        .delete()
        .eq('status', 'done')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
      if (error) return res.status(500).json({ error: error.message })
      await recordAuditLog({
        category: 'questionnaire',
        action: 'delete_today_done',
        table_name: 'questionnaires',
        note: `${date} の完了済みを一括削除`,
      }, session.user)
      return res.status(200).json({ ok: true })
    }

    // 個別削除（id 必須）
    if (!id) {
      return res.status(400).json({ error: 'id is required' })
    }
    const { error } = await supabase
      .from('questionnaires')
      .delete()
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    await recordAuditLog({
      category: 'questionnaire',
      action: 'delete',
      table_name: 'questionnaires',
      record_id: id,
      note: '問診を個別削除',
    }, session.user)
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
