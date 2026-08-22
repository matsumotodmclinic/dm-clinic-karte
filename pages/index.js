import { useState } from 'react';
import { useRouter } from 'next/router';

const CATEGORIES = [
  {
    id: 'dm',
    label: '糖尿病関連',
    sublabel: '2型DM / 1型DM / 妊娠糖尿病 / 小児1型 / 反応性低血糖',
    emoji: '🩺',
    color: '#1a5fa8',
    bg: 'linear-gradient(135deg, #e8f0fe, #f0f7ff)',
    border: '#bcd4f8',
    formats: [
      { id: 'dm',      href: '/dm',      label: 'DM基本',       sublabel: '2型糖尿病',            emoji: '🩺',  color: '#1a5fa8', bg: 'linear-gradient(135deg, #e8f0fe, #f0f7ff)', border: '#bcd4f8' },
      { id: 't1d',     href: '/t1d',     label: '1型糖尿病',     sublabel: '成人',                emoji: '💉',  color: '#c53030', bg: 'linear-gradient(135deg, #fff5f5, #fef2f2)', border: '#feb2b2' },
      { id: 'gdm',     href: '/gdm',     label: '妊娠糖尿病',    sublabel: 'GDM / 糖尿病合併妊娠', emoji: '🤰', color: '#c05c8a', bg: 'linear-gradient(135deg, #fff0f7, #fff5fb)', border: '#f0b8d4' },
      { id: 'ped-t1d', href: '/ped-t1d', label: '小児1型糖尿病', sublabel: '小児・思春期',          emoji: '👶', color: '#3182ce', bg: 'linear-gradient(135deg, #e8f4ff, #f0f7ff)', border: '#90cdf4' },
      { id: 'rh',      href: '/rh',      label: '反応性低血糖',  sublabel: 'RH',                   emoji: '⚡', color: '#b45309', bg: 'linear-gradient(135deg, #fffbf0, #fff8f0)', border: '#f6ad55' },
    ],
  },
  {
    id: 'thyroid',
    label: '甲状腺関連',
    sublabel: 'バセドウ病（初診・継続）/ 橋本病 / 甲状腺腫大 / 腺腫（経過・悪性疑い）',
    emoji: '🦋',
    color: '#0d7d6a',
    bg: 'linear-gradient(135deg, #e6fff8, #f0fdf9)',
    border: '#81e6d9',
    formats: [
      { id: 'basedow-new',   href: '/thyroid?type=basedow-new',   label: 'バセドウ病（初診）',     sublabel: 'エコー上バセドウパターン・初診',  emoji: '🦋', color: '#0d7d6a', bg: 'linear-gradient(135deg, #e6fff8, #f0fdf9)', border: '#81e6d9' },
      { id: 'basedow-cont',  href: '/thyroid?type=basedow-cont',  label: 'バセドウ病（継続）',     sublabel: '他院からの転院・継続治療',        emoji: '🦋', color: '#276749', bg: 'linear-gradient(135deg, #e6f7ee, #f0fdf5)', border: '#9ae6b4' },
      { id: 'hashimoto',     href: '/thyroid?type=hashimoto',     label: '橋本病',                 sublabel: '甲状腺機能低下症疑い',            emoji: '🦋', color: '#2b6cb0', bg: 'linear-gradient(135deg, #e8f4ff, #f0f7ff)', border: '#90cdf4' },
      { id: 'nodule-normal', href: '/thyroid?type=nodule-normal', label: '甲状腺腫大（異常なし）', sublabel: 'エコー上明らかな異常なし',         emoji: '🦋', color: '#5a4fa8', bg: 'linear-gradient(135deg, #f7faff, #f0f4ff)', border: '#c8c0ee' },
      { id: 'adenoma',       href: '/thyroid?type=adenoma',       label: '甲状腺腺腫（経過観察）', sublabel: '結節あり・悪性低リスク',           emoji: '🦋', color: '#b45309', bg: 'linear-gradient(135deg, #fff8f0, #fffaf5)', border: '#f6ad55' },
      { id: 'malignant',     href: '/thyroid?type=malignant',     label: '甲状腺腺腫（悪性疑い）', sublabel: '結節あり・悪性リスクあり',         emoji: '🦋', color: '#c53030', bg: 'linear-gradient(135deg, #fff5f5, #fef2f2)', border: '#feb2b2' },
    ],
  },
  {
    id: 'other',
    label: 'その他',
    sublabel: '高血圧・脂質異常症 / 内分泌 / 睡眠時無呼吸症候群',
    emoji: '🌙',
    color: '#5a4fa8',
    bg: 'linear-gradient(135deg, #eef2fb, #f5f4ff)',
    border: '#c8c0ee',
    formats: [
      { id: 'hthl', href: '/hthl', label: '高血圧・脂質異常症',   sublabel: 'HT / HL',        emoji: '💊', color: '#2d8653', bg: 'linear-gradient(135deg, #e8f8ee, #f0fff4)', border: '#9ae6b4' },
      { id: 'endocrine', href: '/endocrine', label: '内分泌',       sublabel: '主病名は医師が問診', emoji: '🧬', color: '#0e7490', bg: 'linear-gradient(135deg, #e6f7fb, #f0fbff)', border: '#7dd3e8' },
      { id: 'sas',  href: '/sas',  label: '睡眠時無呼吸症候群', sublabel: 'SAS / CPAP継続', emoji: '🌙', color: '#5a4fa8', bg: 'linear-gradient(135deg, #eef2fb, #f5f4ff)', border: '#c8c0ee' },
    ],
  },
];

