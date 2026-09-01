// DM差分問診 入力 UI
// 詳細画面 (pages/detail/[id].js) からインラインで使う。
//
// 睡眠時無呼吸症候群 / 高血圧・脂質異常症 / 反応性低血糖 は全例当院で事前採血を行う。
// その HbA1c 高値で糖尿病が判明した場合、これらの問診票は糖尿病の初期評価に必要な
// 項目を聞いていないため、ここで差分だけを追加聴取して form_data.dmDiff に保存する。
// 保存後に「再生成」を押すと、元の主病名 ＋ ＃糖尿病 の統合カルテが生成される。
// （プロンプト側は lib/dmDiff.js と lib/buildKartePrompt.js）

import { useState } from 'react'
import { UI } from '../lib/uiTokens';

const inp = (x={}) => ({ padding:'8px 11px', border:`1px solid ${UI.border}`, borderRadius:8, fontSize:13, color:UI.text, background:UI.surface, outline:'none', boxSizing:'border-box', fontFamily:'inherit', width:'100%', ...x })
const lbl = (x={}) => ({ display:'block', fontSize:12, fontWeight:700, color:UI.primary.fg, marginBottom:5, ...x })
const btn = (active, color=UI.primary.fg, x={}) => ({ padding:'7px 12px', borderRadius:6, border:active?`1px solid ${color}`:`1px solid ${UI.border}`, background:active?color:'#f7faff', color:active?'#fff':'#5580a8', fontWeight:700, fontSize:12, cursor:'pointer', margin:'3px 4px 3px 0', ...x })

const DM_SYMPTOMS = ['のどが渇く','尿の回数が多い','体がだるい','手のしびれ','足のしびれ','足がつりやすい','視力が落ちた','食後の低血糖を心配している','その他']
const DM_FH_WHO = ['父','母','祖父（父方）','祖母（父方）','祖父（母方）','祖母（母方）','兄弟・姉妹']

const empty = () => ({
  completed: false,
  weightLoss: '',
  dmSymptoms: { selected: [], otherText: '' },
  pastHbA1c: '',
  diabetesOnsetEra: '令和',
  diabetesOnsetYear: '',
  diabetesOnsetUnknown: false,
  diabetesOnsetNote: '',
  insulinUse: false,
  fhDm: false, fhDmWho: [], fhHl: false,
  eyeFundusCheck: '',
  eyeNotebook: '',
  eyeClinic: '',
  retinopathy: '',
  importantPast: { gastricCancer: false, pancreasCancer: false, ihd: false, stroke: false, detail: '' },
  treatmentWish: '',
  freeText: '',
})

