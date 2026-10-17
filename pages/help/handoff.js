// スタッフ向け「運用の手引き」と「申し送り早見表」（院長依頼 2026-10-14 / 最終版 2026-10-16）。
//
// ■ なぜアプリの中に置くか
// 紙だけだと古い版が残る。アプリに置けば、申し送りを足したときに
// lib/handoffCatalog.js を直すだけで全員が見る内容が更新される。
// そのカタログが実際の出力とずれていないことは
// scripts/golden/handoff-catalog.test.mjs が検査しているので、黙って古くなることがない。
//
// ■ 紙で配れること（院長 2026-10-16「事務の川目さんに渡してマニュアル化する」）
// 右上の「🖨 印刷」で A4。画面用のボタン類は印刷に出さない（.kp-no-print）。
// 章ごとに break-inside: avoid を効かせてあるので、1 つの表が紙の切れ目で割れない。
// 印刷日を刷り込む（手元の紙がいつ刷ったものか分かるように）。
//
// ■ 書く内容の線引き（院長 2026-10-14「ガイドから事実の部分を早見表に寄せる形で整理して」）
//   ・申し送りに何が出るか → lib/handoffCatalog.js（このページの後半に自動で出る）
//   ・画面の文言・選択肢   → 画面そのもの（書き写すとずれる）
//   ・ここに書くのは **手順と理由** だけ

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UI } from '../../lib/uiTokens'
import { HANDOFF_SECTIONS } from '../../lib/handoffCatalog'
import { RED_ON_PAPER } from '../../lib/libreNotes'

const FONT = "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif"

// ── ① 受付の入口（院長 2026-10-15「入口をドクターキューブに一本化」）──────
//
// ★4 つの場合を 1 つの段落に書くと、受付で読んで動けない。「こういう方 → こうする」で割る。
const ENTRY = [
  {
    who: 'ご予約なしで当日来院された方',
    todo: 'その場でスタッフが問診アプリに入力して、初事前問診を行います。紙も予約も要りません。',
    why: '当日の初事前問診は予約が要りません。紙に書いてもらっても、結局アプリに打ち直すことになります。',
  },
  {
    who: '混雑などで別日にまわす方',
    todo: '受付の Android タブレットで、ドクターキューブの WEB 予約をご本人に入力していただきます。入力が難しい方はスタッフが代行します。',
    why: '入口をドクターキューブ 1 つにまとめてあります。前の方の入力がタブレットに残ることはありません。',
  },
  {
    who: 'お電話の方',
    todo: 'スタッフがドクターキューブに代行入力します。お電話で伺った内容をそのまま入れてください。',
    why: '電話番号でご本人の確認ができ、メールアドレスは必須ではないので、代行入力で最後まで進みます。',
  },
  {
    who: '事前WEB問診で HbA1c 10%以上・体重減少ありの方',
    todo: 'スタッフからご連絡して、初事前問診の予約日を前倒しします。',
    why: 'ご本人の申告値でも放置できない数字だからです。当日院内で測った 10%以上（腹部エコー＋胸部X-P）とは別の話です。',
  },
  {
    who: 'ドクターキューブやネットが止まっているとき',
    todo: '【非常用】手書きの問診票を印刷して使います。普段は使いません。',
    why: '予約の入口が無くなってしまうためです。電子カルテはネットにつながっていないので、予約だけが止まることがあります。',
  },
]

