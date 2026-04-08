import { supabase } from '../../lib/supabase'

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
    const { age, form_type, form_data, generated_karte } = req.body

    // visit_code生成（重複チェックあり）
    let visit_code
    let attempts = 0
    while (attempts < 10) {
      const code = generateVisitCode()
      const { data } = await supabase
        .from('questionnaires')
        .select('id')
        .eq('visit_code', code)
        .single()
      if (!data) {
        visit_code = code
        break
      }
      attempts++
    }

    if (!visit_code) {
      return res.status(500).json({ error: 'コード生成に失敗しました' })
    }

    const { data, error } = await supabase
      .from('questionnaires')
      .insert([{ visit_code, age, form_type, form_data, generated_karte, status: 'new' }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ visit_code, id: data.id })
  }

  if (req.method === 'GET') {
    const { visit_code } = req.query
    let query = supabase
      .from('questionnaires')
      .select('*')
      .order('created_at', { ascending: false })

    if (visit_code) {
      query = query.ilike('visit_code', `%${visit_code}%`)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PATCH') {
    const { id, status, generated_karte } = req.body
    const updates = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (generated_karte) updates.generated_karte = generated_karte

    const { error } = await supabase
      .from('questionnaires')
      .update(updates)
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id, deleteAll } = req.body

    if (deleteAll) {
      const { error } = await supabase
        .from('questionnaires')
        .delete()
        .eq('status', 'done')
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    const { error } = await supabase
      .from('questionnaires')
      .delete()
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
