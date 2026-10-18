// ドクターキューブ改訂依頼書を「変更箇所が赤い紙」にする（院長 2026-10-18）。
//
// ■ なぜ要るか
// 院長「現状の内容から変更になっている部分は赤に変更してもらえる？ このまま依頼書を送るので」。
// 資料は Markdown（`docs/doctorqube_questionnaire_all.md`）で、Markdown には色が無い。
// 送るのは PDF になるので、**HTML に起こして印刷**できる形にする。
//
// ■ どこを赤くするか（院長 2026-10-18 確定: 方針＋追補＋新設）
// ★差分の印は**資料そのものが持っている**。git には前の版が無い（取り込み時点で追補込みの 1 コミット）ので、
//   資料内の印を正本として使う。
//   ① 行に 【新規追加】 / 【必須化】 がある        … 院長が claude.ai で書いたときに付けた印（19 + 1 箇所）
//   ② 行末に `<!--変更-->` がある                  … 患者に見える案内文に文字を足せない箇所用の見えない印
//   ③ 「全メニュー共通の改訂方針」の箇条書き        … 全メニューに一括で掛かる変更
//   ④ 新設メニュー（見出しに「(新設)」）の節すべて  … メニューごと新規
//
// ■ Markdown はこの資料で使っている書式だけを扱う
// 見出し(#/##/###) / 箇条書き(- と 2 スペース字下げ) / 表 / 引用(>) / 区切り(---) / 段落 / **太字**。
// ★汎用の Markdown 変換器は入れない（依存を増やさない方針）。資料の書式が増えたら
//   `scripts/golden/drqube-request.test.mjs` の「取りこぼし検査」が落ちる。

const CHANGE_MARKS = ['【新規追加】', '【必須化】']
const HIDDEN_MARK = '<!--変更-->'

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** **太字** だけ後から戻す（エスケープ後に適用する） */
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

/** 見出しが新設メニューか（「## 02. …(新設)」） */
const isNewMenuHeading = line => /^##\s/.test(line) && /[（(]新設[）)]/.test(line)

/**
 * 行ごとに「赤くするか」を決める。
 * @returns {{ text: string, changed: boolean }[]} 元の行数と必ず同じ長さ
 */
export function markChangedLines(md) {
  const lines = String(md ?? '').split(/\r?\n/)
  let inNewMenu = false      // 新設メニューの節の中か
  let inPolicy = false       // 「全メニュー共通の改訂方針」の節の中か

  let inPreamble = false     // 前段「この依頼書について」の中か

  return lines.map(raw => {
    if (/^##\s/.test(raw)) {
      inNewMenu = isNewMenuHeading(raw)
      inPolicy = raw.includes('全メニュー共通の改訂方針')
      // ★前段は「読み方の説明」なので赤くしない。凡例に 【新規追加】 と書いてあるだけで
      //   赤くなってしまうと、凡例そのものが変更点に見える
      inPreamble = raw.includes('この依頼書について')
    }
    if (inPreamble) return { text: raw.replace(HIDDEN_MARK, ''), changed: false }

    const hasMark = CHANGE_MARKS.some(m => raw.includes(m)) || raw.includes(HIDDEN_MARK)
    // 方針の節は箇条書きだけを赤くする（見出しや区切りまで赤くすると読みにくい）
    const policyBullet = inPolicy && /^-\s/.test(raw)
    // メニュー一覧で「新設」と書かれている行（メニューごと新規）
    const newMenuRow = /^\|/.test(raw) && raw.split('|').some(c => c.trim() === '新設')
    const changed = hasMark || policyBullet || newMenuRow
      || (inNewMenu && raw.trim() !== '' && !/^---+$/.test(raw))
    return { text: raw.replace(HIDDEN_MARK, ''), changed }
  })
}

/** 表の 1 行を <td>（または <th>）に割る */
function tableCells(line, tag) {
  const cells = line.replace(/^\|/, '').replace(/\|$/, '').split('|')
  return cells.map(c => `<${tag}>${inline(c.trim())}</${tag}>`).join('')
}

const isTableDivider = l => /^\|[\s:|-]+\|$/.test(l.trim())

