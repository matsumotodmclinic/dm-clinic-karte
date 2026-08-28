// トップ（フォーム選択ハブ）
//
// 2026-08-29 デザイン刷新: 勤怠アプリと作法を統一した。
//   - 絵文字アイコン → 線画SVG (components/LineIcon.js)
//   - グラデーション → ベタ塗り
//   - フォームごとの色 → カテゴリごとの色トークン (lib/uiTokens.js)
//     ＝ 色は「どのカテゴリか」という意味だけを担う。フォームごとに色を変えない
//   - 角丸を 10px に統一
// 文言は一切変更していない（ボタンの絵文字だけ除去。勤怠の
// 「ラベルは文字列一致・絵文字は除く」ルールに合わせたもの）。

import { useState } from 'react';
import { useRouter } from 'next/router';
import { UI } from '../lib/uiTokens';
import LineIcon from '../components/LineIcon';

// 色は意味を担う: 青=糖尿病関連(中核) / 緑=甲状腺関連 / 紺=その他
const CATEGORIES = [
  {
    id: 'dm',
    label: '糖尿病関連',
    sublabel: '2型DM / 1型DM / 妊娠糖尿病 / 小児1型 / 反応性低血糖',
    icon: 'stethoscope',
    tone: UI.primary,
    formats: [
      { id: 'dm',      href: '/dm',      label: 'DM基本',       sublabel: '2型糖尿病',            icon: 'stethoscope' },
      { id: 't1d',     href: '/t1d',     label: '1型糖尿病',     sublabel: '成人',                icon: 'syringe' },
      { id: 'gdm',     href: '/gdm',     label: '妊娠糖尿病',    sublabel: 'GDM / 糖尿病合併妊娠', icon: 'pregnancy' },
      { id: 'ped-t1d', href: '/ped-t1d', label: '小児1型糖尿病', sublabel: '小児・思春期',          icon: 'parent-child' },
      { id: 'rh',      href: '/rh',      label: '反応性低血糖',  sublabel: 'RH',                   icon: 'glucose-drop' },
    ],
  },
  {
    id: 'thyroid',
    label: '甲状腺関連',
    sublabel: 'バセドウ病（初診・継続）/ 橋本病 / 甲状腺腫大 / 腺腫（経過・悪性疑い）',
    icon: 'thyroid',
    tone: UI.success,
    formats: [
      { id: 'basedow-new',   href: '/thyroid?type=basedow-new',   label: 'バセドウ病（初診）',     sublabel: 'エコー上バセドウパターン・初診', icon: 'thyroid' },
      { id: 'basedow-cont',  href: '/thyroid?type=basedow-cont',  label: 'バセドウ病（継続）',     sublabel: '他院からの転院・継続治療',       icon: 'thyroid' },
      { id: 'hashimoto',     href: '/thyroid?type=hashimoto',     label: '橋本病',                 sublabel: '甲状腺機能低下症疑い',           icon: 'thyroid' },
      { id: 'nodule-normal', href: '/thyroid?type=nodule-normal', label: '甲状腺腫大（異常なし）', sublabel: 'エコー上明らかな異常なし',        icon: 'thyroid' },
      { id: 'adenoma',       href: '/thyroid?type=adenoma',       label: '甲状腺腺腫（経過観察）', sublabel: '結節あり・悪性低リスク',          icon: 'thyroid' },
      { id: 'malignant',     href: '/thyroid?type=malignant',     label: '甲状腺腺腫（悪性疑い）', sublabel: '結節あり・悪性リスクあり',        icon: 'thyroid' },
    ],
  },
  {
    id: 'other',
    label: 'その他',
    sublabel: '高血圧・脂質異常症 / 内分泌 / 睡眠時無呼吸症候群',
    icon: 'moon',
    tone: UI.fixed,
    formats: [
      { id: 'hthl',      href: '/hthl',      label: '高血圧・脂質異常症', sublabel: 'HT / HL',           icon: 'heart-pulse' },
      { id: 'endocrine', href: '/endocrine', label: '内分泌',             sublabel: '主病名は医師が問診', icon: 'molecule' },
      { id: 'sas',       href: '/sas',       label: '睡眠時無呼吸症候群', sublabel: 'SAS / CPAP継続',     icon: 'moon' },
    ],
  },
];

const FONT = "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif";

// アイコンチップ（淡色の丸 + 単色ストローク）
function IconChip({ name, tone, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: tone.bg, color: tone.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <LineIcon name={name} size={size * 0.5} />
    </div>
  );
}

// ヘッダーの操作ボタン
function ToolButton({ icon, label, onClick, tone, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 15px', borderRadius: 8,
        border: `1px solid ${UI.border}`, background: UI.surface,
        color: tone.fg, fontWeight: 700, fontSize: 13.5,
        cursor: 'pointer', fontFamily: FONT,
      }}
    >
      <LineIcon name={icon} size={17} />
      {label}
    </button>
  );
}

