// 医師への引継ぎ用 A4（印刷）。2026-10-14 院長の指示で新設。
//
// ■ なぜ作ったか
// それまでスタッフは「紙に患者が書いた内容をアプリに打ち直し」ていた。
// 紙を**入力用紙から出力用紙に変える**ことで二重入力が消える。
//   上部 = 手書き欄（アプリが持たない情報）／下部 = 生成されたカルテ全文
//
// ■ 上部が手書きなのは設計上の制約（崩さないこと）
// このアプリは **氏名・生年月日・住所・電話を保存しない**（匿名化設計。商品化のときの売り）。
// なので氏名と生年月日は**空の罫線として印字**し、受付が手で書く。院長確定 2026-10-14。
// アプリが知っていて印字できるのは 年齢・問診日・受付コード だけ。
//
// ■ 載せないもの（院長 2026-10-14・いずれも「カルテ情報で確認できる」ため）
// 健康保険 / 市 / 通院歴 / 紹介状の持参 / 過去の治療内容 / HbA1c / 身長 / 体重 /
// 体重減少 / しびれ / 連絡先 / 当院を知ったきっかけ / 事前採血・診療の予約日 /
// 療養計画書 / 診療科変更 / DQ予約
// → これらは生成カルテの本文か申し送りに入っている。紙に二度書かない。

// ■ ドクターキューブの事前WEB問診（院長依頼 2026-10-14）
// 患者が来院前にドクターキューブで入力した内容を、詳細画面で貼り付けてここに印字する。
// **カルテ本文（電子カルテに貼る文）には入れない**（院長確定）。生成カルテの書式を崩さないため。
//
// ■ 1 枚に収める（院長「A4 についてはかわらず 1 枚で出してほしい」）
// 内容が増えると 1 枚に入らない。**全体を縮小して 1 枚に収める**（切らない・2 枚目に送らない）。
// ★これを入れて分かったこと: 1型・小児1型はカルテが 54 行あり、**貼り付けが無くても
//   はみ出していた**（11.5px × 行間1.75 で約 311mm・A4 の印字領域は 281mm）。
// 縮小率は画面に出す。下限まで縮めても入らないときは画面で警告する（黙って切らない）。

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { UI } from '../../lib/uiTokens'
import { splitDrQube } from '../../lib/drQube'

// 問診日は西暦（院長確定 2026-10-14）。カルテ本文は和暦だが、ここは受付が見る欄なので揃えない。
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const CSS = `
.kp-print { width: 190mm; margin: 0 auto; padding: 12mm 10mm; background: #fff; }
/* ★幅は常に A4 ぶん（190mm）に固定する。max-width にすると狭い画面で折り返しが増え、
   「1 枚に収める」計算が画面幅に引きずられる（実測: 画面を細くすると縮小率 2% まで落ちた）。
   画面が狭いときは横スクロールさせる（印刷のためのページなので、見た目より寸法を優先） */
.kp-print-scroll { overflow-x: auto; }
.kp-print-head { border: 1px solid #333; padding: 10px 14px; margin-bottom: 10px; }
.kp-print-row { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 6px 18px; margin-bottom: 10px; }
.kp-print-row:last-child { margin-bottom: 0; }
.kp-print-item { display: flex; align-items: flex-end; gap: 6px; }
.kp-print-label { font-size: 11px; font-weight: 700; white-space: nowrap; }
/* 手書き欄。下線だけを引いて書けるようにする */
.kp-print-fill { border-bottom: 1px solid #333; min-width: 120px; height: 20px; }
.kp-print-fill-sm { min-width: 56px; }
.kp-print-value { font-size: 13px; font-weight: 700; border-bottom: 1px solid #333; min-width: 72px; padding: 0 4px 1px; }
.kp-print-karte {
  white-space: pre-wrap; word-break: break-word;
  font-size: 11.5px; line-height: 1.55;
  font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif;
}
/* ★貼り付けがある回は「左=カルテ / 右=ドクターキューブ」の横並び（院長案 2026-10-14）。
   上下に積むと縮小 70%（カルテ 8.1px）まで落ちるが、横並びなら 96%（11.1px）で収まる。
   カルテは 70% 幅でも ♯行・【】行・□行が折り返さない（実測: 折り返すのは末尾の長い 1 行だけで
   980px → 998px）。60% まで削ると折り返しが増えて逆に背が伸びる（1082px → 1099px）ので 70% にした。 */
.kp-print-cols { display: flex; gap: 5mm; align-items: flex-start; }
.kp-print-cols > .kp-print-karte { flex: 0 0 70%; }
.kp-print-dq {
  flex: 1; border: 1px solid #333; padding: 8px 10px;
  white-space: pre-wrap; word-break: break-word;
  font-size: 10.5px; line-height: 1.6; font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif;
}
.kp-print-dq-head { font-size: 10.5px; font-weight: 700; margin-bottom: 6px; }
/* 【項目】ごとに間を空ける。ベタ打ちのままだと項目の切れ目が読み取れない */
.kp-print-dq-block { margin-bottom: 5px; }
/* 縮小は transform でかける。font-size を個別に下げると行間や枠が崩れるため */
.kp-print-fit { transform-origin: top left; }
@page { size: A4; margin: 8mm; }
@media print {
  .kp-no-print { display: none !important; }
  .kp-print { max-width: none; padding: 0; }
  body { background: #fff; }
}
`

