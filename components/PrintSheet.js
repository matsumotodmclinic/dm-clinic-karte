// 医師への引継ぎ用 A4（印刷）の中身。2026-10-14 新設。
//
// ■ なぜ部品にしたか
// 実データ用（/print/[id]）と 印刷見本（/print/sample）の 2 つが同じ紙を出す。
// 写すと必ずずれる（この repo が何度もやられている）ので、紙の中身はここ 1 箇所だけにする。
// `scripts/golden/print-sheet.test.mjs` が「両方のページがこの部品を使っているか」を見る。
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
//
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
import { splitDrQube } from '../lib/drQube'
import { isLibreHandoffLine } from '../lib/libreNotes'
import { collapseBlankLinesForPrint, toWarekiForPrint } from '../lib/printKarte'

// 問診日は西暦（院長確定 2026-10-14）。カルテ本文は和暦だが、ここは受付が見る欄なので揃えない。
export function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export const PRINT_CSS = `
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
/* 手書き欄。下線だけを引いて書けるようにする。
   ★幅は用途ごとに決め打ちする（院長 2026-10-14 実印刷「記入欄はもっと小さくてよい」）。
   flex:1 で伸ばすと紙の幅いっぱいの線になり、場所を取るわりに書く量は増えない。 */
.kp-print-fill { display: inline-block; border-bottom: 1px solid #333; height: 18px; }
.kp-print-fill-name { width: 52mm; }
.kp-print-fill-staff { width: 32mm; }
/* 生年月日は 年 / 月 / 日 を印字して、その手前だけ空ける（院長 2026-10-14） */
.kp-print-fill-y { width: 13mm; }
.kp-print-fill-md { width: 8mm; }
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
/* ★リブレの装着・妊娠糖尿病の予約の行は赤字（院長 2026-10-16）。
   見落とすと「やったつもり」で診察に入ってしまう行なので、紙の上で目に飛び込むようにする。
   色が要るのはここだけ。赤を増やすと赤が意味を失う。
   print-color-adjust は、ブラウザが印刷時に色を落とさないようにするため。 */
/* ★字も大きくする（院長 2026-10-16）。本文 11.5px に対して 14px。
   行ごとの span なので、大きくなるのはその行だけ（他の行の字の大きさは変わらない）。
   行が高くなるぶん紙は伸びるが、1 枚に収める縮小は測り直されるので入りきる。 */
.kp-print-hot {
  color: #c62828; font-weight: 700; font-size: 14px;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
/* 【項目】ごとに間を空ける。ベタ打ちのままだと項目の切れ目が読み取れない */
.kp-print-dq-block { margin-bottom: 5px; }
/* 縮小は transform でかける。font-size を個別に下げると行間や枠が崩れるため */
.kp-print-fit { transform-origin: top left; }
@page { size: A4; margin: 8mm; }
@media print {
  .kp-no-print { display: none !important; }
  .kp-print { padding: 0; }
  body { background: #fff; }
}
`

// A4 の印字領域（@page margin 8mm）。CSS の 1mm = 96/25.4 px。
// ★余裕は 5%（約 14mm）。2% では足りず、**実際に印刷したら最後の数行が裏のページに送られた**
//   （院長 2026-10-14）。プリンタごとに印字できない縁があり、@page の指定どおりには出ない。
//   ここを削ると「画面では収まっているのに紙でははみ出す」が戻るので、安易に詰めないこと。
const PAGE_H = (297 - 8 * 2) * (96 / 25.4) * 0.95
const MIN_SCALE = 0.62   // これ以上は読めないので縮めない（警告を出す）

/**
 * A4 の紙 1 枚ぶん。`onFit` に (縮小率, 入りきらないか) を返すので、
 * 画面側はそれを見て「○% に縮小しています」「入りきりません」を出す。
 * `banner` は紙にも印字する注意書き（印刷見本で使う）。
 */
