// 紹介状の現物を持参したか。全フォーム共通の入力欄。
//
// ■ なぜ要るか（紙「●紹介状のご持参：（有・無）」／院長 2026-10-14）
// 紹介元（どこの病院の何科か）はこれまでも聴取していたが、**現物を持ってきたか**は聞いていなかった。
// 医師が診察時に紹介状を手元に持てるかが変わるので、持参ありのときだけ申し送りに出す。
//
// ■ カルテへの出方（lib/buildKarteTemplate.js の handoffHead）
// 「持参あり」のときだけ「□紹介状 持参あり」が申し送りに入る。
// 「持参なし」と未聴取は区別せず、どちらも行を出さない（院長 2026-10-14）。

import { UI } from '../lib/uiTokens'

export default function ReferralLetterInput({ value, onChange }) {
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
        紹介状のご持参
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {['持参あり', '持参なし'].map(v => (
          <button
            key={v}
            onClick={() => onChange(value === v ? '' : v)}
            style={{
              padding: '8px 14px', borderRadius: 6,
              border: `1px solid ${UI.primary.fg}`,
              background: value === v ? UI.primary.fg : UI.surface,
              color: value === v ? '#fff' : UI.primary.fg,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              margin: '3px 4px 3px 0', fontFamily: 'inherit',
            }}
          >
            {v}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: UI.textFaint, marginTop: 6, lineHeight: 1.7 }}>
        持参ありのときだけ申し送りに出ます。院長宛の紹介状でも他の医師の診察になります。
      </div>
    </div>
  )
}
