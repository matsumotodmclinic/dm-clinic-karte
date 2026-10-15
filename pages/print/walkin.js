// 予約なしで来院された方の手書き用 A4（院長依頼 2026-10-15）。
//
// このページは **lib/walkinForm.js を描くだけ**。文言はそちらが正本。
// 患者さんがペンで書く紙なので、印刷用 A4（PrintSheet）とは別物:
//   ・縮小しない（手書きの欄が小さくなると書けない）
//   ・□ は実際に書き込める大きさを確保する
//   ・1 枚に収まるかは `scripts/golden/walkin.test.mjs` と画面の警告で見る
//
// ★ルールアウト（体重減少・HbA1c 10%以上）を紙のいちばん上に置く。院長の目的そのもの。

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { UI } from '../../lib/uiTokens'
import { WALKIN_META, URGENT, MENUS, COMMON, BY_MENU, STAFF } from '../../lib/walkinForm'

const CSS = `
.wk { width: 190mm; margin: 0 auto; padding: 10mm 9mm; background: #fff;
  font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif; color: #111; }
.wk-scroll { overflow-x: auto; }
.wk-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 6px; }
.wk-clinic { font-size: 10.5px; font-weight: 700; letter-spacing: .04em; }
.wk-title { font-size: 15px; font-weight: 700; }
.wk-lead { font-size: 10px; line-height: 1.6; margin: 0 0 7px; }
.wk-name { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; border: 1px solid #111; padding: 6px 9px; margin-bottom: 7px; }
.wk-lab { font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.wk-fill { display: inline-block; border-bottom: 1px solid #111; height: 17px; }
/* ★ルールアウトの枠。他より太く・濃くして、受付が真っ先に見る場所にする */
.wk-urgent { border: 2px solid #111; padding: 7px 9px; margin-bottom: 8px; }
.wk-urgent-head { font-size: 10.5px; font-weight: 700; background: #111; color: #fff; display: inline-block; padding: 1px 7px; margin-bottom: 5px; }
/* 2 問を横に並べる。縦に積むと紙が 26mm 足りなくなった（実測）。
   枠は太いままなので、受付が最初に見る場所という役割は変わらない */
.wk-urgent-row { display: flex; gap: 7mm; }
.wk-urgent-row > div { flex: 1; }
.wk-q { font-size: 11px; font-weight: 700; margin-bottom: 3px; }
.wk-sec { border: 1px solid #111; padding: 4px 9px 5px; margin-bottom: 5px; }
.wk-sec-title { font-size: 10.5px; font-weight: 700; margin-bottom: 3px; }
.wk-opts { display: flex; flex-wrap: wrap; gap: 2px 13px; font-size: 10px; line-height: 1.72; }
.wk-opt { white-space: nowrap; }
.wk-free { font-size: 10px; line-height: 1.78; }
.wk-note { font-size: 9px; color: #333; }
/* ★短い節は横に並べる。1 列のままだと 67mm はみ出した（実測）。
   手書きの欄を小さくするより、並べ方で詰めるほうが書きやすさを損なわない */
.wk-two { display: flex; gap: 6px; align-items: stretch; }
.wk-two > * { flex: 1; margin-bottom: 6px; }
.wk-two > * > .wk-sec { margin-bottom: 0; height: 100%; }
/* 「該当する方のみ」の中身も 2 列（甲状腺の症状が長い） */
.wk-bymenu { column-count: 2; column-gap: 7mm; }
.wk-bymenu > div { break-inside: avoid; margin-bottom: 3px; }
.wk-staff { border: 1px dashed #111; padding: 6px 9px; margin-top: 2px; background: #f4f4f4; }
@page { size: A4; margin: 8mm; }
@media print {
  .kp-no-print { display: none !important; }
  .wk { padding: 0; }
  body { background: #fff; }
}
`

// □ は文字で出す（画像やborderにすると印刷機で潰れることがある）
const Box = ({ children }) => <span className="wk-opt">□ {children}</span>

function Section({ title, options, free, write, note }) {
  return (
    <div className="wk-sec">
      <div className="wk-sec-title">{title}</div>
      {options && (
        <div className="wk-opts">
          {options.map(o => <Box key={o}>{o}</Box>)}
        </div>
      )}
      {write && <div className="wk-free">{write}</div>}
      {free && <div className="wk-free">□ {free}</div>}
      {note && <div className="wk-note">{note}</div>}
    </div>
  )
}