export default function TopPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) return;
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/auth');
  };

  const cat = selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory) : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f4ff 0%, #f7faff 50%, #f0f7f4 100%)',
      fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif",
      padding: '32px 16px 48px',
    }}>
      {/* ヘッダー */}
      <div style={{ maxWidth: 640, margin: '0 auto 24px', textAlign: 'center' }}>
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
          {cat ? `${cat.label}のフォームを選択してください` : '該当するカテゴリを選択してください'}
        </div>
      </div>

      {/* スタッフ向けボタン (左: 参照資料 / 右: 運用)、 2026-05-31 院長指示で完全ガイド+院内ハンドブックを追加 */}
      <div style={{ maxWidth: 640, margin: '0 auto 20px', display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {/* 左: スタッフ参照資料 (患者対応中の困りごと解決用) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/help')}
            style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #c8e0f5', background: '#f0f7ff', color: '#1a5fa8', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            title="問診ツールの操作マニュアル (DM/T1D/SAS 等、 フォーム別)"
          >
            📖 完全ガイド
          </button>
          <button
            onClick={() => router.push('/handbook')}
            style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #c8e6c9', background: '#f1f8e9', color: '#2e7d32', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            title="糖尿病の知識・スタッフ対応事典 (低血糖時の対応など)"
          >
            📚 院内ハンドブック
          </button>
        </div>
        {/* 右: 運用ボタン */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/list')}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #d0dff5', background: '#fff', color: '#1a5fa8', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            📋 問診一覧
          </button>
          <button
            onClick={handleLogout}
            style={{ padding: '10px 20px', borderRadius: 10, border: '1.5px solid #feb2b2', background: '#fff', color: '#c53030', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* カテゴリ選択 or フォーム一覧 */}
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!cat ? (
          /* カテゴリ選択画面 */
          CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 18,
                background: c.bg,
                border: `2px solid ${c.border}`,
                borderRadius: 18,
                padding: '22px 24px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.07)';
              }}
            >
              <div style={{
                width: 58, height: 58, borderRadius: 16,
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, flexShrink: 0,
                boxShadow: `0 2px 10px ${c.color}25`,
              }}>
                {c.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: c.color, marginBottom: 5 }}>
                  {c.label}
                </div>
                <div style={{ fontSize: 12, color: '#8899aa', fontWeight: 500, lineHeight: 1.5 }}>
                  {c.sublabel}
                </div>
              </div>
              <div style={{ fontSize: 22, color: c.color, opacity: 0.5, flexShrink: 0 }}>›</div>
            </button>
          ))
        ) : (
          /* フォーム一覧画面 */
          <>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                alignSelf: 'flex-start', padding: '7px 14px', borderRadius: 8,
                border: `1.5px solid ${cat.border}`, background: '#fff',
                color: cat.color, fontWeight: 700, fontSize: 12, cursor: 'pointer', marginBottom: 4,
              }}
            >
              ← カテゴリに戻る
            </button>

            {/* カテゴリヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 4 }}>
              <div style={{ width: 4, height: 22, borderRadius: 2, background: cat.color }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: cat.color, letterSpacing: '0.05em' }}>
                {cat.label}
              </div>
            </div>

            {cat.formats.map((f) => (
              <button
                key={f.id}
                onClick={() => router.push(f.href)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: f.bg,
                  border: `2px solid ${f.border}`,
                  borderRadius: 16,
                  padding: '16px 20px',
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
                <div style={{
                  width: 50, height: 50, borderRadius: 14,
                  background: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                  boxShadow: `0 2px 8px ${f.color}30`,
                }}>
                  {f.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: f.color, marginBottom: 3 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#8899aa', fontWeight: 500 }}>
                    {f.sublabel}
                  </div>
                </div>
                <div style={{ fontSize: 20, color: f.color, opacity: 0.5, flexShrink: 0 }}>›</div>
              </button>
            ))}
          </>
        )}
      </div>

      {/* フッター */}
      <div style={{ textAlign: 'center', fontSize: 11, color: '#a0b8d0', marginTop: 32 }}>
        個人情報は院内のみで使用されます
      </div>
    </div>
  );
}