/**
 * 変更箇所が赤い HTML にする（単体で開ける 1 ファイル）。
 * @param {string} md 依頼書の Markdown
 * @param {{ printedOn?: string }} [opt] 印刷日（省略時は入れない。テストを日付に依存させないため）
 */
export function renderRequestHtml(md, { printedOn } = {}) {
  const rows = markChangedLines(md)
  const out = []
  let list = null          // 箇条書きをまとめる
  let quote = null         // 引用をまとめる
  let table = null         // 表をまとめる

  const closeList = () => { if (list) { out.push(`<ul>${list.join('')}</ul>`); list = null } }
  const closeQuote = () => { if (quote) { out.push(`<blockquote>${quote.join('')}</blockquote>`); quote = null } }
  const closeTable = () => { if (table) { out.push(`<table>${table.join('')}</table>`); table = null } }
  const closeAll = () => { closeList(); closeQuote(); closeTable() }
  const cls = c => (c ? ' class="chg"' : '')

  for (const { text, changed } of rows) {
    const line = text
    if (!line.trim()) { closeAll(); continue }

    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      closeAll()
      const lv = h[1].length
      out.push(`<h${lv}${cls(changed)}>${inline(h[2])}</h${lv}>`)
      continue
    }
    if (/^---+$/.test(line.trim())) { closeAll(); out.push('<hr>'); continue }

    if (/^\|/.test(line)) {
      closeList(); closeQuote()
      if (isTableDivider(line)) continue
      if (!table) { table = [`<tr>${tableCells(line, 'th')}</tr>`] }
      else table.push(`<tr${cls(changed)}>${tableCells(line, 'td')}</tr>`)
      continue
    }
    closeTable()

    if (/^>\s?/.test(line)) {
      closeList()
      if (!quote) quote = []
      quote.push(`<div${cls(changed)}>${inline(line.replace(/^>\s?/, ''))}</div>`)
      continue
    }
    closeQuote()

    const li = /^(\s*)-\s+(.*)$/.exec(line)
    if (li) {
      if (!list) list = []
      const indent = li[1].length >= 2 ? ' class="sub"' : ''
      list.push(`<li${changed ? ' class="chg"' : indent}>${inline(li[2])}</li>`)
      continue
    }
    closeList()

    // 2 スペース字下げの ※注記は、前の行にぶら下げて読ませる
    const note = /^\s{2,}(.*)$/.exec(line)
    out.push(`<p${changed ? ' class="chg"' : note ? ' class="note"' : ''}>${inline(note ? note[1] : line)}</p>`)
  }
  closeAll()

  const stamp = printedOn ? `<div class="stamp">印刷日 ${esc(printedOn)}</div>` : ''
  return `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<title>ドクターキューブ 簡易問診 設定改訂のお願い</title>
<style>
  body { font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif;
         max-width: 190mm; margin: 0 auto; padding: 14mm 10mm; color: #222; line-height: 1.8; font-size: 13px; }
  h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 6px; }
  h2 { font-size: 16px; margin-top: 26px; border-left: 5px solid #333; padding-left: 8px; }
  h3 { font-size: 14px; margin-top: 18px; }
  ul { margin: 6px 0; padding-left: 1.4em; }
  li.sub { list-style: none; color: #555; font-size: 12.5px; }
  p { margin: 6px 0; }
  p.note { color: #555; font-size: 12.5px; margin-left: 1.2em; }
  blockquote { margin: 8px 0; padding: 8px 12px; background: #f6f7f9; border-left: 3px solid #bbb; }
  blockquote div { font-size: 12.5px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12.5px; }
  th, td { border: 1px solid #999; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eee; }
  hr { border: none; border-top: 1px solid #ccc; margin: 18px 0; }
  /* ★変更箇所。印刷でも色を落とさない */
  .chg, .chg * { color: #c62828; }
  .chg { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .stamp { text-align: right; color: #888; font-size: 11px; }
  @page { size: A4; margin: 12mm; }
  @media print { body { padding: 0; max-width: none; } h2 { break-after: avoid; } table, blockquote { break-inside: avoid; } }
</style>
${stamp}
${out.join('\n')}
</html>
`
}
