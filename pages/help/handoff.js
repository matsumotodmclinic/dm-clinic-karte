// スタッフ向け「新しい運用の流れ」と「申し送り早見表」（院長依頼 2026-10-14）。
//
// ■ なぜアプリの中に置くか
// 紙だけだと古い版が残る。アプリに置けば、申し送りを足したときに
// lib/handoffCatalog.js を直すだけで全員が見る内容が更新される。
// そのカタログが実際の出力とずれていないことは
// scripts/golden/handoff-catalog.test.mjs が検査しているので、黙って古くなることがない。
//
// ■ 印刷
// 右上の「🖨 印刷」で A4。画面用のボタン類は印刷に出さない（.kp-no-print）。

import Link from 'next/link'
import { UI } from '../../lib/uiTokens'
import { HANDOFF_SECTIONS } from '../../lib/handoffCatalog'

const FONT = "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif"

const FLOW = [
  {
    step: '1',
    title: '問診をアプリに入力する',
    body: '受診の区分に合うフォームを選んで、上から順に入力します。紙に書いてもらってから打ち直す必要はありません。',
  },
  {
    step: '2',
    title: '最後に当日の HbA1c を入れる',
    body: '最終ステップに「当日の HbA1c（院内測定）」の欄があります。採血がまだなら空のままで進めて構いません。10%以上だと腹部エコーと胸部X-Pの予約が申し送りに入ります。',
  },
  {
    step: '3',
    title: 'カルテ文を生成する',
    body: '選択だけで終わった回は AI を使わずその場で出ます。音声や自由記入があった回だけ AI が文章化します。',
  },
  {
    step: '4',
    title: '採血の結果が出たら詳細画面で入れ直す',
    body: '問診より採血が後になった回は、一覧から開いて「当日の HbA1c」を入れて保存し、「🔄 再生成」を押します。事前採血で糖尿病が判明した回は、同じ画面の「DM差分問診」も入力してから再生成します。',
  },
  {
    step: '5',
    title: 'ドクターキューブの事前WEB問診を貼り付ける（あれば）',
    body: '患者さんが来院前にドクターキューブで入力していた回は、その画面からコピーして詳細画面の「ドクターキューブの事前WEB問診」欄に貼り付け、保存してください。印刷用A4の下部に出ます。カルテ本文（電子カルテに貼る文）には入りません。',
  },
  {
    step: '6',
    title: '「🖨 印刷用A4」で印刷して医師に渡す',
    body: '上半分の氏名・生年月日・初事前問診者は空欄で印字されるので手書きしてください。年齢・問診日・受付コードはアプリが入れます。下半分はカルテ全文です。',
  },
]

const CHANGED = [
  ['紙の役割が変わりました', '入力用紙ではなく、アプリが作る出力用紙になりました。患者に書いてもらっていた項目はアプリに一本化されています。'],
  ['紙にあった段取りがカルテに入りました', '体重減少やHbA1c高値での検査追加、妊娠糖尿病の予約3回分、小児慢性の申請確認などが、申し送りに自動で出ます。'],
  ['病名の書き方が実カルテとそろいました', '記号は ♯ に統一され、当院で診る病名と他院で診ている病名は記号ではなく「空行の前か後か」で分かれます。略号もやめて ♯高血圧 ／ ♯脂質異常症 と名前で書きます（以前は ♯HT ／ ♯HL）。電子カルテで病名を検索したときに取りこぼさなくなります。'],
  ['療養計画書は「作成をお願いします」になりました', '実際に作成するのは医師なので、「作成済」とは書かなくなりました。インスリン使用中の方には出ません。'],
]

