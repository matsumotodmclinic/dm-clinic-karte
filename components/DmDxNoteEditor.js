// 糖尿病診断グレーゾーンの医師確認結果を、カルテの申し送りに追記する UI。
// 詳細画面 (pages/detail/[id].js) からインラインで使う。DM基本のみ表示。
//
// 採血後に HbA1c を見てから使うため、問診フォームではなくここに置いている。
// AI 再生成は行わず、カルテ本文の申し送り欄に1行挿入するだけ（lib/dmDxNote.js）。
// 挿入後は「💾 編集を保存」で確定する。

import { useState } from 'react'
import { DM_DX_DECISIONS, buildDmDxNoteLine } from '../lib/dmDxNote'
import { UI } from '../lib/uiTokens';

const inp = (x={}) => ({ padding:'8px 11px', border:`1px solid ${UI.border}`, borderRadius:8, fontSize:13, color:UI.text, background:UI.surface, outline:'none', boxSizing:'border-box', fontFamily:'inherit', ...x })
const lbl = (x={}) => ({ display:'block', fontSize:12, fontWeight:700, color:UI.primary.fg, marginBottom:5, ...x })
const btn = (active, color=UI.primary.fg, x={}) => ({ padding:'8px 13px', borderRadius:6, border:active?`1px solid ${color}`:`1px solid ${UI.border}`, background:active?color:'#f7faff', color:active?'#fff':'#5580a8', fontWeight:700, fontSize:12, cursor:'pointer', margin:'3px 4px 3px 0', ...x })

const empty = () => ({ decision:'', hba1c:'', past:{ fbs:'', ppbs:'', hba1c:'' } })

export default function DmDxNoteEditor({ onInsert }) {
  const [d, setD] = useState(empty())
  const [msg, setMsg] = useState('')

  const u  = (k, v) => setD(p => ({ ...p, [k]: v }))
  const uP = (k, v) => setD(p => ({ ...p, past: { ...p.past, [k]: v } }))

  const line = buildDmDxNoteLine(d)
  const needsHba1c = !!d.decision && !String(d.hba1c).trim()

  const handleInsert = () => {
    if (!line) return
    onInsert(line)
    setMsg('✓ 申し送りに追記しました。「💾 編集を保存」で確定してください。')
    setTimeout(() => setMsg(''), 8000)
  }

  const handleClear = () => {
    onInsert('')
    setD(empty())
    setMsg('✓ 追記した行を取り消しました。「💾 編集を保存」で確定してください。')
    setTimeout(() => setMsg(''), 8000)
  }

  return (
    <div>
      <div style={{ fontSize:12, color:UI.textMuted, lineHeight:1.7, marginBottom:14 }}>
        採血後の HbA1c を確認し、糖尿病の診断がグレー（6.3〜6.6前後）だった場合に使います。
        GAD抗体・CPR は糖尿病と診断されて初めて算定できるため、
        <strong>何を根拠に診断した／見送ったか</strong>を申し送りに残します。
      </div>

      <label style={lbl()}>今回のHbA1c（必須）</label>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16 }}>
        <input style={inp({ width:90 })} inputMode="decimal" placeholder="6.4"
          value={d.hba1c} onChange={e => u('hba1c', e.target.value)} />
        <span style={{ fontSize:13, color:UI.textMuted }}>%</span>
      </div>

      <label style={lbl()}>過去の値（診断根拠として使ったものだけ入力）</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10, marginBottom:6 }}>
        {[
          ['fbs',   '空腹時血糖', 'mg/dl', '132'],
          ['ppbs',  '食後血糖',   'mg/dl', '210'],
          ['hba1c', 'HbA1c',      '%',     '6.6'],
        ].map(([k, label, unit, ph]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:12, color:UI.textMuted, fontWeight:700 }}>{label}</span>
            <input style={inp({ width:78 })} inputMode="decimal" placeholder={ph}
              value={d.past[k]} onChange={e => uP(k, e.target.value)} />
            <span style={{ fontSize:11, color:UI.textDisabled }}>{unit}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize:11, color:UI.textDisabled, lineHeight:1.6, marginBottom:16 }}>
        診断基準は 空腹時血糖126 ／ 食後血糖200 ／ HbA1c6.5% のうち2項目（別項目2つ、または同一項目2回）です。
      </div>

      <label style={lbl()}>医師に確認した結果</label>
      <div style={{ display:'flex', flexWrap:'wrap', marginBottom:6 }}>
        {/* 「見送り」は GAD・CPR を削除する操作なので赤。他はカテゴリ色 */}
        {DM_DX_DECISIONS.map(o => (
          <button key={o.key} style={btn(d.decision === o.key, o.key === 'deferred' ? UI.danger.fg : UI.primary.fg)}
            onClick={() => u('decision', d.decision === o.key ? '' : o.key)}>
            {d.decision === o.key ? '✓ ' : ''}{o.label}（{o.note}）
          </button>
        ))}
      </div>

      {needsHba1c && (
        <div style={{ fontSize:12, color:UI.danger.fg, fontWeight:700, marginBottom:10 }}>
          今回のHbA1c を入力してください。
        </div>
      )}

      {line && (
        <div style={{ background:UI.surfaceAlt, border:`1px solid ${UI.border}`, borderRadius:8, padding:'11px 13px', fontSize:11, lineHeight:1.9, color:UI.text, fontFamily:'monospace', margin:'10px 0 14px', wordBreak:'break-all' }}>
          {line}
        </div>
      )}

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <button onClick={handleInsert} disabled={!line}
          style={{ padding:'11px 18px', borderRadius:6, border:'none', background: line ? UI.success.fg : UI.textDisabled, color:'#fff', fontWeight:700, fontSize:13, cursor: line ? 'pointer' : 'not-allowed' }}>
          ＋ 申し送りに追記
        </button>
        <button onClick={handleClear}
          style={{ padding:'11px 16px', borderRadius:6, border:`1px solid ${UI.border}`, background:UI.surface, color:UI.textMuted, fontWeight:700, fontSize:12, cursor:'pointer' }}>
          追記を取り消す
        </button>
      </div>

      {msg && (
        <div style={{ marginTop:10, padding:'10px 14px', background:UI.surface, border:`1px solid ${UI.success.fg}`, borderRadius:8, fontSize:12, color:UI.success.fg, fontWeight:700 }}>
          {msg}
        </div>
      )}
    </div>
  )
}
