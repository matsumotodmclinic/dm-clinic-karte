// リブレ装着の予約（3回分）。妊娠糖尿病・糖尿病合併妊娠の入力欄。
//
// ■ なぜ要るか（院長 2026-10-16）
// 妊娠糖尿病はリブレの装着が**初診時**なので、初事前では「予約を 3 回分取る」のが段取り
// （初診・GDMフォロー①②／紙の運用 2026-10-14）。
// 申し送りにはその段取りの指示が条件なしで出ていただけで、**取れたかどうかは残っていなかった**。
// 「予約を３回分とったかどうか、日付も含めて」。
//
// ■ カルテへの出方（lib/libreNotes.js）
// 3 つ揃った → 「□リブレ装着の予約3回分 取得済（初診 R8.10.23・…）」
// 一部だけ   → 揃っていない枠を「未記入」と書き「→ 残りの予約をお取りください」
// 1 つも無し → 従来どおり段取りの指示＋「予約日 未記入」（過去のレコードを断定しないため）

import { UI } from '../lib/uiTokens'

const SLOTS = [
  { key: 'firstVisit', label: '初診（リブレ装着）' },
  { key: 'follow1', label: 'GDMフォロー①' },
  { key: 'follow2', label: 'GDMフォロー②' },
]

/**
 * @param value {{ firstVisit?: string, follow1?: string, follow2?: string }}
 * @param onChange (next) => void
 */
export default function LibreReservationInput({ value, onChange }) {
  const v = value || {}
  const filled = SLOTS.filter(s => v[s.key]).length
  const done = filled === SLOTS.length

  return (
    <div style={{
      background: done ? UI.surfaceAlt : UI.accent.bg,
      border: `1px solid ${done ? UI.border : UI.accent.fg}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 14,
    }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: UI.primary.fg, marginBottom: 5, letterSpacing: '0.03em',
      }}>
        リブレ装着の予約（3回分）
      </label>
      {SLOTS.map(s => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: UI.textMuted, minWidth: 128 }}>{s.label}</span>
          <input
            type="date"
            value={v[s.key] || ''}
            onChange={e => onChange({ ...v, [s.key]: e.target.value })}
            style={{
              padding: '8px 10px', border: `1px solid ${UI.border}`, borderRadius: 8,
              fontSize: 14, color: '#1a2a3a', background: UI.surface,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>
      ))}
      <div style={{ fontSize: 11, color: UI.textFaint, marginTop: 8, lineHeight: 1.7 }}>
        {done
          ? '3回分そろいました。申し送りに「予約3回分 取得済」と日付が出ます。'
          : '空のままでも先に進めます。未記入の枠は申し送りに「未記入」と出ます（後から詳細画面で入力して再生成できます）。'}
      </div>
    </div>
  )
}