export default function PrintSheet({ record, onFit, banner }) {
  const [scale, setScale] = useState(1)
  const fitRef = useRef(null)

  // ★測るのは 1 回では足りない（院長 2026-10-14 実印刷で裏のページに送られた）。
  //   初回の useEffect は **フォントの読み込み前や、ペインが隠れている間**に走ることがあり、
  //   そのときの高さで「縮小なし」と決めてしまうと、紙でだけはみ出す。
  //   フォント確定後と、**印刷直前（beforeprint）**にも測り直す。
  useEffect(() => {
    const measure = () => {
      const el = fitRef.current
      if (!el) return
      // ★測るときは 縮小と幅の両方を元に戻す。
      //   縮小中は width を 100/scale% に広げているので、transform だけ外して測ると
      //   **紙より広い幅で測る**ことになり、折り返しが減って高さを少なく見積もる。
      const t0 = el.style.transform
      const w0 = el.style.width
      el.style.transform = 'none'
      el.style.width = '100%'
      const h = el.scrollHeight
      el.style.transform = t0
      el.style.width = w0
      // 画面に出ていないと 0 が返る。そのときは触らない（勝手に極小で印刷されるのを防ぐ）
      if (!h) return
      const s = h > PAGE_H ? Math.max(MIN_SCALE, PAGE_H / h) : 1
      setScale(s)
      onFit?.(s, h * s > PAGE_H + 1)
    }

    measure()
    // Web フォントが載ると行の高さが変わる
    document.fonts?.ready?.then(measure).catch(() => {})
    // 印刷ダイアログを開く直前。ここで測り直せば、紙に出るのは必ず測った結果になる
    window.addEventListener('beforeprint', measure)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('beforeprint', measure)
      window.removeEventListener('resize', measure)
    }
    // onFit は毎回作り直される無名関数なので依存に入れない（入れると無限ループになる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record])

  // ★紙の上では西暦を和暦に直す（院長 2026-10-15）。カルテは和暦のみなので表記が混ざらないように。
  //   保存してある貼り付け原文は患者が入力したまま（後から原文を確かめられるように）。
  const dq = toWarekiForPrint(record?.form_data?.drQube?.text)

  return (
    <div className="kp-print-scroll"><div className="kp-print">
      {/* 1 枚に収めるための縮小。中身は触らず全体を縮める */}
      <div ref={fitRef} className="kp-print-fit" style={{ transform: `scale(${scale})`, width: `${100 / scale}%` }}>
        {banner}

        {/* ── 上部: 手書き欄 ────────────────────────────── */}
        <div className="kp-print-head">
          {/* 氏名・生年月日は保存しない設計なので手書き。線は書くのに要るぶんだけ */}
          <div className="kp-print-row">
            <div className="kp-print-item">
              <span className="kp-print-label">氏名</span>
              <span className="kp-print-fill kp-print-fill-name" />
            </div>
            <div className="kp-print-item">
              <span className="kp-print-label">男・女</span>
            </div>
            <div className="kp-print-item">
              <span className="kp-print-label">生年月日</span>
              <span className="kp-print-fill kp-print-fill-y" />
              <span className="kp-print-label">年</span>
              <span className="kp-print-fill kp-print-fill-md" />
              <span className="kp-print-label">月</span>
              <span className="kp-print-fill kp-print-fill-md" />
              <span className="kp-print-label">日</span>
            </div>
            <div className="kp-print-item">
              <span className="kp-print-label">年齢</span>
              {/* 年齢だけはアプリが保持している（氏名・生年月日は保存しない設計） */}
              <span className="kp-print-value">{record.age ? `${record.age} 歳` : ''}</span>
            </div>
          </div>
          <div className="kp-print-row">
            <div className="kp-print-item">
              <span className="kp-print-label">初事前問診者</span>
              <span className="kp-print-fill kp-print-fill-staff" />
            </div>
            <div className="kp-print-item">
              <span className="kp-print-label">問診日</span>
              <span className="kp-print-value">{formatDate(record.created_at)}</span>
            </div>
            {/* ★初診日は手書き（院長 2026-10-16）。
                この紙は初事前の日に刷って、初診の日まで持っておくもの。
                アプリは初診の予約日を持っていない（妊娠糖尿病のリブレ予約だけ例外）ので、
                氏名・生年月日と同じく**空の罫線**として印字し、受付が書く。 */}
            <div className="kp-print-item">
              <span className="kp-print-label">初診日</span>
              <span className="kp-print-fill kp-print-fill-y" />
              <span className="kp-print-label">年</span>
              <span className="kp-print-fill kp-print-fill-md" />
              <span className="kp-print-label">月</span>
              <span className="kp-print-fill kp-print-fill-md" />
              <span className="kp-print-label">日</span>
            </div>
            <div className="kp-print-item">
              <span className="kp-print-label">受付コード</span>
              <span className="kp-print-value">{record.visit_code || ''}</span>
            </div>
          </div>
        </div>

        {/* ── 下部: 左=生成されたカルテ全文 / 右=ドクターキューブ ───── */}
        {/* 貼り付けが無い回は従来どおりカルテが全幅（横並びにすると右が空いて間延びする） */}
        <div className={dq ? 'kp-print-cols' : undefined}>
          {/* ★紙だけ空行を詰める（電子カルテに貼る文は 3 行のまま・院長 2026-10-14） */}
          {/* 行ごとに span で包む。白地に pre-wrap なので、包んでも折り返しも高さも変わらない
              （1 枚に収める計算はこの要素の高さを測っている） */}
          <div className="kp-print-karte">
            {(() => {
              const text = collapseBlankLinesForPrint(record.generated_karte)
              if (!text) return '（カルテ未生成）'
              return text.split('\n').map((l, i) => (
                <span key={i} className={isLibreHandoffLine(l) ? 'kp-print-hot' : undefined}>{l}{'\n'}</span>
              ))
            })()}
          </div>

          {dq && (
            <div className="kp-print-dq">
              <div className="kp-print-dq-head">■ ドクターキューブ 事前WEB問診（患者入力）</div>
              {(() => {
                const blocks = splitDrQube(dq)
                if (!blocks) return <div>{dq}</div>
                return blocks.map((b, k) => <div className="kp-print-dq-block" key={k}>{b}</div>)
              })()}
            </div>
          )}
        </div>
      </div>
    </div></div>
  )
}
