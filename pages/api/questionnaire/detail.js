import { supabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id is required' })

  const { data, error } = await supabase
    .from('questionnaires')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'not found' })

  return res.status(200).json(data)
}
