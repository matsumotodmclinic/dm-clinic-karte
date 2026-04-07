import { useRouter } from 'next/router';

const FORMATS = [
  {
    id: 'dm',
    href: '/dm',
    label: 'DM基本',
    sublabel: '2型糖尿病',
    emoji: '🩺',
    color: '#1a5fa8',
    bg: 'linear-gradient(135deg, #e8f0fe, #f0f7ff)',
    border: '#bcd4f8',
  },
  {
    id: 'hthl',
    href: '/hthl',
    label: '高血圧・脂質異常症',
    sublabel: 'HT / HL',
    emoji: '💊',
    color: '#2d8653',
    bg: 'linear-gradient(135deg, #e8f8ee, #f0fff4)',
    border: '#9ae6b4',
  },
  {
    id: 't1d',
    href: '/t1d',
    label: '1型糖尿病',
    sublabel: '成人',
    emoji: '💉',
    color: '#c53030',
    bg: 'linear-gradient(135deg, #fff5f5, #fef2f2)',
    border: '#feb2b2',
  },
  {
    id: 'gdm',
    href: '/gdm',
    label: '妊娠糖尿病',
    sublabel: 'GDM / 糖尿病合併妊娠',
    emoji: '🤰',
    color: '#c05c8a',
    bg: 'linear-gradient(135deg, #fff0f7, #fff5fb)',
    border: '#f0b8d4',
  },
  {
    id: 'ped-t1d',
    href: '/ped-t1d',
    label: '小児1型糖尿病',
    sublabel: '小児・思春期',
    emoji: '👶',
    color: '#3182ce',
    bg: 'linear-gradient(135deg, #e8f4ff, #f0f7ff)',
    border: '#90cdf4',
  },
  {
    id: 'rh',
    href: '/rh',
    label: '反応性低血糖',
    sublabel: 'RH',
    emoji: '⚡',
    color: '#b45309',
    bg: 'linear-gradient(135deg, #fffbf0, #fff8f0)',
    border: '#f6ad55',
  },
];

export default function TopPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f4ff 0%, #f7faff 50%, #f0f7f4 100%)',
      fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
      padding: '32px 16px 48px',
    }}>
      {/* ヘッダー */}
      <div style={{ maxWidth: 640, margin: '0 auto 32px', textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #1a5fa8, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, margin: '0 auto 16px',
          boxShadow: '0 4px 20px rgba(26,95,168,0.2)',
        }}>🏥</div>
        <div style={{ fontSize: 13, color: '#6b9fd4', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 6 }}>
          まつもと糖尿病クリニック
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#1a2a4a', marginBottom: 8 }}>
          初診事前問診
        </div>
        <div style={{ fontSize: 14, color: '#7a9abf', lineHeight: 1.7 }}>
          該当するフォーマットを選択してください
        </div>
      </div>

      {/* フォーマット選択カード */}
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => router.push(f.href)}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: f.bg,
              border: `2px solid ${f.border}`,
              borderRadius: 16,
              padding: '18px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
            }}
          >
            {/* アイコン */}
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, flexShrink: 0,
              boxShadow: `0 2px 8px ${f.color}30`,
            }}>
              {f.emoji}
            </div>
            {/* テキスト */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: f.color, marginBottom: 3 }}>
                {f.label}
              </div>
              <div style={{ fontSize: 12, color: '#8899aa', fontWeight: 500 }}>
                {f.sublabel}
              </div>
            </div>
            {/* 矢印 */}
            <div style={{ fontSize: 20, color: f.color, opacity: 0.5, flexShrink: 0 }}>›</div>
          </button>
        ))}
      </div>

      {/* フッター */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#a0b8d0', marginTop: 32 }}>
        個人情報は院内のみで使用されます
      </div>
    </div>
  );
}