export default function HandoffHelpPage() {
  return (
    <>
      <style>{`
        .kp-doc { max-width: 190mm; margin: 0 auto; padding: 16px; }
        .kp-card { background: #fff; border: 1px solid ${UI.border}; border-radius: 10px; padding: 18px 20px; margin-bottom: 14px; }
        .kp-h2 { font-size: 17px; font-weight: 700; color: ${UI.text}; margin: 0 0 4px; }
        .kp-note { font-size: 12.5px; color: ${UI.textMuted}; line-height: 1.8; margin: 0 0 12px; }
        .kp-row { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid ${UI.border}; }
        .kp-row:first-of-type { border-top: none; }
        .kp-line { flex: 0 0 42%; font-size: 13px; font-weight: 700; color: ${UI.text}; line-height: 1.7; word-break: break-word; }
        .kp-when { flex: 1; font-size: 12.5px; color: ${UI.textMuted}; line-height: 1.8; }
        .kp-step { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid ${UI.border}; }
        .kp-step:first-of-type { border-top: none; }
        .kp-num { flex: 0 0 26px; height: 26px; border-radius: 50%; background: ${UI.primary.bg}; color: ${UI.primary.fg};
                  font-weight: 700; font-size: 13px; display: flex; align-items: center; justify-content: center; }
        @page { size: A4; margin: 10mm; }
        @media print {
          .kp-no-print { display: none !important; }
          .kp-doc { max-width: none; padding: 0; }
          .kp-card { border: 1px solid #333; break-inside: avoid; }
          body { background: #fff; }
        }
      `}</style>

      <div style={{ background: UI.surfaceAlt, minHeight: '100vh', fontFamily: FONT }}>
        <div className="kp-doc">
          <div className="kp-no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
            <Link href="/help" legacyBehavior>
              <a style={{ padding: '9px 15px', borderRadius: 8, border: `1px solid ${UI.border}`, background: UI.surface, color: UI.textMuted, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                ← ガイド集
              </a>
            </Link>
            <button
              onClick={() => window.print()}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: UI.primary.fg, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              🖨 印刷（A4）
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: UI.textFaint, fontWeight: 700, letterSpacing: '0.08em' }}>まつもと糖尿病クリニック　初診事前問診</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: UI.text, margin: '4px 0 6px' }}>運用の流れと 申し送り早見表</h1>
            <div style={{ fontSize: 12.5, color: UI.textMuted, lineHeight: 1.8 }}>
              2026年10月改訂。入力した内容が医師にどう伝わるかの対応表です。
            </div>
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">問診から医師に渡すまで</h2>
            <p className="kp-note">紙に書いてもらってから打ち直す運用はなくなりました。アプリに入れて、出てきた紙を渡します。</p>
            {FLOW.map(f => (
              <div className="kp-step" key={f.step}>
                <div className="kp-num">{f.step}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: UI.text, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: UI.textMuted, lineHeight: 1.8 }}>{f.body}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">今回の改訂で変わったこと</h2>
            <p className="kp-note">これまで紙や口頭で補っていたものが、カルテに自動で入るようになりました。</p>
            {CHANGED.map(([t, b]) => (
              <div className="kp-row" key={t}>
                <div className="kp-line">{t}</div>
                <div className="kp-when">{b}</div>
              </div>
            ))}
          </div>

          {HANDOFF_SECTIONS.map(sec => (
            <div className="kp-card" key={sec.id}>
              <h2 className="kp-h2">{sec.title}</h2>
              {sec.note && <p className="kp-note">{sec.note}</p>}
              {!sec.note && <div style={{ height: 8 }} />}
              {sec.items.map(it => (
                <div className="kp-row" key={it.match}>
                  <div className="kp-line">{it.match}</div>
                  <div className="kp-when">{it.when}</div>
                </div>
              ))}
            </div>
          ))}

          <div style={{ fontSize: 11, color: UI.textDisabled, textAlign: 'center', marginTop: 10, lineHeight: 1.8 }}>
            この表はアプリの出力から自動で検査されています。申し送りが増えたらここにも必ず載ります。
          </div>
        </div>
      </div>
    </>
  )
}
