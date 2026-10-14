// 当日の HbA1c（院内測定）。全フォーム共通の入力欄。
//
// ■ なぜ問診の最終ステップに置くか（院長確定 2026-10-14）
// HbA1c は当日 院内で全例測定している。ただし運用上は 問診 → 採血 の順なので、
// 問診を終える時点ではまだ結果が出ていない回がある。
// そこで「空のままでも先に進める」欄をここに置き、**後から分かった回は詳細画面で入れて再生成**する。
// どちらの順でも同じ値に行き着くよう、保存先は両方とも form_data.body.hba1c。
//
// ■ カルテへの出方（lib/buildKarteTemplate.js）
// ・フッターの「R8.10：HbA1c　　%」の空欄が埋まる（未入力なら空欄のまま。推測で埋めない）
// ・10%以上 または 体重減少あり で「□腹部エコーセット＋胸部X-P の予約」が申し送りに出る
//   （紙の運用「体重減少またはHbA1c10%以上の方→腹エコー＋胸部XP追加」＝悪性腫瘍のスクリーニング）

import { UI } from '../lib/uiTokens'

// polycythemia / onPolycythemiaChange を渡したフォームだけ「多血症」のチェックが出る。
// 体重過多（BMI 25以上）か多血症なら簡易PSG を申し送りに出す運用のため（院長 2026-10-14）。
// 渡すのは 糖尿病・高血圧脂質異常症・睡眠時無呼吸症候群 の 3 フォームだけ。
export default function Hba1cInput({ value, onChange, polycythemia, onPolycythemiaChange }) {
  // 数値として読めたときだけ 10% 以上の注意を出す（「測定中」等の自由入力では出さない）
  const n = parseFloat(String(value ?? '').replace(/[０-９．]/g, c => '０１２３４５６７８９．'.indexOf(c) === 10 ? '.' : String('０１２３４５６７８９'.indexOf(c))))
  const high = Number.isFinite(n) && n >= 10

  return (
    <div style={{
      background: UI.surfaceAlt,
      border: `1px solid ${UI.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 14,
    }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 700,
        color: UI.primary.fg, marginBottom: 5, letterSpacing: '0.03em',
      }}>
        当日の HbA1c（院内測定）
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          inputMode="decimal"
          placeholder="例：7.2"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{
            width: 110, padding: '9px 12px',
            border: `1px solid ${high ? UI.danger.fg : UI.border}`,
            borderRadius: 8, fontSize: 14, color: '#1a2a3a',
            background: UI.surface, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
          }}
        />
        <span style={{ fontSize: 13, color: UI.textMuted }}>%</span>
      </div>
      <div style={{ fontSize: 11, color: UI.textFaint, marginTop: 6, lineHeight: 1.7 }}>
        採血がまだなら空のままで構いません。後から詳細画面で入力して再生成できます。
      </div>
      {onPolycythemiaChange && (
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
          fontSize: 13, fontWeight: 700, color: UI.text, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={!!polycythemia}
            onChange={e => onPolycythemiaChange(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          多血症（Hb・Ht 高値）
        </label>
      )}
      {high && (
        <div style={{
          marginTop: 8, padding: '8px 12px', borderRadius: 8,
          background: UI.danger.bg, color: UI.danger.fg,
          fontSize: 12, fontWeight: 700, lineHeight: 1.7,
        }}>
          HbA1c 10%以上 → 腹部エコーセット＋胸部X-P の予約が申し送りに入ります
        </div>
      )}
    </div>
  )
}
