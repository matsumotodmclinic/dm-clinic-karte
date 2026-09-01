import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { UI } from '../lib/uiTokens';

const KINKAN_LIST_URL = process.env.NEXT_PUBLIC_KINKAN_LIST_URL
  || 'https://kinkan-app.vercel.app/api/auth/list-public';

export default function AuthPage() {
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const router = useRouter();

  // kinkan-app のスタッフ一覧を取得（公開 API、パスワード含まない）
  useEffect(() => {
    fetch(KINKAN_LIST_URL, { credentials: 'omit' })
      .then(r => (r.ok ? r.json() : { staff: [] }))
      .then(data => {
        setStaffList(data.staff || []);
        setListLoading(false);
      })
      .catch(() => {
        setError('スタッフ一覧を取得できませんでした');
        setListLoading(false);
      });
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!selectedStaffId) {
      setError('名前を選択してください');
      return;
    }
    if (!password) {
      setError('パスワードを入力してください');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ staffId: selectedStaffId, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.push('/');
      } else {
        setError(data.error || '認証に失敗しました');
      }
    } catch {
      setError('エラーが発生しました');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: UI.surfaceAlt,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Noto Sans JP', sans-serif", padding: 16,
    }}>
      <div style={{
        background: UI.surface, borderRadius: 8, padding: '36px 32px', border: `1px solid ${UI.border}`,
        boxShadow: '0 4px 32px rgba(26,95,168,0.12)',
        width: '100%', maxWidth: 400, textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 8,
          background: UI.primary.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 20px',
        }}>🏥</div>
        <div style={{ fontSize: 13, color: '#6b9fd4', fontWeight: 700, marginBottom: 6 }}>
          まつもと糖尿病クリニック
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: UI.text, marginBottom: 8 }}>
          初診事前問診
        </div>
        <div style={{ fontSize: 12, color: '#7a9abf', marginBottom: 20 }}>
          勤怠管理システムのスタッフID・パスワードでログイン
        </div>

        {/* スタッフ選択 */}
        <div style={{ marginBottom: 12, textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#1a2a4a', fontWeight: 700, marginBottom: 6 }}>
            名前
          </label>
          <select
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
            disabled={listLoading}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 15,
              border: `1px solid ${UI.border}`, borderRadius: 6,
              outline: 'none', boxSizing: 'border-box',
              fontFamily: 'inherit',
              background: listLoading ? '#f0f7ff' : '#fff',
            }}
          >
            <option value="">
              {listLoading ? '読み込み中…' : '選択してください'}
            </option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* パスワード */}
        <div style={{ marginBottom: 12, textAlign: 'left' }}>
          <label style={{ display: 'block', fontSize: 12, color: '#1a2a4a', fontWeight: 700, marginBottom: 6 }}>
            パスワード
          </label>
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 15,
              border: `1px solid ${UI.border}`, borderRadius: 6,
              outline: 'none', boxSizing: 'border-box',
              fontFamily: 'inherit', letterSpacing: '0.1em',
            }}
          />
        </div>

        {error && (
          <div style={{ color: '#c53030', fontSize: 13, marginBottom: 12, fontWeight: 700 }}>
            ❌ {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !selectedStaffId || !password}
          style={{
            width: '100%', padding: '13px',
            background: loading || !selectedStaffId || !password
              ? UI.textDisabled : UI.primary.fg,
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700,
            cursor: loading || !selectedStaffId || !password ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '確認中...' : 'ログイン'}
        </button>
      </div>
    </div>
  );
}
