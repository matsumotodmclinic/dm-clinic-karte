import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const STATUS_LABEL = { new: '新規', checking: '確認中', done: '完了' };
const STATUS_COLOR = { new: '#e53e3e', checking: '#d69e2e', done: '#38a169' };
const STATUS_NEXT = { new: 'checking', checking: 'done' };

export default function DetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [karte, setKarte] = useState('');

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
          <div style={{ fontSize:12, color:'#7a9abf', marginTop:4 }}>{record.form_type || 'DM基本'}{record.age ? `　${record.age}歳` : ''}</div>
        </div>

        {/* ステータス */}
        <div style={{ background:'#fff', borderRadius:16, padding:'16px 20px', marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:12, color:'#7a9abf', marginBottom:4 }}>ステータス</div>
            <div style={{ padding:'6px 14px', borderRadius:20, background:STATUS_COLOR[record.status]+'20', color:STATUS_COLOR[record.status], fontWeight:700, fontSize:14, display:'inline-block' }}>
              {STATUS_LABEL[record.status]}
            </div>
          </div>
          {STATUS_NEXT[record.status] && (
            <button onClick={handleStatusChange}
              style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'#1a5fa8', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              → {STATUS_LABEL[STATUS_NEXT[record.status]]}に変更
            </button>
          )}
        </div>

        {/* カルテ文 */}
        <div style={{ background:'#fff', borderRadius:16, padding:'20px', marginBottom:12, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'#1a2a4a', marginBottom:12 }}>カルテ記載文</div>
          {karte ? (
            <>
              <div style={{ background:'#f5f9f7', border:'1px solid #c0e8d8', borderRadius:10, padding:'16px', whiteSpace:'pre-wrap', fontSize:13, lineHeight:2, color:'#1a3a2a', fontFamily:'monospace', marginBottom:12 }}>
                {karte}
              </div>
              <div style={{ display:'flex', gap:8' }}>
                <button onClick={() => navigator.cl
