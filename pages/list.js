import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';

const STATUS_LABEL = { new: '新規', done: '完了' };
const STATUS_COLOR = { new: '#e53e3e', done: '#38a169' };

const DATE_FILTERS = [
  { id: 'today',     label: '本日' },
  { id: 'yesterday', label: '昨日' },
  { id: 'week',      label: '今週' },
  { id: 'all',       label: '全件' },
];

export default function ListPage() {
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [newCount, setNewCount]     = useState(0);
  const prevIdsRef                  = useRef(new Set());
  const router = useRouter();

  const matchDateFilter = (str, filter) => {
    const d = new Date(str);
    const now = new Date();
    const sameDay = (a, b) =>
      a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
    if (filter === 'today')     return sameDay(d, now);
    if (filter === 'yesterday') {
      const yest = new Date(now); yest.setDate(now.getDate() - 1);
      return sameDay(d, yest);
    }
    if (filter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 6); weekAgo.setHours(0,0,0,0);
      return d >= weekAgo;
    }
    return true;
  };

  const fetchRecords = useCallback(async (code = '', silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/questionnaire${code ? `?visit_code=${code}` : ''}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      if (silent) {
        const fresh = list.filter(r => !prevIdsRef.current.has(r.id));
        if (fresh.length > 0) {
          setNewCount(prev => prev + fresh.length);
          fresh.forEach(r => prevIdsRef.current.add(r.id));
        }
      } else {
        prevIdsRef.current = new Set(list.map(r => r.id));
        setNewCount(0);
      }
      setRecords(list);
    } catch (e) { console.error('fetchRecords error:', e); }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // 30秒ごとに自動更新
  useEffect(() => {
    const timer = setInterval(() => fetchRecords('', true), 30000);
    return () => clearInterval(timer);
  }, [fetchRecords]);

  // タイトルバーに新規件数を表示
  useEffect(() => {
    const n = records.filter(r => r.status === 'new').length;
    document.title = n > 0 ? `問診一覧 (新規${n}件)` : '問診一覧';
    return () => { document.title = '問診一覧'; };
  }, [records]);

  const handleSearch = (e) => { e.preventDefault(); fetchRecords(search); };

  const handleDeleteDone = async () => {
    if (!confirm('完了済みをすべて削除しますか？')) return;
    await fetch('/api/questionnaire', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({deleteAll:true}) });
    fetchRecords();
  };

  const handleDeleteToday = async () => {
    if (!confirm('当日の完了分をすべて削除しますか？')) return;
    const today = new Date().toISOString().split('T')[0];
    await fetch('/api/questionnaire', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({deleteToday:true, date:today}) });
    fetchRecords();
  };

  const filtered = records.filter(r => matchDateFilter(r.created_at, dateFilter));
  const formatDate = (str) => { const d = new Date(str); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const isToday = (str) => { const d=new Date(str); const t=new Date(); return d.getFullYear()===t.getFullYear()&&d.getMonth()===t.getMonth()&&d.getDate()===t.getDate(); };

  const todayDoneCount = records.filter(r => r.status==='done' && isToday(r.created_at)).length;
  const allDoneCount   = records.filter(r => r.status==='done').length;
  const newRecCount    = filtered.filter(r => r.status==='new').length;

  return (
    <div style={{ minHeight:'100vh', background:'#f7faff', fontFamily:"'Noto Sans JP',sans-serif", padding:'16px' }}>
      <div style={{ maxWidth:720, margin:'0 auto' }}>

        {/* ヘッダー */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:'#6b9fd4', fontWeight:700 }}>まつもと糖尿病クリニック</div>
            <div style={{ fontSize:20, fontWeight:900, color:'#1a2a4a' }}>問診一覧</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => fetchRecords()}
              style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid #d0dff5', background:'#fff', color:'#5580a8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              🔄 更新
            </button>
            <button onClick={() => router.push('/')}
              style={{ padding:'8px 14px', borderRadius:8, border:'1.5px solid #d0dff5', background:'#fff', color:'#5580a8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              トップへ
            </button>
          </div>
        </div>

        {/* 新着通知バナー */}
        {newCount > 0 && (
          <div style={{ background:'#1a5fa8', color:'#fff', borderRadius:10, padding:'12px 18px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>🔔 新しい問診が {newCount}件 届いています</span>
            <button onClick={() => fetchRecords()} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:'rgba(255,255,255,0.25)', color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>
              確認する
            </button>
          </div>
        )}

        {/* 日付フィルター */}
        <div style={{ display:'flex', gap:6, marginBottom:10, alignItems:'center' }}>
          {DATE_FILTERS.map(f => (
            <button key={f.id} onClick={() => setDateFilter(f.id)}
              style={{ padding:'8px 16px', borderRadius:8, border: dateFilter===f.id ? '2px solid #1a5fa8':'1.5px solid #d0dff5', background: dateFilter===f.id ? '#1a5fa8':'#fff', color: dateFilter===f.id ? '#fff':'#5580a8', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {f.label}
            </button>
          ))}
          <div style={{ marginLeft:'auto', fontSize:13, color:'#7a9abf' }}>
            {newRecCount > 0 && (
              <span style={{ background:'#e53e3e', color:'#fff', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:700, marginRight:8 }}>
                新規 {newRecCount}件
              </span>
            )}
            {filtered.length}件
          </div>
        </div>

        {/* 受付コード検索 */}
        <form onSubmit={handleSearch} style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
            placeholder="受付コードで検索（例：AB3K）"
            style={{ flex:1, padding:'10px 14px', borderRadius:8, border:'1.5px solid #d0dff5', fontSize:14, outline:'none' }}
          />
          <button type="submit" style={{ padding:'10px 18px', borderRadius:8, border:'none', background:'#1a5fa8', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>検索</button>
          <button type="button" onClick={() => { setSearch(''); fetchRecords(); }}
            style={{ padding:'10px 14px', borderRadius:8, border:'1.5px solid #d0dff5', background:'#fff', color:'#5580a8', fontWeight:700, fontSize:14, cursor:'pointer' }}>全件</button>
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
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#7a9abf' }}>
            {dateFilter !== 'all'
              ? `${DATE_FILTERS.find(f=>f.id===dateFilter)?.label}のデータがありません`
              : 'データがありません'}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(r => (
              <div key={r.id} onClick={() => router.push(`/detail/${r.id}`)}
                style={{ background:'#fff', borderRadius:12, padding:'14px 16px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', cursor:'pointer', display:'flex', alignItems:'center', gap:12, border:`1.5px solid ${isToday(r.created_at)?'#bee3f8':'#e8f0fe'}` }}>
                <div style={{ width:48, height:48, borderRadius:10, background:'#e8f0fe', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16, color:'#1a5fa8', flexShrink:0 }}>
                  {r.visit_code}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'#7a9abf' }}>
                    {formatDate(r.created_at)}{isToday(r.created_at) ? '　🟦 本日' : ''}
                  </div>
                  <div style={{ fontSize:14, color:'#1a2a4a', fontWeight:700 }}>
                    {r.form_type || 'DM基本'}{r.age ? `　${r.age}歳` : ''}
                  </div>
                </div>
                <div style={{ padding:'4px 10px', borderRadius:20, background:(STATUS_COLOR[r.status]||'#718096')+'20', color:STATUS_COLOR[r.status]||'#718096', fontWeight:700, fontSize:12, flexShrink:0 }}>
                  {STATUS_LABEL[r.status] || r.status}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign:'center', fontSize:11, color:'#b0c8e0', marginTop:16 }}>
          30秒ごとに自動更新
        </div>
      </div>
    </div>
  );
}
