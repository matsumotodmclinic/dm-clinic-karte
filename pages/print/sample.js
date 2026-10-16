// 印刷見本（院長依頼 2026-10-14「実際に印刷して確認するので、テスト用のデータで1件作っておいて」）。
//
// DB には何も作らない。架空データ（lib/printSample.js）からその場でカルテを組んで、
// 実データ用と**同じ部品**（components/PrintSheet.js）で紙を出す。
// 一覧に架空の患者が混ざらず、A4 を直すたびに何度でも開き直せる。
//
// ★紙にも「印刷見本」と印字する（印刷したものが患者の 1 枚と紛れないように）。
//
// ■ 見本が 3 つある理由（院長 2026-10-16「赤が出るような見本をつくってほしい」）
//   既定は「いちばん厳しい回」= 1型糖尿病（カルテ最長）＋ 貼り付けあり。1 枚に収まるかを見る用。
//   ただし 1型には**リブレの行が出ない**ので、赤字の濃さ・大きさを紙で確かめられない。
//   そこで赤が出る回（妊娠糖尿病の予約3回分 / 反応性低血糖の装着）を切り替えられるようにした。

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { UI } from '../../lib/uiTokens'
import PrintSheet, { PRINT_CSS } from '../../components/PrintSheet'
import { buildKarteTemplate } from '../../lib/buildKarteTemplate'
import { PRINT_SAMPLES } from '../../lib/printSample'

export default function PrintSamplePage() {
  const router = useRouter()
  const [scale, setScale] = useState(1)
  const [overflow, setOverflow] = useState(false)
  const [which, setWhich] = useState(PRINT_SAMPLES[0].key)
  const sample = PRINT_SAMPLES.find(s => s.key === which) || PRINT_SAMPLES[0]

  // ★見本のレコードは **クライアントで組む**。
  //   サーバで組むと「問診日（今日）」がサーバ時刻で先に描画され、
  //   クライアントの描画と食い違って hydration エラーになる（実際に出した）。
  const [record, setRecord] = useState(null)
  useEffect(() => {
    // 見本も本番と同じ組立を通す（別の作り方にすると見本だけ体裁がずれる）
    setRecord({
      age: sample.age,
      visit_code: '見本',
      created_at: new Date().toISOString(),
      form_type: sample.formType,
      form_data: sample.formData,
      generated_karte: buildKarteTemplate(sample.formType, sample.formData),
      // ★見出しは紙の中身と同じレコードから作る。
      //   sample から直に作ると、切り替えた瞬間に**見出しだけ先に変わる**（本文は useEffect の後）。
      //   見出しは「これは見本です」と書いてある札なので、中身と食い違ってはいけない。
      note: sample.note,
    })
  }, [sample])

  const banner = record && (
    <div style={{ border: '1px solid #333', padding: '4px 10px', marginBottom: 8, fontSize: 11, fontWeight: 700 }}>
      ■ 印刷見本（架空データ・実在の患者ではありません）　{record.note}
    </div>
  )

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <div style={{ background: UI.surfaceAlt, minHeight: '100vh', fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif" }}>
        <div className="kp-no-print" style={{ margin: '0 auto', padding: '16px 0', display: 'flex', gap: 8, justifyContent: 'center', maxWidth: 760, flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/')}
            style={{ padding: '9px 15px', borderRadius: 8, border: `1px solid ${UI.border}`, background: UI.surface, color: UI.textMuted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            ← トップ
          </button>
          <button
            onClick={() => window.print()}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: UI.primary.fg, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            🖨 印刷
          </button>
          <span style={{ alignSelf: 'center', fontSize: 12, color: UI.textMuted }}>
            {scale < 1 ? `1 枚に収めるため ${Math.round(scale * 100)}% に縮小しています` : '縮小なし（原寸）'}
          </span>
          {overflow && (
            <span style={{ alignSelf: 'center', fontSize: 12, color: UI.danger.fg, fontWeight: 700 }}>
              ⚠️ 1 枚に入りきりません
            </span>
          )}
        </div>

        {/* 見本の切り替え。赤字は紙に出してみないと分からないので、赤が出る回を選べるようにする */}
        <div className="kp-no-print" style={{ maxWidth: 760, margin: '0 auto 10px', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {PRINT_SAMPLES.map(s => (
            <button
              key={s.key}
              onClick={() => setWhich(s.key)}
              style={{
                padding: '8px 14px', borderRadius: 6,
                border: `1px solid ${s.red ? UI.danger.fg : UI.primary.fg}`,
                background: which === s.key ? (s.red ? UI.danger.fg : UI.primary.fg) : UI.surface,
                color: which === s.key ? '#fff' : (s.red ? UI.danger.fg : UI.primary.fg),
                fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="kp-no-print" style={{ maxWidth: 760, margin: '0 auto 14px', padding: '10px 14px', background: UI.surface, border: `1px solid ${UI.border}`, borderRadius: 8, fontSize: 12.5, color: UI.textMuted, lineHeight: 1.8 }}>
          印刷するときは、印刷ダイアログの<strong>「送信先」をプリンタ</strong>にしてください。
          「PDF に保存」のままだと PC にファイルが残ります。
          {sample.red && <><br /><strong style={{ color: UI.danger.fg }}>赤字はモノクロのプリンタでは灰色になります。</strong>色で確かめるならカラーで印刷してください。</>}
        </div>

        {record && <PrintSheet record={record} banner={banner} onFit={(s, o) => { setScale(s); setOverflow(o) }} />}
      </div>
    </>
  )
}
