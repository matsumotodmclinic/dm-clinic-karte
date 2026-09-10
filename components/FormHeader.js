// 問診フォーム共通のヘッダー（← トップ / 完全ガイド / 施設名+タイトル / フォーム名チップ）。
//
// 2026-09-11 新設。9 つの *IntakeTool.js に同じ行が直書きされていたのを 1 箇所に集約した。
// きっかけは携帯インストール対応で viewport meta を入れたこと。携帯 (幅 375px) では
// 実寸で描かれるようになり、1 行に収まらずタイトルもチップも折り返して崩れていた。
//
// 携帯幅 (600px 以下) では 2 段にする:
//   1 段目: [← トップ] [完全ガイド]            [フォーム名]
//   2 段目: まつもと糖尿病クリニック / 初診事前問診
// iPad・PC (601px 以上) は従来どおり 1 行。
// inline style では @media が書けないので、この部品だけ <style> を持つ（CSS ファイルは作らない方針のまま）。

import { useRouter } from 'next/router'
import { UI } from '../lib/uiTokens'

const CSS = `
.kp-fh{display:flex;align-items:center;flex-wrap:wrap;gap:12px}
.kp-fh-title{flex:1 1 auto;min-width:0}
.kp-fh-nowrap{white-space:nowrap}
@media (max-width:600px){
  .kp-fh{gap:8px 10px}
  .kp-fh-title{order:10;flex-basis:100%}
}
`

/**
 * @param {object} props
 * @param {{fg:string,bg:string}} props.tone   カテゴリ色（lib/uiTokens の UI.*）
 * @param {string} props.label                 フォーム名チップ（例: 'DM基本'）
 * @param {string} [props.title]               タイトル（既定 '初診事前問診'）
 * @param {string} [props.backLabel]           戻るボタンの文言（既定 '← トップ'）
 * @param {string} [props.helpHref]            完全ガイドの URL。渡したときだけボタンを出す（別タブで開く）
 */
export default function FormHeader({ tone, label, title = '初診事前問診', backLabel = '← トップ', helpHref }) {
  const router = useRouter()
  return (
    <>
      <style>{CSS}</style>
      <div className="kp-fh">
        <button
          onClick={() => router.push('/')}
          className="kp-fh-nowrap"
          style={{ padding: '6px 11px', borderRadius: 6, border: `1px solid ${UI.border}`, background: UI.surface, color: UI.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
        >
          {backLabel}
        </button>
        {helpHref && (
          // 📖 完全ガイド (スタッフ用、 2026-05-31 追加): 別タブで開くので患者の問診入力を中断しない
          <a
            href={helpHref}
            target="_blank"
            rel="noopener noreferrer"
            className="kp-fh-nowrap"
            title="完全ガイドを別タブで開く (スタッフ用)"
            style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${UI.border}`, background: UI.surface, color: tone.fg, fontWeight: 700, fontSize: 11, cursor: 'pointer', textDecoration: 'none' }}
          >
            📖 完全ガイド
          </a>
        )}
        <div className="kp-fh-title">
          <div className="kp-fh-nowrap" style={{ fontSize: 11, color: UI.textFaint, fontWeight: 700, letterSpacing: '0.08em' }}>まつもと糖尿病クリニック</div>
          <div className="kp-fh-nowrap" style={{ fontSize: 19, fontWeight: 700, color: UI.text }}>{title}</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <span className="kp-fh-nowrap" style={{ fontSize: 12, background: tone.bg, color: tone.fg, padding: '4px 12px', borderRadius: 4, fontWeight: 700 }}>{label}</span>
        </div>
      </div>
    </>
  )
}
