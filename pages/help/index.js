// 完全ガイド集 (hub、 2026-05-31)
//
// 院長指示 (2026-05-31): kinkan / voice と同じく dm-clinic-karte にも完全ガイドを展開。
// まず DM 基本 (2 型糖尿病) の完全ガイドを公開、 他フォームは順次追加予定。
//
// 設計判断:
//   - 1 フォーム = 1 ガイドページ (kinkan/voice と同じ粒度)
//   - 「準備中」 は色を薄く + クリック不可で視覚的に区別
//   - 全フォームの一覧として残し、 後から追加するガイドの動線も同じ画面で見せる
//   - スタッフ・医師の入口 (問診作業中に困ったら参照する) を兼ねる

import Link from 'next/link'
import { useRouter } from 'next/router'
import { UI } from '../../lib/uiTokens'
import { GUIDE } from '../../components/HelpGuide'

// 各ガイドのメタ情報。 ready=true が公開済み、 false は「準備中」。
//
// 色は **カテゴリだけ** が持つ (2026-09-03)。トップ画面・問診フォームと同じ 3 分類:
//   青 = 糖尿病関連 / 緑 = 甲状腺関連 / 紺 = その他
// 以前はガイド 1 本ごとに違う色 (紺/赤/桃/青/橙/緑/紫 の 7 色) を振っていたが、
// 色に意味がないまま数だけ増えて散らかるため、カテゴリ色に一本化した。
const GUIDES = [
  // ----- 糖尿病関連 -----
  { category: '🩺 糖尿病関連', tone: UI.primary.fg, items: [
    { id: 'dm',      label: 'DM 基本 (2 型糖尿病)', emoji: '🩺',  ready: true,  href: '/help/dm',      desc: '6 ステップ完全攻略 + 音声入力 (現病歴/既往歴) + 受付コード運用 + 再生成' },
    { id: 't1d',     label: '1 型糖尿病 (成人)',     emoji: '💉',  ready: false, desc: 'CGM/CSII 機器、 インスリン療法、 低血糖対応 (準備中、 2026-06 公開予定)' },
    { id: 'gdm',     label: '妊娠糖尿病',            emoji: '🤰', ready: false, desc: 'GDM / 糖尿病合併妊娠、 産科連携 (準備中)' },
    { id: 'ped-t1d', label: '小児 1 型糖尿病',      emoji: '👶', ready: false, desc: '小児・思春期、 親への説明、 保育園/学校連携 (準備中)' },
    { id: 'rh',      label: '反応性低血糖',          emoji: '⚡', ready: false, desc: 'RH、 食事との関連、 OGTT 判定 (準備中)' },
  ]},
  // ----- 甲状腺関連 -----
  { category: '🦋 甲状腺関連', tone: UI.success.fg, items: [
    { id: 'thyroid', label: '甲状腺 6 種 (バセドウ/橋本/腫大/腺腫)', emoji: '🦋', ready: false, desc: 'エコー所見ベースのフォーム選択、 確定診断の流れ (準備中)' },
  ]},
  // ----- その他 -----
  { category: '💤 その他', tone: UI.fixed.fg, items: [
    { id: 'sas',     label: '睡眠時無呼吸症候群 (SAS)', emoji: '💤', ready: false, desc: 'CPAP 継続 / 簡易 PSG 検査、 採血で DM 判明時の DM 差分問診 (準備中)' },
  ]},
]

const OPS_TOPICS = [
  { id: 'ops-list',   label: '/list (問診一覧) の運用',  emoji: '📋', ready: false, desc: '30 秒自動更新、 検索、 完了化、 一括処理 (準備中、 DM ガイド内に簡易版あり)' },
  { id: 'ops-detail', label: '/detail/[id] (詳細) の運用', emoji: '🔍', ready: false, desc: 'カルテ表示、 編集、 再生成、 削除、 SAS DM 差分 (準備中、 DM ガイド内に簡易版あり)' },
  { id: 'ops-voice',  label: '音声入力 サブシステム',    emoji: '🎤', ready: false, desc: '語彙リスト、 誤認識補正、 要 DR 確認 (準備中、 DM ガイド内に簡易版あり)' },
  { id: 'ops-prompt', label: 'プロンプト 二重管理',      emoji: '🔁', ready: false, desc: '経路 A / 経路 B 8 ファイル同期 (準備中、 DM ガイド内に簡易版あり)' },
]

