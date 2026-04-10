import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

const STATUS_LABEL = { new: '新規', done: '完了' };
const STATUS_COLOR = { new: '#e53e3e', done: '#38a169' };

export default function ListPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const router = useRouter();

  const fetchRecords = async (code = '') => {
    setLoading(true);
    const res = await fetch(`/api/questionnaire${code ? `?visit_code=${code}` : ''}`);
    const data = await res.json();
    setRecords(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecords(search);
  };

  // 完了済みをすべて削除
  const handleDeleteDone = async () => {
    if (!confirm('完了済みをすべて削除しますか？')) return;
    await fetch('/api/questionnaire', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteAll: true }),
    });
    fetchRecords();
  };

  // 当日の完了分を削除
  const handleDeleteToday = async () => {
    if (!confirm('当日の完了分をすべて削除しますか？')) return;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    await fetch('/api/questionnaire', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteToday: true, date: today }),
    });
    fetchRecords();
  };

  const formatDate = (str) => {
    const d = new Date(str);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const isToday = (str) => {
    const d = new Date(str);
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  };

  const todayDoneCount = records.filter(r => r.status === 'done' && isToday(r.created_at)).length;
  const allDoneCount = records.filter(r => r.status === 'done').length;

  return (
    <div style={{ minHeight:'100vh', background:'#f7faff', fontFamily:"'Noto Sans JP',sans-serif", padding:'16px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>

        {/* ヘッダー */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:11, color:'#6b9fd4', fontWeight:700 }}>まつもと糖尿病クリニック</div>
            <div style={{ fontSize:20, fontWeight:900, color:'#1a2a4a' }}>問診一覧</div>
          </div>
          <button onClick={() => router.push('/')}
            style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid #d0dff5', background:'#fff', color:'#5580a8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            トップへ
          </button>
        </div>

        {/* 検索 */}
        <form onSubmit={handleSearch} style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="受付コードで検索（例：AB3K）"
            style={{ flex:1, padding:'10px 14px', borderRadius:8, border:'1.5px solid #d0dff5', fontSize:14, outline:'none' }}
          />
          <button type="submit"
            style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'#1a5fa8', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
            検索
          </button>
          <button type="button" onClick={() => { setSearch(''); fetchRecords(); }}
            style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #d0dff5', background:'#fff', color:'#5580a8', fontWeight:700, fontSize:14, cursor:'pointer' }}>
            全件
          </button>
        </form>

        {/* 削除ボタン */}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginBottom:12 }}>
          <button onClick={handleDeleteToday}
            style={{ padding:'7px 14px', borderRadius:8, border:'1.5px solid #fbd38d', background:'#fffaf0', color:'#c05621', fontWeight:700, fontSize:12, cursor:'pointer' }}>
            🗑️ 当日完了分を削除{todayDoneCount > 0 ? `（${todayDoneCount}件）` : ''}
          </button>
          <button onClick={handleDeleteDone}
            style={{ padding:'7px 14px', borderRadius:8, border:'1.5px solid #feb2b2', background:'#fff5f5', color:'#c53030', fontWeight:700, fontSize:12, cursor:'pointer' }}>
            🗑️ 完了済みを一括削除{allDoneCount > 0 ? `（${allDoneCount}件）` : ''}
          </button>
        </div>

        {/* 一覧 */}
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#7a9abf' }}>読み込み中...</div>
        ) : records.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#7a9abf' }}>データがありません</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {records.map(r => (
              <div key={r.id}
                onClick={() => router.push(`/detail/${r.id}`)}
                style={{ background:'#fff', borderRadius:12, padding:'14px 16px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', cursor:'pointer', display:'flex', alignItems:'center', gap:12, border:`1.5px solid ${isToday(r.created_at) ? '#bee3f8' : '#e8f0fe'}` }}>
                <div style={{ width:48, height:48, borderRadius:10, background:'#e8f0fe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, color:'#1a5fa8', flexShrink:0 }}>
                  {r.visit_code}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'#7a9abf' }}>{formatDate(r.created_at)}{isToday(r.created_at) ? ' 　🟦 本日' : ''}</div>
                  <div style={{ fontSize:14, color:'#1a2a4a', fontWeight:700 }}>
                    {r.form_type || 'DM基本'}
                    {r.age ? `　${r.age}歳` : ''}
                  </div>
                </div>
                <div style={{ padding:'4px 10px', borderRadius:20, background:(STATUS_COLOR[r.status]||'#718096')+'20', color:STATUS_COLOR[r.status]||'#718096', fontWeight:700, fontSize:12, flexShrink:0 }}>
                  {STATUS_LABEL[r.status] || r.status}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