// ── ② 問診から医師に渡すまで ───────────────────────────────
const FLOW = [
  {
    step: '1',
    title: '受診の区分に合うフォームを選んで入力する',
    body: '上から順に入力します。紙に書いてもらってから打ち直す必要はありません。',
  },
  {
    step: '2',
    title: '最終ステップで、当日の HbA1c とリブレの欄を入れる',
    body: '採血がまだなら HbA1c は空のままで進めて構いません。反応性低血糖の方はリブレを装着したか、妊娠糖尿病の方は予約を 3 回分取れたかを、その場で入れてください。',
  },
  {
    step: '3',
    title: 'カルテ文を生成する',
    body: '選択だけで終わった回は AI を使わずその場で出ます。音声や自由記入があった回だけ AI が文章化します。',
  },
  {
    step: '4',
    title: '採血の結果が出たら、詳細画面で入れ直す',
    body: '問診より採血が後になった回は、一覧から開いて入力し、保存してから「🔄 再生成」を押します。事前採血で糖尿病が判明した回は、同じ画面の「DM差分問診」も入力してから再生成します。リブレや予約を後から入れる欄も同じ画面にあります。',
  },
  {
    step: '5',
    title: 'ドクターキューブの事前WEB問診を貼り付ける（あれば）',
    body: '患者さんが来院前に入力していた回は、その画面からコピーして詳細画面の「ドクターキューブの事前WEB問診」欄に貼り付け、保存します。印刷用A4の右半分に出ます。カルテ本文（電子カルテに貼る文）には入りません。',
  },
  {
    step: '6',
    title: '「🖨 印刷用A4」で印刷して、医師に渡す',
    body: '上段は 2 行です。氏名・男女・生年月日・初事前問診者・初診日は空欄で刷られるので手書きしてください。年齢・問診日・受付コードはアプリが入れます。1 枚に収まらないときは自動で少し縮みます。',
  },
]

// ── ③ 新しく聴取するようになったこと ──────────────────────
//
// ★ここは「スタッフの手が増えたところ」だけを並べる。何が申し送りに出るかは後半の早見表が正本。
const NEW_ITEMS = [
  ['当日の HbA1c（院内測定）', '全例測定しているので、最終ステップか詳細画面で入れてください。10%以上だと腹部エコーと胸部X-P の予約が申し送りに入ります。'],
  ['紹介状のご持参', '紹介元（どこの何科か）だけでなく、現物をお持ちかどうかを聞きます。持参ありのときだけ申し送りに出ます。'],
  ['リブレ（自費CGM）を装着したか', '反応性低血糖の方は全例装着の運用です。装着した日も入れてください。装着しなかった回は、その旨と理由がそのまま医師に伝わります。'],
  ['2型の方が食後の低血糖を訴えたとき', '症状で「食後の低血糖を心配している」を選ぶと、リブレを装着したかを聞く欄が出ます。装着していない場合は「初診時に医師とご相談ください」が申し送りに入ります。'],
  ['妊娠糖尿病の予約 3 回分', 'リブレの装着は初診時なので、初事前では予約を 3 回分（初診・GDMフォロー①②）取ります。取れた日を入れてください。'],
  ['GLP-1 を続けるか', '他院で GLP-1 の注射を受けている方は、チェックすると申し送りに出ます。続けるかどうかは医師が診察時に判断します。'],
]

// ── ④ 印刷用A4（医師に渡す紙）の見方 ──────────────────────
const SHEET = [
  ['上段の 2 行', '手書きするのは 氏名・男女・生年月日・初事前問診者・初診日。年齢・問診日・受付コード・問診の種類はアプリが入れます。氏名と生年月日をアプリに保存しない設計なので、ここだけ手書きです。'],
  ['右側の枠', 'ドクターキューブの事前WEB問診を貼り付けた回だけ出ます（左がカルテ、右が貼り付け）。貼り付けが無い回はカルテが全幅になります。'],
  ['1 枚に入らないとき', '自動で少しだけ縮めて 1 枚に収めます。縮めても入らないときは画面に警告が出るので、貼り付けを削ってください。'],
]

// ── ④-2 紙で赤くなるもの（院長 2026-10-16）────────────────
//
// 上段は**大きさを変えずに色だけ**、申し送りは**赤くて大きい**。意味が違うので分けて説明する。
// ★申し送り側の一覧は `lib/libreNotes.js` の RED_ON_PAPER から出す（書き写さない）。
//   赤を足したらこのページにも自動で載る。
const RED_HEAD = [
  ['問診の種類', 'どの様式で聴いた記録かが分からないと、医師が読む前提を間違えるためです（14 フォームあります）。'],
  ['初診日', 'この紙は初事前の日に刷って初診の日まで持っておくものなので、受付が手で書きます。'],
]

