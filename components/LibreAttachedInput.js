// リブレ（自費CGM）を装着したか。反応性低血糖と、DM基本で食後低血糖を訴えた回に出す入力欄。
//
// ■ なぜ要るか（院長 2026-10-16）
// 申し送りには「□自費CGM（リブレ）初事前で装着済」が**条件なしで**出ていた。
// 全例装着の運用だからだが、そのせいで**やっていない回も『装着済』と書かれる**。
// 「まちがいなく行ったかどうか、日付も含めて明確に残したい」。
//
// ■ カルテへの出方（lib/libreNotes.js）
// 装着済 → 「□…装着済（R8.10.16）」 / 未装着 → 「□…未装着（理由：…）→ 初診時に医師とご相談ください」
// 未入力 → 「□…未確認」。**聞けていない回を『済』とは書かない。**
//
// ■ 日付は西暦で持つ（画面）→ 和暦で出す（カルテ）
// `<input type="date">` の値（2026-10-16）をそのまま保存し、カルテに書くときだけ和暦に換算する。
// 院長の運用では装着はその日なので「本日」ボタンを置いた（毎回カレンダーを開かせない）。

import { UI } from '../lib/uiTokens'
import { LIBRE_ATTACHED, LIBRE_NOT_ATTACHED } from '../lib/libreNotes'

const todayValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * @param value {{ attached?: string, date?: string, note?: string }}
 * @param onChange (next) => void   まとめて 1 オブジェクトで返す
 * @param title    見出し（フォームで言い方が違う）
 * @param hint     欄の下に出す説明
 */
export default function LibreAttachedInput({ value, onChange, title = 'リブレ（自費CGM）の装着', hint }) {
  const v = value || {}
  const set = patch => onChange({ ...v, ...patch })
  const notAttached = v.attached === LIBRE_NOT_ATTACHED

  return (
    <div style={{
      background: v.attached ? UI.surfaceAlt : UI.accent.bg,
      border: `1px solid ${v.attached ? UI.border : UI.accent.fg}`,
      borderRadius: 10, padding: '14px 16px', marginBottom: 14,
    }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: UI.primary.fg, marginBottom: 5, letterSpacing: '0.03em',
      }}>
        {title}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {[LIBRE_ATTACHED, LIBRE_NOT_ATTACHED].map(opt => (
          <button
            key={opt}
            onClick={() => set(
              // 装着済を選んだ時点で日付が空なら本日を入れる（装着した日に入力する運用）
              opt === v.attached ? { attached: '' }
                : opt === LIBRE_ATTACHED ? { attached: opt, date: v.date || todayValue() }
                : { attached: opt },
            )}
            style={{
              padding: '8px 14px', borderRadius: 6,
              border: `1px solid ${UI.primary.fg}`,
              background: v.attached === opt ? UI.primary.fg : UI.surface,
              color: v.attached === opt ? '#fff' : UI.primary.fg,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              margin: '3px 4px 3px 0', fontFamily: 'inherit',
            }}
          >
            {opt}
          </button>
        ))}
      </div>

      {v.attached === LIBRE_ATTACHED && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: UI.textMuted }}>装着日</span>
          <input
            type="date"
            value={v.date || ''}
            onChange={e => set({ date: e.target.value })}
            style={{
              padding: '8px 10px', border: `1px solid ${UI.border}`, borderRadius: 8,
              fontSize: 14, color: '#1a2a3a', background: UI.surface,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => set({ date: todayValue() })}
            style={{
              padding: '7px 12px', borderRadius: 6, border: `1px solid ${UI.neutral.fg}`,
              background: UI.surface, color: UI.neutral.fg,
              fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            本日
          </button>
        </div>
      )}

      {notAttached && (
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: UI.textMuted }}>装着しなかった理由（任意）</span>
          <input
            type="text"
            placeholder="例：本人希望なし / 在庫切れ"
            value={v.note || ''}
            onChange={e => set({ note: e.target.value })}
            style={{
              width: '100%', marginTop: 4, padding: '9px 12px',
              border: `1px solid ${UI.border}`, borderRadius: 8, fontSize: 14,
              color: '#1a2a3a', background: UI.surface,
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      <div style={{ fontSize: 11, color: UI.textFaint, marginTop: 8, lineHeight: 1.7 }}>
        {hint || '未入力のままだと申し送りに「未確認」と出ます。後から詳細画面で入力して再生成できます。'}
      </div>

      {notAttached && (
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 8,
          background: UI.warning.bg, color: UI.warning.fg,
          fontSize: 12, fontWeight: 700, lineHeight: 1.7,
        }}>
          申し送りに「→ 初診時に医師とご相談ください」が入ります
        </div>
      )}
    </div>
  )
}