export default function TopPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) return;
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/auth');
  };

  const cat = selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory) : null;

  // カード共通スタイル（カテゴリ / フォームで大きさだけ変える）
  const card = (tone) => ({
    display: 'flex', alignItems: 'center', gap: 15,
    background: UI.surface,
    border: `1px solid ${UI.border}`,
    borderLeft: `3px solid ${tone.fg}`,
    borderRadius: 10,
    cursor: 'pointer', textAlign: 'left', width: '100%',
    fontFamily: FONT,
    transition: 'background 0.12s, border-color 0.12s',
  });

  const hoverOn  = (e, tone) => { e.currentTarget.style.background = tone.bg; };
  const hoverOff = (e) => { e.currentTarget.style.background = UI.surface; };

  return (
    <div style={{
      minHeight: '100vh',
      background: UI.surfaceAlt,
      fontFamily: FONT,
      padding: '28px 16px 44px',
    }}>
      {/* ヘッダー */}
      <div style={{ maxWidth: 640, margin: '0 auto 20px' }}>
        <div style={{ fontSize: 12, color: UI.textFaint, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 4 }}>
          まつもと糖尿病クリニック
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: UI.text, letterSpacing: '0.01em' }}>
          初診事前問診
        </div>
        <div style={{ fontSize: 13, color: UI.textMuted, marginTop: 6 }}>
          {cat ? `${cat.label}のフォームを選択してください` : '該当するカテゴリを選択してください'}
        </div>
      </div>

      {/* スタッフ向けボタン (左: 参照資料 / 右: 運用) */}
      <div style={{ maxWidth: 640, margin: '0 auto 18px', display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ToolButton icon="book" label="完全ガイド" tone={UI.primary}
            title="問診ツールの操作マニュアル (DM/T1D/SAS 等、 フォーム別)"
            onClick={() => router.push('/help')} />
          <ToolButton icon="book-medical" label="院内ハンドブック" tone={UI.success}
            title="糖尿病の知識・スタッフ対応事典 (低血糖時の対応など)"
            onClick={() => router.push('/handbook')} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <ToolButton icon="clipboard" label="問診一覧" tone={UI.primary}
            onClick={() => router.push('/list')} />
          <ToolButton icon="logout" label="ログアウト" tone={UI.neutral}
            onClick={handleLogout} />
        </div>
      </div>

      {/* カテゴリ選択 or フォーム一覧 */}
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!cat ? (
          CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              style={{ ...card(c.tone), padding: '18px 20px' }}
              onMouseOver={e => hoverOn(e, c.tone)}
              onMouseOut={hoverOff}
            >
              <IconChip name={c.icon} tone={c.tone} size={46} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: UI.text, marginBottom: 4 }}>
                  {c.label}
                </div>
                <div style={{ fontSize: 12, color: UI.textMuted, lineHeight: 1.6 }}>
                  {c.sublabel}
                </div>
              </div>
              <span style={{ color: UI.textDisabled, display: 'flex', flexShrink: 0 }}>
                <LineIcon name="chevron" size={18} />
              </span>
            </button>
          ))
        ) : (
          <>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{
                alignSelf: 'flex-start', padding: '7px 13px', borderRadius: 8,
                border: `1px solid ${UI.border}`, background: UI.surface,
                color: UI.textMuted, fontWeight: 700, fontSize: 12,
                cursor: 'pointer', marginBottom: 2, fontFamily: FONT,
              }}
            >
              ← カテゴリに戻る
            </button>

            {/* カテゴリヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 2, marginBottom: 2 }}>
              <div style={{ width: 3, height: 18, borderRadius: 2, background: cat.tone.fg }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: cat.tone.fg, letterSpacing: '0.04em' }}>
                {cat.label}
              </div>
            </div>

            {cat.formats.map((f) => (
              <button
                key={f.id}
                onClick={() => router.push(f.href)}
                style={{ ...card(cat.tone), padding: '14px 18px' }}
                onMouseOver={e => hoverOn(e, cat.tone)}
                onMouseOut={hoverOff}
              >
                <IconChip name={f.icon} tone={cat.tone} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: UI.text, marginBottom: 2 }}>
                    {f.label}
                  </div>
                  <div style={{ fontSize: 12, color: UI.textMuted }}>
                    {f.sublabel}
                  </div>
                </div>
                <span style={{ color: UI.textDisabled, display: 'flex', flexShrink: 0 }}>
                  <LineIcon name="chevron" size={17} />
                </span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* フッター */}
      <div style={{ textAlign: 'center', fontSize: 11, color: UI.textDisabled, marginTop: 28 }}>
        個人情報は院内のみで使用されます
      </div>
    </div>
  );
}