export default function PrintPage() {
  const router = useRouter()
  const { id } = router.query
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const [overflow, setOverflow] = useState(false)
  const fitRef = useRef(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/questionnaire/detail?id=${id}`)
      .then(r => r.json())
      .then(data => { setRecord(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  // A4 の印字領域（@page margin 8mm）。CSS の 1mm = 96/25.4 px。
  // 2% だけ余裕をみる（プリンタの余白設定で数 mm 変わるため）
  const PAGE_H = (297 - 8 * 2) * (96 / 25.4) * 0.98
  const MIN_SCALE = 0.62   // これ以上は読めないので縮めない（警告を出す）

  useEffect(() => {
    const el = fitRef.current
    if (!el) return
    el.style.transform = 'none'
    const h = el.scrollHeight
    // 画面に出ていないと 0 が返る。そのときは縮めない（勝手に極小で印刷されるのを防ぐ）
    if (!h) { setScale(1); setOverflow(false); return }
    const s = h > PAGE_H ? Math.max(MIN_SCALE, PAGE_H / h) : 1
    setScale(s)
    setOverflow(h * s > PAGE_H + 1)
  }, [record])

  if (loading) return <div style={{ padding: 32, fontFamily: "'Noto Sans JP', sans-serif" }}>読み込み中…</div>
  if (!record) return <div style={{ padding: 32, fontFamily: "'Noto Sans JP', sans-serif" }}>見つかりませんでした</div>

  return (
    <>
      <style>{CSS}</style>
      <div style={{ background: UI.surfaceAlt, minHeight: '100vh', fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif" }}>
        {/* 画面でだけ出る操作列。印刷には出ない */}
        <div className="kp-no-print" style={{ maxWidth: 190, margin: '0 auto', padding: '16px 0', display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 760 }}>
          <button
            onClick={() => router.push(`/detail/${id}`)}
            style={{ padding: '9px 15px', borderRadius: 8, border: `1px solid ${UI.border}`, background: UI.surface, color: UI.textMuted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            ← 詳細に戻る
          </button>
          <button
            onClick={() => window.print()}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: UI.primary.fg, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            🖨 印刷
          </button>
          {scale < 1 && !overflow && (
            <span style={{ alignSelf: 'center', fontSize: 12, color: UI.textMuted }}>
              1 枚に収めるため {Math.round(scale * 100)}% に縮小しています
            </span>
          )}
          {overflow && (
            <span style={{ alignSelf: 'center', fontSize: 12, color: UI.danger.fg, fontWeight: 700 }}>
              ⚠️ これ以上縮めると読めないため、1 枚に入りきりません（貼り付け内容を削ってください）
            </span>
          )}
        </div>

        <div className="kp-print-scroll"><div className="kp-print">
          {/* 1 枚に収めるための縮小。中身は触らず全体を縮める */}
          <div
            ref={fitRef}
            className="kp-print-fit"
            style={{ transform: `scale(${scale})`, width: `${100 / scale}%` }}
          >
          {/* ── 上部: 手書き欄 ────────────────────────────── */}
          <div className="kp-print-head">
            <div className="kp-print-row">
              <div className="kp-print-item" style={{ flex: '1 1 220px' }}>
                <span className="kp-print-label">氏名</span>
                <span className="kp-print-fill" style={{ flex: 1 }} />
              </div>
              <div className="kp-print-item">
                <span className="kp-print-label">男・女</span>
              </div>
            </div>
            <div className="kp-print-row">
              <div className="kp-print-item" style={{ flex: '1 1 220px' }}>
                <span className="kp-print-label">生年月日</span>
                <span className="kp-print-fill" style={{ flex: 1 }} />
              </div>
              <div className="kp-print-item">
                <span className="kp-print-label">年齢</span>
                {/* 年齢だけはアプリが保持している（氏名・生年月日は保存しない設計） */}
                <span className="kp-print-value">{record.age ? `${record.age} 歳` : ''}</span>
              </div>
            </div>
            <div className="kp-print-row">
              <div className="kp-print-item" style={{ flex: '1 1 200px' }}>
                <span className="kp-print-label">初事前問診者</span>
                <span className="kp-print-fill" style={{ flex: 1 }} />
              </div>
              <div className="kp-print-item">
                <span className="kp-print-label">問診日</span>
                <span className="kp-print-value">{formatDate(record.created_at)}</span>
              </div>
              <div className="kp-print-item">
                <span className="kp-print-label">受付コード</span>
                <span className="kp-print-value">{record.visit_code || ''}</span>
              </div>
            </div>
          </div>

          {/* ── 下部: 左=生成されたカルテ全文 / 右=ドクターキューブ ───── */}
          {/* 貼り付けが無い回は従来どおりカルテが全幅（横並びにすると右が空いて間延びする） */}
          <div className={record.form_data?.drQube?.text ? 'kp-print-cols' : undefined}>
            <div className="kp-print-karte">{record.generated_karte || '（カルテ未生成）'}</div>

            {record.form_data?.drQube?.text && (
              <div className="kp-print-dq">
                <div className="kp-print-dq-head">■ ドクターキューブ 事前WEB問診（患者入力）</div>
                {(() => {
                  const blocks = splitDrQube(record.form_data.drQube.text)
                  if (!blocks) return <div>{record.form_data.drQube.text}</div>
                  return blocks.map((b, k) => <div className="kp-print-dq-block" key={k}>{b}</div>)
                })()}
              </div>
            )}
          </div>
          </div>
          </div></div>
      </div>
    </>
  )
}