// ── ⑤ 今回の改訂で変わったこと ────────────────────────────
const CHANGED = [
  ['紙の役割が変わりました', '入力用紙ではなく、アプリが作る出力用紙になりました。患者さんに書いてもらっていた項目はアプリに一本化されています。'],
  ['入口がドクターキューブ 1 つになりました', '当日来院はその場で問診アプリ、別日と電話はドクターキューブ。覚える手順を 1 つにするためです。手書きの問診票は非常用に格下げしました。'],
  ['紙にあった段取りがカルテに入りました', '体重減少やHbA1c高値での検査追加、妊娠糖尿病の予約、小児慢性の申請確認などが、申し送りに自動で出ます。'],
  ['やったかどうかが残るようになりました', 'リブレの装着と妊娠糖尿病の予約は、これまで「必ずやるもの」として決まった文が出ていました。入力した結果だけを書くように変えたので、未入力の回は「未確認」と出ます。'],
  ['病名の書き方が実カルテとそろいました', '記号は ♯ に統一され、当院で診る病名と他院で診ている病名は記号ではなく「空行の前か後か」で分かれます。略号もやめて ♯高血圧 ／ ♯脂質異常症 と名前で書きます。電子カルテで病名を検索したときに取りこぼさなくなります。'],
  ['療養計画書は「作成をお願いします」になりました', '実際に作成するのは医師なので、「作成済」とは書かなくなりました。インスリン使用中の方には出ません。'],
]

