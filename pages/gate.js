import { useState } from 'react'

export default function GatePage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/gate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error || 'パスワードが違います')
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0d1b3a 0%, #1a365d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        padding: '48px 40px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: '#1a365d', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, margin: '0 auto 16px',
          }}>🔒</div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>
            まつもと糖尿病クリニック
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a365d' }}>
            アクセス認証
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 10, lineHeight: 1.6 }}>
            アプリに入るための<br />
            共通パスワードを入力してください
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="共通パスワード"
              autoFocus
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: 16,
                border: '2px solid #e0e0e0',
                borderRadius: 10,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#ffebee',
              color: '#c62828',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              background: loading || !password ? '#90a4ae' : '#1565c0',
              border: 'none',
              borderRadius: 10,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '確認中...' : '入場'}
          </button>
        </form>

        <div style={{
          marginTop: 20, fontSize: 11, color: '#90a4ae', textAlign: 'center', lineHeight: 1.6,
        }}>
          このデバイスでは30日間、再入力不要になります
        </div>
      </div>
    </div>
  )
}