export default function DmDiffEditor({ value, onSave, onCancel, saving }) {
  const [d, setD] = useState({ ...empty(), ...(value || {}) })
  const u = (k, v) => setD(p => ({ ...p, [k]: v }))
  const uN = (k, sub, v) => setD(p => ({ ...p, [k]: { ...p[k], [sub]: v } }))
  const tg = (k, v) => setD(p => {
    const a = p[k] || []
    return { ...p, [k]: a.includes(v) ? a.filter(x => x !== v) : [...a, v] }
  })
  const tgSym = (sym) => setD(p => {
    const cur = p.dmSymptoms?.selected || []
    const next = cur.includes(sym) ? cur.filter(x => x !== sym) : [...cur, sym]
    return { ...p, dmSymptoms: { ...p.dmSymptoms, selected: next } }
  })

  const handleSave = () => {
    onSave({ ...d, completed: true })
  }

  return (
    <div style={{ background:UI.surface, border:`1px solid ${UI.primary.fg}`, borderRadius:8, padding:'18px 20px', marginBottom:14 }}>
      <div style={{ fontSize:14, fontWeight:700, color:UI.primary.fg, marginBottom:6 }}>📝 DM差分問診（採血で糖尿病判明後）</div>
      <div style={{ fontSize:12, color:UI.textMuted, marginBottom:14, lineHeight:1.6 }}>
        元の問診で取得済みの項目以外で、糖尿病初期評価に必要な項目のみ追加聴取してください。保存後、「🔄 再生成」ボタンを押すと ＃糖尿病 を含む統合カルテが生成されます。
      </div>

      <label style={lbl()}>体重減少（過去数ヶ月）</label>
      <div style={{ display:'flex', flexWrap:'wrap', marginBottom:12 }}>
        {['なし','あり（軽度）','あり（3kg以上）'].map(v => (
          <button key={v} style={btn(d.weightLoss === v, UI.danger.fg)} onClick={() => u('weightLoss', v)}>{v}</button>
        ))}
      </div>

      <label style={lbl()}>糖尿病の症状（該当するものをすべて）</label>
      <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 }}>
        {DM_SYMPTOMS.map(sym => {
          const sel = (d.dmSymptoms?.selected || []).includes(sym)
          return <button key={sym} style={btn(sel, UI.primary.fg, { fontSize:11, padding:'5px 9px' })} onClick={() => tgSym(sym)}>{sel?'✓ ':''}{sym}</button>
        })}
      </div>
      {(d.dmSymptoms?.selected || []).includes('その他') && (
        <input style={{ ...inp(), marginBottom:12 }} placeholder='その他の症状の詳細' value={d.dmSymptoms?.otherText || ''} onChange={e => uN('dmSymptoms', 'otherText', e.target.value)} />
      )}
      <div style={{ height:6 }} />

      <label style={lbl()}>過去の HbA1c / 血糖の指摘歴（あれば自由記載）</label>
      <input style={{ ...inp(), marginBottom:12 }} placeholder='例：H30健診で HbA1c 6.4 指摘、放置' value={d.pastHbA1c} onChange={e => u('pastHbA1c', e.target.value)} />

      <label style={lbl()}>糖尿病の既知の発症時期（既知の場合のみ。今回採血で判明なら空欄でOK）</label>
      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:6 }}>
        <select style={{ ...inp(), width:90 }} value={d.diabetesOnsetEra} onChange={e => u('diabetesOnsetEra', e.target.value)} disabled={d.diabetesOnsetUnknown}>
          <option>昭和</option><option>平成</option><option>令和</option>
        </select>
        <input style={{ ...inp(), width:70 }} type='number' placeholder='年' value={d.diabetesOnsetUnknown ? '' : d.diabetesOnsetYear} onChange={e => u('diabetesOnsetYear', e.target.value)} disabled={d.diabetesOnsetUnknown} />
        <button style={btn(d.diabetesOnsetUnknown, UI.neutral.fg)} onClick={() => u('diabetesOnsetUnknown', !d.diabetesOnsetUnknown)}>{d.diabetesOnsetUnknown ? '✓ 不明' : '不明'}</button>
      </div>
      <input style={{ ...inp(), marginBottom:12 }} placeholder='補足（例：今回採血で判明、健診放置）' value={d.diabetesOnsetNote} onChange={e => u('diabetesOnsetNote', e.target.value)} />

      <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, fontSize:13, color:UI.primary.fg, fontWeight:700, cursor:'pointer' }}>
        <input type='checkbox' checked={d.insulinUse} onChange={e => u('insulinUse', e.target.checked)} /> インスリン使用中（既知の場合）
      </label>

      <div style={{ background:UI.surfaceAlt, border:`1px solid ${UI.border}`, borderRadius:8, padding:'12px 14px', marginBottom:12 }}>
        <label style={lbl({ color:UI.fixed.fg })}>家族歴（DM・HL の追加聴取）</label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:8 }}>
          <button style={btn(d.fhDm, UI.fixed.fg)} onClick={() => u('fhDm', !d.fhDm)}>糖尿病(DM){d.fhDm?' ✓':''}</button>
          <button style={btn(d.fhHl, UI.fixed.fg)} onClick={() => u('fhHl', !d.fhHl)}>脂質異常症(HL){d.fhHl?' ✓':''}</button>
        </div>
        {d.fhDm && (
          <div>
            <label style={lbl({ color:UI.fixed.fg, fontSize:11 })}>糖尿病：誰が（複数選択可）</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
              {DM_FH_WHO.map(v => <button key={v} style={btn((d.fhDmWho || []).includes(v), UI.fixed.fg, { fontSize:11, padding:'5px 9px' })} onClick={() => tg('fhDmWho', v)}>{v}</button>)}
            </div>
          </div>
        )}
      </div>

      <div style={{ background:UI.surfaceAlt, border:`1px solid ${UI.border}`, borderRadius:8, padding:'12px 14px', marginBottom:12 }}>
        <label style={lbl({ color:UI.primary.fg })}>眼科スクリーニング（DM網膜症評価）</label>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:8 }}>
          <div style={{ flex:1, minWidth:160 }}>
            <div style={{ fontSize:11, color:UI.primary.fg, marginBottom:3 }}>眼底検査</div>
            <div style={{ display:'flex', gap:4 }}>
              {['受けている','受けていない'].map(v => <button key={v} style={btn(d.eyeFundusCheck === v, UI.primary.fg, { fontSize:11, padding:'5px 9px' })} onClick={() => u('eyeFundusCheck', v)}>{v}</button>)}
            </div>
          </div>
          <div style={{ flex:1, minWidth:160 }}>
            <div style={{ fontSize:11, color:UI.primary.fg, marginBottom:3 }}>糖尿病-眼科連携手帳</div>
            <div style={{ display:'flex', gap:4 }}>
              {['持っている','持っていない'].map(v => <button key={v} style={btn(d.eyeNotebook === v, UI.primary.fg, { fontSize:11, padding:'5px 9px' })} onClick={() => u('eyeNotebook', v)}>{v}</button>)}
            </div>
          </div>
        </div>
        {d.eyeFundusCheck === '受けている' && (
          <input style={{ ...inp(), marginBottom:8 }} placeholder='眼科名（例：○○眼科）' value={d.eyeClinic} onChange={e => u('eyeClinic', e.target.value)} />
        )}
        <div style={{ fontSize:11, color:UI.primary.fg, marginBottom:3 }}>網膜症</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
          {['なし','単純性','前増殖','増殖','不明'].map(v => <button key={v} style={btn(d.retinopathy === v, UI.primary.fg, { fontSize:11, padding:'5px 9px' })} onClick={() => u('retinopathy', v)}>{v}</button>)}
        </div>
      </div>

      <div style={{ background:'#fff5f5', border:'1px solid #feb2b2', borderRadius:8, padding:'12px 14px', marginBottom:12 }}>
        <label style={lbl({ color:UI.danger.fg })}>DM関連の重要既往（該当のみ）</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
          {[['gastricCancer','胃癌'],['pancreasCancer','膵臓癌'],['ihd','虚血性心疾患（IHD）'],['stroke','脳梗塞']].map(([k, l]) => (
            <button key={k} style={btn(d.importantPast?.[k], UI.danger.fg)} onClick={() => uN('importantPast', k, !d.importantPast?.[k])}>{d.importantPast?.[k] ? '✓ ' : ''}{l}</button>
          ))}
        </div>
        {(d.importantPast?.gastricCancer || d.importantPast?.pancreasCancer || d.importantPast?.ihd || d.importantPast?.stroke) && (
          <textarea style={{ ...inp(), minHeight:60, resize:'vertical' }} placeholder='詳細（時期・治療病院・現通院先・内服薬など）' value={d.importantPast?.detail || ''} onChange={e => uN('importantPast', 'detail', e.target.value)} />
        )}
      </div>

      <label style={lbl()}>治療希望</label>
      <div style={{ display:'flex', flexWrap:'wrap', marginBottom:12 }}>
        {['経口','インスリン','食事運動のみ','未定'].map(v => <button key={v} style={btn(d.treatmentWish === v)} onClick={() => u('treatmentWish', v)}>{v}</button>)}
      </div>

      <label style={lbl()}>自由記載（補足）</label>
      <textarea style={{ ...inp(), minHeight:60, resize:'vertical', marginBottom:14 }} placeholder='その他補足があれば記載' value={d.freeText} onChange={e => u('freeText', e.target.value)} />

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} disabled={saving} style={{ padding:'10px 18px', borderRadius:8, border:`1px solid ${UI.border}`, background:UI.surface, color:UI.textMuted, fontWeight:700, fontSize:13, cursor: saving ? 'not-allowed' : 'pointer' }}>キャンセル</button>
        <button onClick={handleSave} disabled={saving} style={{ padding:'10px 22px', borderRadius:6, border:'none', background: saving ? '#7a9abf' : UI.primary.fg, color:'#fff', fontWeight:700, fontSize:13, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? '保存中...' : '💾 保存して再生成へ'}
        </button>
      </div>
    </div>
  )
}
