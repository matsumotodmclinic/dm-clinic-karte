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

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { UI } from '../../lib/uiTokens'

// 問診日は西暦（院長確定 2026-10-14）。カルテ本文は和暦だが、ここは受付が見る欄なので揃えない。
function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

const CSS = `
.kp-print { max-width: 190mm; margin: 0 auto; padding: 12mm 10mm; background: #fff; }
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
  font-size: 11.5px; line-height: 1.75;
  font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif;
}
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

  useEffect(() => {
    if (!id) return
    fetch(`/api/questionnaire/detail?id=${id}`)
      .then(r => r.json())
      .then(data => { setRecord(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

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
        </div>

        <div className="kp-print">
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

          {/* ── 下部: 生成されたカルテ全文 ───────────────────── */}
          <div className="kp-print-karte">{record.generated_karte || '（カルテ未生成）'}</div>
        </div>
      </div>
    </>
  )
}
