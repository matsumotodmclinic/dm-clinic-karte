// 音声整形の「出口チェック」（院長 2026-10-16）。
//
// ■ なぜ要るか
// 2026-10-15〜16 に保存済みデータを調べたところ、`lib/voiceSummary.js` の指示文に
// 書いてあるのに守られていない出力が実際に出ていた:
//   ・「○年前」と話されたのに、整形結果に元号が 1 つも無い（時期が丸ごと落ちた）
//   ・西暦のまま書かれた（指示文には「西暦・年齢・○年前は絶対に使わない」とある）
//   ・録音の文字起こしが整形結果に丸ごと混入した
//   ・病名の記号が ASCII の `#` になった（カルテ側の正規化は ♯ と ＃ しか受けない）
// ★**指示文を直すだけでは防げない**ことが分かったので、出てきた文を機械で見る。
//
// ■ どこで使うか
// `components/VoiceMemoSection.js` が整形直後に呼び、スタッフに見せる。
// **止めない**（自動で書き換えもしない）。AI の判断が正しい回もあるので、
// 「ここを見てください」と出して、スタッフが textarea で直す。
//
// ■ 書き方の方針
// ・判定は全部ここ 1 箇所。画面は結果を並べるだけ
// ・偽陽性は「鬱陶しい」で済むが、見落としはカルテの誤りになる。**迷ったら出す側**に倒す
// ・ルール自体が赤くなることは `scripts/golden/voice-review.test.mjs` が検査する
//   （壊した出力を食わせて、ちゃんと指摘が出るか）

/** 元号。CPR0.5 のような英数字直後の R を拾わない（prompt.test.mjs と同じ轍） */
const ERA = /(?<![A-Za-z0-9])[HRS]\d{1,2}(?!\d)|平成|令和|昭和/

/** 「10年前」「十年ぐらい前」「3ヶ月前」 */
const YEARS_AGO = /(\d+|[一二三四五六七八九十百]+)\s*(?:年|ヶ月|か月|カ月|ケ月)\s*(?:くらい|ぐらい|ほど|位)?\s*前/

/** 西暦。「2016年」と「2016/10」「2016-10」の 2 形 */
const SEIREKI = /(?<!\d)(?:19|20)\d{2}\s*年|(?<!\d)(?:19|20)\d{2}[/\-.]\d{1,2}(?!\d)/

/** 行頭の ASCII シャープ。カルテ側の正規化は [♯＃] しか受けないので拾われない */
const ASCII_SHARP = /^[ 　]*#(?!#)/m

/** 録音をそのまま貼ったとみなす長さ。短いと言い回しの一致で誤検出する */
const COPIED_MIN = 30

/** 既往歴の整形結果に ♯ が 1 つも無いとき、「なし」で済む長さの上限 */
const PAST_HISTORY_SHORT = 25

const text = v => String(v ?? '')

/**
 * 録音の文を区切る。
 * ★「、」では切らないこと。話し言葉は読点が多いので、切ると断片が 30 字に届かず
 *   「丸ごと貼り付いている」状態を見逃す（実際に 1 回見逃した）。句点と改行だけで切る。
 */
function segments(transcript) {
  return text(transcript)
    .split(/[。\n\r]+/)
    .map(s => s.trim())
    .filter(s => s.length >= COPIED_MIN)
}

/**
 * 整形結果を機械で見る。
 *
 * @param {object} p
 * @param {string} p.transcript 録音（または手入力）の原文
 * @param {string} p.summary    AI の整形結果
 * @param {'currentIllness'|'pastHistory'} p.mode
 * @returns {{code:string, level:'error'|'warn', message:string, hint:string}[]}
 *   出すものが無ければ空配列。画面はこれを上から並べるだけ。
 */
export function reviewVoiceOutput({ transcript, summary, mode = 'currentIllness' } = {}) {
  const t = text(transcript).trim()
  const s = text(summary).trim()
  const out = []

  // 整形前（まだ押していない）は何も言わない
  if (!s) {
    if (t) {
      out.push({
        code: 'empty',
        level: 'error',
        message: '整形結果が空です',
        hint: '録音は残っているので、もう一度「AI で整形」を押してください。',
      })
    }
    return out
  }

  // ① 話されたのに時期が 1 つも書かれていない
  if (YEARS_AGO.test(t) && !ERA.test(s)) {
    out.push({
      code: 'era-missing',
      level: 'warn',
      message: '「○年前」と話されていますが、整形結果に時期（H・R）がありません',
      hint: '時期が落ちている可能性があります。録音を聞き直して、和暦で追記してください。',
    })
  }

  // ② 西暦が残っている（カルテは和暦のみ）
  if (SEIREKI.test(s)) {
    out.push({
      code: 'seireki',
      level: 'warn',
      message: '西暦が残っています',
      hint: 'カルテは和暦だけで書きます（H8、R5 など）。和暦に直してください。',
    })
  }

  // ③ 「○年前」が換算されずに残っている
  if (YEARS_AGO.test(s)) {
    out.push({
      code: 'years-ago',
      level: 'warn',
      message: '「○年前」「○ヶ月前」が残っています',
      hint: '何年前かではなく、和暦で書きます（例: R3）。',
    })
  }

  // ④ 病名の記号が ASCII の # になっている
  if (ASCII_SHARP.test(s)) {
    out.push({
      code: 'ascii-sharp',
      level: 'warn',
      message: '病名の記号が # （半角シャープ）になっています',
      hint: '♯ に直してください。半角の # だと、カルテで病名として扱われません。',
    })
  }

  // ⑤ 録音の文字起こしがそのまま混ざっている
  const copied = segments(t).find(seg => s.includes(seg))
  if (copied) {
    out.push({
      code: 'transcript-copied',
      level: 'warn',
      message: '録音した話し言葉が、そのまま整形結果に入っています',
      hint: `「${copied.slice(0, 20)}…」がそのまま残っています。整形し直すか、手で削ってください。`,
    })
  }

  // ⑥ 既往歴なのに ♯ の行が 1 つも無い
  if (mode === 'pastHistory' && !/[♯＃#]/.test(s) && s.length > PAST_HISTORY_SHORT) {
    out.push({
      code: 'past-history-format',
      level: 'warn',
      message: '既往歴が ♯病名（…）の形になっていません',
      hint: '1 行 1 疾患で ♯病名（時期・病院・薬）の形に直してください。',
    })
  }

  return out
}