export default function HandoffHelpPage() {
  // ★印刷日はクライアントで入れる（サーバで入れると描画が食い違って hydration エラーになる）。
  //   手元の紙がいつ刷ったものか分かるようにするためで、内容の改訂日とは別。
  const [printedOn, setPrintedOn] = useState('')
  useEffect(() => {
    const d = new Date()
    setPrintedOn(`${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`)
  }, [])

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
        /* 入口の表。「こういう方 → こうする → なぜ」。紙で読む前提 */
        .kp-entry { display: flex; gap: 12px; padding: 11px 0; border-top: 1px solid ${UI.border}; }
        .kp-entry:first-of-type { border-top: none; }
        .kp-who { flex: 0 0 30%; font-size: 13px; font-weight: 700; color: ${UI.text}; line-height: 1.7; }
        .kp-todo { font-size: 12.5px; color: ${UI.text}; line-height: 1.8; }
        .kp-why { font-size: 11.5px; color: ${UI.textFaint}; line-height: 1.8; margin-top: 3px; }
        @page { size: A4; margin: 10mm; }
        @media print {
          .kp-no-print { display: none !important; }
          .kp-doc { max-width: none; padding: 0; }
          /* 1 つの表が紙の切れ目で割れないようにする（配って読むものなので） */
          .kp-card { border: 1px solid #333; break-inside: avoid; page-break-inside: avoid; }
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
            <Link href="/print/sample" legacyBehavior>
              <a style={{ padding: '9px 15px', borderRadius: 8, border: `1px solid ${UI.border}`, background: UI.surface, color: UI.textMuted, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                印刷用A4の見本を見る
              </a>
            </Link>
            <Link href="/print/walkin" legacyBehavior>
              <a style={{ padding: '9px 15px', borderRadius: 8, border: `1px solid ${UI.border}`, background: UI.surface, color: UI.textMuted, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>
                【非常用】手書きの問診票
              </a>
            </Link>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: UI.textFaint, fontWeight: 700, letterSpacing: '0.08em' }}>まつもと糖尿病クリニック　初診事前問診</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: UI.text, margin: '4px 0 6px' }}>初事前問診 運用の手引き</h1>
            <div style={{ fontSize: 12.5, color: UI.textMuted, lineHeight: 1.8 }}>
              2026年10月改訂　受付での入口の決め方から、医師に紙を渡すまで。後半は「入力した内容が医師にどう伝わるか」の対応表です。
              {printedOn && <span style={{ color: UI.textFaint }}>　（印刷日 {printedOn}）</span>}
            </div>
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">① 受付での入口の決め方</h2>
            <p className="kp-note">入口はドクターキューブに一本化しました。手書きの問診票は、ネットが止まったときの非常用です。</p>
            {ENTRY.map(e => (
              <div className="kp-entry" key={e.who}>
                <div className="kp-who">{e.who}</div>
                <div>
                  <div className="kp-todo">{e.todo}</div>
                  <div className="kp-why">なぜ：{e.why}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">② 問診から医師に渡すまで</h2>
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
            <h2 className="kp-h2">③ 新しく聴取するようになったこと</h2>
            <p className="kp-note">ここが増えた手です。どれも入れ忘れると、医師には「未確認」と伝わります。</p>
            {NEW_ITEMS.map(([t, b]) => (
              <div className="kp-row" key={t}>
                <div className="kp-line">{t}</div>
                <div className="kp-when">{b}</div>
              </div>
            ))}
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">④ 医師に渡す紙（印刷用A4）の見方</h2>
            <p className="kp-note">実物は「印刷用A4の見本を見る」で確認できます（赤字が出る見本もあります）。</p>
            {SHEET.map(([t, b]) => (
              <div className="kp-row" key={t}>
                <div className="kp-line">{t}</div>
                <div className="kp-when">{b}</div>
              </div>
            ))}
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">④-2 紙で赤くなるもの</h2>
            <p className="kp-note">
              赤は「見落とすと困るもの」にだけ使っています。増やすと赤が意味を失うので、ここに挙げたものだけです。
              <strong>モノクロのプリンタでは灰色になります。</strong>色で確かめたいときはカラーで印刷してください。
            </p>

            <div style={{ fontSize: 13, fontWeight: 700, color: UI.text, margin: '10px 0 2px' }}>
              上段（色だけ赤・大きさは他と同じ）
            </div>
            {RED_HEAD.map(([t, b]) => (
              <div className="kp-row" key={t}>
                <div className="kp-line" style={{ color: '#c62828' }}>{t}</div>
                <div className="kp-when">{b}</div>
              </div>
            ))}

            <div style={{ fontSize: 13, fontWeight: 700, color: UI.text, margin: '14px 0 2px' }}>
              申し送り（赤くて大きい）
            </div>
            <p className="kp-note" style={{ margin: '0 0 6px' }}>
              リブレに関わる行です。<strong>やったかどうかがそのまま残る</strong>ので、入れ忘れると「未確認」と医師に伝わります。
            </p>
            {RED_ON_PAPER.map(r => (
              <div className="kp-row" key={r.match}>
                <div className="kp-line" style={{ color: '#c62828' }}>{r.what}</div>
                <div className="kp-when">{r.when}</div>
              </div>
            ))}
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">⑤ 今回の改訂で変わったこと</h2>
            <p className="kp-note">これまで紙や口頭で補っていたものが、カルテに自動で入るようになりました。</p>
            {CHANGED.map(([t, b]) => (
              <div className="kp-row" key={t}>
                <div className="kp-line">{t}</div>
                <div className="kp-when">{b}</div>
              </div>
            ))}
          </div>

          <div className="kp-card">
            <h2 className="kp-h2">⑥ 申し送り早見表</h2>
            <p className="kp-note">
              ここから下は「どう入力すると、医師に何が伝わるか」の対応表です。
              アプリの出力から自動で検査しているので、申し送りが増えたらこの表にも必ず載ります。
            </p>
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
            この手引きはアプリの中にあります（完全ガイド集 → 運用の手引き）。紙は印刷した時点の写しです。
          </div>
        </div>
      </div>
    </>
  )
}
