import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import SASDmDiffEditor from '../../components/SASDmDiffEditor';
import DmDxNoteEditor from '../../components/DmDxNoteEditor';
import { copyKarteToClipboard } from '../../lib/copyKarte';
import { insertDmDxNote } from '../../lib/dmDxNote';

// 確認中を削除：新規→完了の2ステップ
const STATUS_LABEL = { new: '新規', done: '完了' };
const STATUS_COLOR = { new: '#e53e3e', done: '#38a169' };
const STATUS_NEXT  = { new: 'done' };

export default function DetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [record, setRecord]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);
  const [karte, setKarte]       = useState('');
  const [saveMsg, setSaveMsg]   = useState('');
  const [showDmDiffEditor, setShowDmDiffEditor] = useState(false);
  const [showDmDxNote, setShowDmDxNote] = useState(false);
  const [savingDmDiff, setSavingDmDiff] = useState(false);
  const [dmDiffMsg, setDmDiffMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/questionnaire/detail?id=${id}`)
      .then(r => r.json())
      .then(data => {
        setRecord(data);
        setKarte(data.generated_karte || '');
        setLoading(false);
      });
  }, [id]);

  const handleStatusChange = async () => {
    const next = STATUS_NEXT[record.status];
    if (!next) return;
    await fetch('/api/questionnaire', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: next }),
    });
    setRecord(prev => ({ ...prev, status: next }));
  };

  const handleDelete = async () => {
    if (!confirm('このレコードを削除しますか？')) return;
    await fetch('/api/questionnaire', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    router.push('/list');
  };

  const copyToClipboard = (text) => copyKarteToClipboard(text);

  const handleSaveKarte = async () => {
    try {
      const res = await fetch('/api/questionnaire', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, generated_karte: karte }),
      });
      if (res.ok) { setSaveMsg('✓ 保存しました'); setTimeout(() => setSaveMsg(''), 2500); }
      else { setSaveMsg('保存に失敗しました'); setTimeout(() => setSaveMsg(''), 3000); }
    } catch (e) { setSaveMsg('保存に失敗しました'); setTimeout(() => setSaveMsg(''), 3000); }
  };

  const handleSaveDmDiff = async (newDmDiff) => {
    if (savingDmDiff) return;
    setSavingDmDiff(true);
    setDmDiffMsg('');
    try {
      const newFormData = { ...record.form_data, dmDiff: newDmDiff };
      const res = await fetch('/api/questionnaire', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, form_data: newFormData }),
      });
      if (res.ok) {
        setRecord(prev => ({ ...prev, form_data: newFormData }));
        setShowDmDiffEditor(false);
        setDmDiffMsg('✓ DM差分問診を保存しました。「🔄 再生成」を押してSAS+DM統合カルテを生成してください。');
        setTimeout(() => setDmDiffMsg(''), 8000);
      } else {
        setDmDiffMsg('保存に失敗しました');
        setTimeout(() => setDmDiffMsg(''), 3000);
      }
    } catch (e) {
      setDmDiffMsg('保存に失敗しました');
      setTimeout(() => setDmDiffMsg(''), 3000);
    } finally {
      setSavingDmDiff(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/generate-karte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_data: record.form_data, form_type: record.form_type }),
      });
      const data = await res.json();
      const generated = data.karte || '';
      setKarte(generated);
      await fetch('/api/questionnaire', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, generated_karte: generated }),
      });
    } catch (e) {
      alert('生成に失敗しました');
    }
    setGenerating(false);
  };

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Noto Sans JP',sans-serif" }}>
      読み込み中...
    </div>
  );

  if (!record) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Noto Sans JP',sans-serif" }}>
      データが見つかりません
    </div>
  );

  const statusColor = STATUS_COLOR[record.status] || '#718096';
  const statusLabel = STATUS_LABEL[record.status] || record.status;
  const isSAS = record.form_type === '睡眠時無呼吸症候群';
  const dmDiffCompleted = !!record.form_data?.dmDiff?.completed;
  const isDM = record.form_type === 'DM基本';

  return (
    <div style={{ minHeight:'100vh', background:'#f7faff', fontFamily:"'Noto Sans JP',sans-serif", padding:'16px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>

        {/* ヘッダー */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button onClick={() => router.push('/list')}
            style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid #d0dff5', background:'#fff', color:'#5580a8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            ← 一覧
          </button>
          <div>
            <div style={{ fontSize:11, color:'#6b9fd4', fontWeight:700 }}>まつもと糖尿病クリニック</div>
            <div style={{ fontSize:18, fontWeight:900, color:'#1a2a4a' }}>問診詳細</div>
          </div>
        </div>

        {/* 受付コード */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px', marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', textAlign:'center' }}>
          <div style={{ fontSize:13, color:'#7a9abf', marginBottom:4 }}>受付コード</div>
          <div style={{ fontSize:48, fontWeight:900, color:'#1a5fa8', letterSpacing:'0.15em' }}>{record.visit_code}</div>
          <div style={{ fontSize:12, color:'#7a9abf', marginTop:4 }}>
            {record.form_type || 'DM基本'}{record.age ? `　${record.age}歳` : ''}
          </div>
        </div>

        {/* ステータス */}
        <div style={{ background:'#fff', borderRadius:16, padding:'16px 20px', marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:12, color:'#7a9abf', marginBottom:4 }}>ステータス</div>
            <div style={{ padding:'6px 14px', borderRadius:20, background:statusColor+'20', color:statusColor, fontWeight:700, fontSize:14, display:'inline-block' }}>
              {statusLabel}
            </div>
          </div>
          {STATUS_NEXT[record.status] && (
            <button onClick={handleStatusChange}
              style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'#38a169', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              ✓ 完了にする
            </button>
          )}
        </div>

        {/* SAS: DM差分問診（採血で糖尿病判明時にスタッフが追加聴取） */}
        {isSAS && (
          <div style={{ background:'#fff', borderRadius:16, padding:'18px 20px', marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border: dmDiffCompleted ? '2px solid #1a5fa8' : '1.5px dashed #bcd4f8' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom: showDmDiffEditor ? 12 : 0 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:900, color:'#1a5fa8', marginBottom:4 }}>
                  {dmDiffCompleted ? '✓ DM差分問診（入力済）' : '📝 DM差分問診（採血で糖尿病判明時）'}
                </div>
                <div style={{ fontSize:12, color:'#5580a8', lineHeight:1.6 }}>
                  {dmDiffCompleted
                    ? '採血で糖尿病が判明した患者の追加聴取が完了しています。再生成すると SAS+DM 統合カルテになります。'
                    : '当院の事前採血で HbA1c が高値で糖尿病と診断された場合、DM 初期評価に必要な追加項目をここで聴取してください。'}
                </div>
              </div>
              {!showDmDiffEditor && (
                <button onClick={() => setShowDmDiffEditor(true)}
                  style={{ padding:'10px 18px', borderRadius:8, border:'none', background: dmDiffCompleted ? '#5a8fc8' : 'linear-gradient(135deg,#1a5fa8,#3b82f6)', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  {dmDiffCompleted ? '✏️ 編集' : '＋ DM差分問診を入力'}
                </button>
              )}
            </div>
            {dmDiffMsg && (
              <div style={{ marginTop:8, padding:'10px 14px', background: dmDiffMsg.startsWith('✓') ? '#f0fff4' : '#fff5f5', border: `1.5px solid ${dmDiffMsg.startsWith('✓') ? '#9ae6b4' : '#feb2b2'}`, borderRadius:8, fontSize:13, color: dmDiffMsg.startsWith('✓') ? '#276749' : '#c53030', fontWeight:700 }}>
                {dmDiffMsg}
              </div>
            )}
            {showDmDiffEditor && (
              <div style={{ marginTop:14 }}>
                <SASDmDiffEditor
                  value={record.form_data?.dmDiff}
                  onSave={handleSaveDmDiff}
                  onCancel={() => setShowDmDiffEditor(false)}
                  saving={savingDmDiff}
                />
              </div>
            )}
          </div>
        )}

        {/* DM基本: 診断グレーゾーンの医師確認結果を申し送りに追記（採血後に使う） */}
        {isDM && karte && (
          <div style={{ background:'#fff', borderRadius:16, padding:'18px 20px', marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1.5px dashed #bcd4f8' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom: showDmDxNote ? 14 : 0 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:900, color:'#1a5fa8', marginBottom:4 }}>
                  🩸 採血後：糖尿病診断の確認結果（GAD・CPRの算定根拠）
                </div>
                <div style={{ fontSize:12, color:'#5580a8', lineHeight:1.6 }}>
                  HbA1c がグレーゾーン（6.3〜6.6前後）で医師に確認した場合、その結果を申し送りに追記します。
                </div>
              </div>
              {!showDmDxNote && (
                <button onClick={() => setShowDmDxNote(true)}
                  style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#1a5fa8,#3b82f6)', color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                  ＋ 確認結果を入力
                </button>
              )}
            </div>
            {showDmDxNote && (
              <DmDxNoteEditor onInsert={line => setKarte(prev => insertDmDxNote(prev, line))} />
            )}
          </div>
        )}

        {/* カルテ文 */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px', marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#1a2a4a', marginBottom:12 }}>カルテ記載文</div>
          {karte ? (
            <>
              <textarea value={karte} onChange={e => setKarte(e.target.value)}
                style={{ width:'100%', minHeight:320, background:'#f5f9f7', border:'1px solid #c0e8d8', borderRadius:10, padding:'16px', fontSize:11, lineHeight:2, color:'#1a3a2a', fontFamily:'monospace', marginBottom:12, resize:'vertical', boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                <button onClick={() => copyToClipboard(karte)}
                  style={{ flex:'1 1 140px', padding:'12px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#0f9668,#34d399)', color:'#fff', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                  📋 コピー
                </button>
                <button onClick={handleSaveKarte}
                  style={{ flex:'1 1 140px', padding:'12px', borderRadius:8, border:'1.5px solid #0f9668', background:'#f0fff4', color:'#0f9668', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                  💾 編集を保存
                </button>
                <button onClick={handleGenerate} disabled={generating}
                  style={{ padding:'12px 16px', borderRadius:8, border:'1.5px solid #d0dff5', background:'#f7faff', color:'#5580a8', fontWeight:700, fontSize:13, cursor:generating?'not-allowed':'pointer' }}>
                  {generating ? '生成中...' : '🔄 再生成'}
                </button>
                {saveMsg && <span style={{ fontSize:13, fontWeight:700, color:saveMsg.startsWith('✓')?'#0f9668':'#c53030' }}>{saveMsg}</span>}
              </div>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ color:'#a0b8d0', marginBottom:16, fontSize:13 }}>カルテ文がまだ生成されていません</div>
              <button onClick={handleGenerate} disabled={generating}
                style={{ padding:'12px 28px', borderRadius:8, border:'none', background:generating?'#8ab0d4':'linear-gradient(135deg,#1a5fa8,#6b9fd4)', color:'#fff', fontWeight:800, fontSize:14, cursor:generating?'not-allowed':'pointer' }}>
                {generating ? '生成中...' : '✨ カルテ文を生成'}
              </button>
            </div>
          )}
        </div>

        {/* 削除ボタン */}
        <div style={{ textAlign:'right', marginBottom:32 }}>
          <button onClick={handleDelete}
            style={{ padding:'10px 20px', borderRadius:8, border:'1.5px solid #fed7d7', background:'#fff5f5', color:'#e53e3e', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            🗑 このレコードを削除
          </button>
        </div>

      </div>
    </div>
  );
}
