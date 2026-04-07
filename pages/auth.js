import { useState } from 'react';
import { useRouter } from 'next/router';

export default function AuthPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push('/');
      } else {
        setError('パスワードが正しくありません');
      }
    } catch {
      setError('エラーが発生しました');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e8f0fe, #f0f7ff)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Noto Sans JP', sans-serif", padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 32px',
        boxShadow: '0 4px 32px rgba(26,95,168,0.12)',
        width: '100%', maxWidth: 360, textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #1a5fa8, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 20px',
        }}>🏥</div>
        <div style={{ fontSize: 13, color: '#6b9fd4', fontWeight: 700, marginBottom: 6 }}>
          まつもと糖尿病クリニック
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1a2a4a', marginBottom: 8 }}>
          初診事前問診
        </div>
        <div style={{ fontSize: 13, color: '#7a9abf', marginBottom: 28 }}>
          パスワードを入力してください
        </div>
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{
            width: '100%', padding: '12px 16px', fontSize: 16,
            border: '1.5px solid #d0dff5', borderRadius: 10,
            outline: 'none', boxSizing: 'border-box', marginBottom: 12,
            fontFamily: 'inherit', textAlign: 'center', letterSpacing: '0.2em',
          }}
        />
        {error && (
          <div style={{ color: '#c53030', fontSize: 13, marginBottom: 12, fontWeight: 700 }}>
            ❌ {error}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !password}
          style={{
            width: '100%', padding: '13px',
            background: loading || !password ? '#a0c0e8' : 'linear-gradient(135deg, #1a5fa8, #3b82f6)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 800, cursor: loading || !password ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '確認中...' : '入室する'}
        </button>
      </div>
    </div>
  );
}
