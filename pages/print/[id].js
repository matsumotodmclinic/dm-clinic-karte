// 医師への引継ぎ用 A4（印刷）。2026-10-14 院長の指示で新設。
//
// ■ なぜ作ったか
// それまでスタッフは「紙に患者が書いた内容をアプリに打ち直し」ていた。
// 紙を**入力用紙から出力用紙に変える**ことで二重入力が消える。
//
// ★紙の中身は `components/PrintSheet.js` に置いてある（印刷見本 /print/sample と共用）。
//   このページは「レコードを取ってきて、操作列を出す」だけ。

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { UI } from '../../lib/uiTokens'
import PrintSheet, { PRINT_CSS } from '../../components/PrintSheet'

export default function PrintPage() {
  const router = useRouter()
  const { id } = router.query
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const [overflow, setOverflow] = useState(false)

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
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div style={{ background: UI.surfaceAlt, minHeight: '100vh', fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif" }}>
        {/* 画面でだけ出る操作列。印刷には出ない */}
        <div className="kp-no-print" style={{ margin: '0 auto', padding: '16px 0', display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 760, flexWrap: 'wrap' }}>
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

        <PrintSheet record={record} onFit={(s, o) => { setScale(s); setOverflow(o) }} />
      </div>
    </>
  )
}