export default function WalkinFormPage() {
  const router = useRouter()
  const [overflow, setOverflow] = useState(false)
  const ref = useRef(null)

  // 1 枚に収まっているかを見るだけ（縮小はしない。手書き欄が小さくなると書けないので）
  //
  // ★画面には上下に余白（padding）を付けているが、**印刷では 0 にしている**。
  //   余白込みで測ると、紙では余っているのに「はみ出し」と出る（約 20mm ぶん）。
  //   なので padding を引いた「中身の高さ」で見る。
  useEffect(() => {
    const measure = () => {
      const el = ref.current
      if (!el) return
      const cs = getComputedStyle(el)
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const h = el.scrollHeight - pad
      if (h <= 0) return
      setOverflow(h > (297 - 8 * 2) * (96 / 25.4))
    }
    measure()
    document.fonts?.ready?.then(measure).catch(() => {})
    window.addEventListener('beforeprint', measure)
    return () => window.removeEventListener('beforeprint', measure)
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div style={{ background: UI.surfaceAlt, minHeight: '100vh', fontFamily: "'Noto Sans JP', sans-serif" }}>
        <div className="kp-no-print" style={{ margin: '0 auto', padding: '16px 0', display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 760, flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/')}
            style={{ padding: '9px 15px', borderRadius: 8, border: `1px solid ${UI.border}`, background: UI.surface, color: UI.textMuted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ← トップ
          </button>
          <button onClick={() => window.print()}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: UI.primary.fg, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🖨 印刷（A4）
          </button>
          <span style={{ alignSelf: 'center', fontSize: 12, color: overflow ? UI.danger.fg : UI.textMuted, fontWeight: overflow ? 700 : 400 }}>
            {overflow ? '⚠️ 1 枚に収まっていません（項目を減らしてください）' : '1 枚に収まっています'}
          </span>
        </div>

        <div className="kp-no-print" style={{ maxWidth: 760, margin: '0 auto 14px', padding: '10px 14px', background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: 8, fontSize: 12.5, color: UI.textMuted, lineHeight: 1.8 }}>
          ご予約なしで来院された方にお渡しする<strong>手書きの問診票</strong>です。白紙で印刷して受付に置いてください。
          記入後は、上部の<strong>体重減少・HbA1c</strong> をまず確認し、該当する方は初事前のご予約を前倒しします。
        </div>

        <div className="wk-scroll"><div className="wk" ref={ref}>
          <div className="wk-head">
            <div>
              <div className="wk-clinic">{WALKIN_META.clinic}</div>
              <div className="wk-title">{WALKIN_META.title}</div>
            </div>
            <div className="wk-lab">記入日　　　　年　　月　　日</div>
          </div>
          <p className="wk-lead">{WALKIN_META.lead}</p>

          <div className="wk-name">
            <div className="wk-lab">お名前</div>
            <span className="wk-fill" style={{ width: '52mm' }} />
            <div className="wk-lab">男・女</div>
            <div className="wk-lab">生年月日</div>
            <span className="wk-fill" style={{ width: '13mm' }} />
            <div className="wk-lab">年</div>
            <span className="wk-fill" style={{ width: '8mm' }} />
            <div className="wk-lab">月</div>
            <span className="wk-fill" style={{ width: '8mm' }} />
            <div className="wk-lab">日</div>
            <div className="wk-lab">年齢</div>
            <span className="wk-fill" style={{ width: '12mm' }} />
            <div className="wk-lab">歳</div>
          </div>

          {/* ★ルールアウト。紙のいちばん上・枠を太く */}
          <div className="wk-urgent">
            <div className="wk-urgent-head">まず この 2 問にお答えください</div>
            <div className="wk-urgent-row">
              {URGENT.map(u => (
                <div key={u.id}>
                  <div className="wk-q">{u.label}</div>
                  <div className="wk-free">{u.question}</div>
                  <div className="wk-opts">{u.options.map(o => <Box key={o}>{o}</Box>)}</div>
                  {u.write && <div className="wk-free">{u.write}</div>}
                  {u.detail && <div className="wk-free">{u.detail}</div>}
                </div>
              ))}
            </div>
          </div>

          <Section title="本日のご相談（あてはまるものに ✓ ）" options={MENUS} />

          {/* 短い節は 2 列。並びは lib ではなく**紙の都合**なのでここで持つ */}
          {[['reason'], ['clinic', 'referral'], ['symptoms'], ['treatment', 'diagnosed'], ['knew']].map(row => {
            const secs = row.map(id => COMMON.find(c => c.id === id))
            if (secs.length === 1) return <Section key={row[0]} {...secs[0]} />
            return (
              <div className="wk-two" key={row.join('-')}>
                {secs.map(sec => <div key={sec.id}><Section {...sec} /></div>)}
              </div>
            )
          })}

          <div className="wk-sec">
            <div className="wk-sec-title">該当する方のみ ご記入ください</div>
            <div className="wk-bymenu">
            {BY_MENU.map(b => (
              <div key={b.id} style={{ marginTop: 2 }}>
                <div className="wk-free"><strong>・{b.title}</strong></div>
                {b.options && <div className="wk-opts">{b.options.map(o => <Box key={o}>{o}</Box>)}</div>}
                {b.write && <div className="wk-free">{b.write}</div>}
              </div>
            ))}
            </div>
          </div>

          <div className="wk-staff">
            <div className="wk-sec-title">{STAFF.title}</div>
            <div className="wk-opts">{STAFF.checks.map(c => <Box key={c}>{c}</Box>)}</div>
            <div className="wk-free">{STAFF.write}</div>
          </div>
        </div></div>
      </div>
    </>
  )
}
