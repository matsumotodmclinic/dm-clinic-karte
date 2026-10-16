// 「前回の入力が残っています」バナー。問診フォームの最初の画面にだけ出る（lib/useIntakeDraft.js）。
// 2026-10-16 新設。タブを閉じた・再読み込みした・PC が固まった回の聴取を救う。

import { UI } from '../lib/uiTokens'
import { formatSavedAt } from '../lib/intakeDraft'

export default function DraftRestoreBanner({ draft, onRestore }) {
  if (!draft?.showBanner) return null
  const { savedAt, step } = draft.prev
  const restore = () => {
    const d = draft.restore()
    if (d) onRestore(d)
  }
  const discard = () => {
    if (!confirm('前回の入力を破棄します。元に戻せません。よろしいですか？')) return
    draft.discard()
  }
  return (
    <div role="status" style={{ background: UI.warning.bg, border: `2px solid ${UI.warning.fg}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: UI.warning.fg, marginBottom: 4 }}>
        📝 送信されていない前回の入力が残っています（{formatSavedAt(savedAt)} 時点・ステップ {step + 1}）
      </div>
      <div style={{ fontSize: 12, color: UI.textMuted, marginBottom: 10 }}>
        タブを閉じた・再読み込みした・PC が固まった ときの入力です。同じ患者さんの続きなら「続きから再開」を押してください。
        別の患者さんなら「破棄」してください（12 時間たつと自動で消えます）。
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={restore}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: UI.warning.fg, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          ▶ 続きから再開
        </button>
        <button onClick={discard}
          style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${UI.neutral.fg}`, background: UI.surface, color: UI.neutral.fg, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          破棄
        </button>
      </div>
    </div>
  )
}