export default function HelpIndex() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: UI.surfaceAlt }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 20 }}>
        {/* 戻る + タイトル */}
        <div style={{ marginBottom: 14 }}>
          <button
            onClick={() => router.push('/')}
            style={{ padding: '6px 12px', borderRadius: 6, background: UI.surface, border: `1px solid ${UI.border}`, color: UI.textMuted, fontSize: GUIDE.caption, fontWeight: 700, cursor: 'pointer' }}
          >← トップ</button>
        </div>

        <nav style={{ background: UI.primary.fg, color: UI.surface, padding: '16px 18px', borderRadius: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>📖 完全ガイド集</div>
          <div style={{ fontSize: GUIDE.bodySmall, opacity: 0.92, marginTop: 6, lineHeight: 1.7 }}>
            問診ツールの全フォーム + 運用トピックの完全ガイド。 患者対応で困った時、 新スタッフのオンボーディング時、
            医師がフォームの内部挙動を理解したい時、 ここから該当ガイドを開いてください。
          </div>
        </nav>

        {/* ガイド本体 (フォーム別) */}
        {GUIDES.map((g) => (
          <section key={g.category} style={{ background: UI.surface, borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: GUIDE.card }}>
            <h2 style={{ fontSize: GUIDE.h3, fontWeight: 700, color: g.tone, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${g.tone}33` }}>
              {g.category}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {g.items.map((it) => {
                const body = (
                  <div style={{
                    padding: 14, borderRadius: 8,
                    border: `1px solid ${it.ready ? g.tone + '66' : UI.border}`,
                    background: it.ready ? UI.surface : UI.surfaceAlt,
                    opacity: it.ready ? 1 : 0.65,
                    cursor: it.ready ? 'pointer' : 'not-allowed',
                    transition: 'transform .15s, box-shadow .15s',
                    height: '100%',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 22 }}>{it.emoji}</span>
                      <div style={{ fontWeight: 700, color: it.ready ? g.tone : UI.textFaint, fontSize: GUIDE.bodySmall }}>{it.label}</div>
                      {it.ready
                        ? <span style={{ marginLeft: 'auto', fontSize: 11, background: UI.success.bg, color: UI.success.fg, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>公開中</span>
                        : <span style={{ marginLeft: 'auto', fontSize: 11, background: UI.neutral.bg, color: UI.neutral.fg, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>準備中</span>
                      }
                    </div>
                    <div style={{ fontSize: GUIDE.caption, color: UI.textMuted, lineHeight: 1.7 }}>{it.desc}</div>
                  </div>
                )
                if (it.ready && it.href) {
                  return (
                    <Link key={it.id} href={it.href} legacyBehavior>
                      <a style={{ textDecoration: 'none' }}>{body}</a>
                    </Link>
                  )
                }
                return <div key={it.id}>{body}</div>
              })}
            </div>
          </section>
        ))}

        {/* 運用トピック (将来追加予定) */}
        <section style={{ background: UI.surface, borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: GUIDE.card }}>
          <h2 style={{ fontSize: GUIDE.h3, fontWeight: 700, color: UI.neutral.fg, marginBottom: 12, paddingBottom: 6, borderBottom: `1px solid ${UI.neutral.fg}33` }}>
            ⚙️ 運用トピック (共通)
          </h2>
          <div style={{ fontSize: GUIDE.caption, color: UI.textMuted, marginBottom: 10, lineHeight: 1.7 }}>
            問診フォームを横断する運用トピック。 現在は DM ガイド内に該当章を含めていますが、
            将来的に独立ガイドとして切り出す予定です。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {OPS_TOPICS.map((it) => (
              <div key={it.id} style={{
                padding: 14, borderRadius: 8,
                border: `1px solid ${UI.border}`, background: UI.surfaceAlt, opacity: 0.65,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>{it.emoji}</span>
                  <div style={{ fontWeight: 700, color: UI.textMuted, fontSize: GUIDE.bodySmall }}>{it.label}</div>
                  <span style={{ marginLeft: 'auto', fontSize: 11, background: UI.neutral.bg, color: UI.neutral.fg, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>準備中</span>
                </div>
                <div style={{ fontSize: GUIDE.caption, color: UI.textMuted, lineHeight: 1.7 }}>{it.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ヘルプ Footer */}
        <div style={{ background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: 12, padding: 18, marginTop: 18, fontSize: GUIDE.bodySmall, color: UI.text, lineHeight: 1.9, boxShadow: GUIDE.card }}>
          <strong>💡 まずは DM 基本ガイドから</strong>:<br />
          DM (2 型糖尿病) が最も使用頻度が高いので、 完全ガイドを真っ先に整備しました。
          音声入力サブシステム / プロンプト二重管理 / 受付コード運用 / SAS の DM 差分問診 など、
          他フォームにも共通する重要トピックを 1 本にまとめています。<br /><br />
          他フォームのガイドは順次追加予定です (2026-06 以降)。 急ぎ必要な項目があれば
          院長 or KartePlus 本部 (<a href="mailto:karteplus2026@gmail.com" style={{ color: UI.primary.fg }}>karteplus2026@gmail.com</a>) までご相談ください。
        </div>
      </div>
    </div>
  )
}
